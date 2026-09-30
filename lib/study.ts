import {
  addPoints,
  addStudyLog,
  getDuePlans,
  getTrainingPlan,
  getUnansweredStudyLogs,
  updateStudyLog,
  updateTrainingPlan,
} from "./db";
import { getAccessTokenForEmail } from "./auth";
import { studyDirective, type ArchetypeKey } from "./curriculum";
import { mindsFor } from "./minds";
import { MIN_MIND_COGNITION, mindBalance } from "./mind-health";
import { withTimeout } from "./with-timeout";

export const TRAINING_POINTS_PER_CYCLE = 5;
// Keep more headroom for study than a single reply — a directive plus the Mind's
// research/reply can cost more than one rental message.
const STUDY_MIN_COGNITION = MIN_MIND_COGNITION * 3;

// Every Builder-API call is time-boxed: on Minds with huge conversation
// histories some calls (e.g. history reads) can hang indefinitely, which
// previously wedged the whole scheduler and stalled ALL plans. A hung call now
// just fails that one step.
// Bounds live in lib/with-timeout.ts; this pass just uses the shared default.
// Stay well under the serverless function limit so a pass always completes and
// the cron/page-visit ticks make steady progress.
const PASS_DEADLINE_MS = 45_000;
// Plans are handled most-overdue-first and the pass stops at PASS_DEADLINE_MS,
// which is the real safety bound. This cap only stops one pass from queuing an
// unbounded amount of work; too low a value starves whoever sorts last.
const MAX_PLANS_PER_PASS = 12;
const MAX_REPLIES_PER_PASS = 5;
// When a plan's send fails, wait this long before retrying so it can't hammer
// the API or block other plans every pass.
const RETRY_BACKOFF_MS = 30 * 60_000;

export function trainAlias(mindId: string) {
  return `ram-${mindId.slice(0, 8)}`;
}

/**
 * When the next study cycle is due, anchored to the slot this one was *due*
 * rather than the moment it actually ran.
 *
 * Scheduling from `Date.now()` compounded the cron's granularity: a pass fires
 * up to 15 min after a plan comes due, so `now + 2h` pushed every subsequent
 * slot 15 min later than the last. Measured effect was a median gap of 2.25h on
 * a 2h setting — ~14% fewer cycles than the slider asked for, growing with time.
 *
 * Anchoring keeps cycles on a fixed grid: any one cycle may be a few minutes
 * late, but the error never accumulates.
 */
export function nextSlot(dueAtIso: string | null, frequencyHours: number, now = Date.now()): string {
  const freqMs = Math.max(1, frequencyHours) * 3600_000;
  const dueAt = dueAtIso ? new Date(dueAtIso).getTime() : now;
  if (!Number.isFinite(dueAt)) return new Date(now + freqMs).toISOString();

  let next = dueAt + freqMs;
  if (next <= now) {
    // The plan fell behind (paused, stalled, or an outage). Skip forward to the
    // next slot on the grid instead of firing a burst of catch-up cycles.
    const missed = Math.ceil((now - dueAt) / freqMs);
    next = dueAt + missed * freqMs;
    if (next <= now) next += freqMs;
  }
  return new Date(next).toISOString();
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Study scheduler pass (bounded + resilient):
 *   1. SEND directives to due plans (the critical path — advances cycles + points).
 *   2. Best-effort: collect a few replies for the study feed.
 * Every Builder call is timeout-guarded; the pass stops at a wall-clock deadline
 * so it always finishes within the serverless limit and the cron/visits catch up.
 */
export async function runDueStudies(): Promise<{ sent: number; repliesCollected: number; paused: number }> {
  const startedAt = Date.now();
  const overBudget = () => Date.now() - startedAt > PASS_DEADLINE_MS;
  let sent = 0;
  let repliesCollected = 0;
  let paused = 0;

  const keyCache = new Map<string, string | null>();
  const keyFor = async (email: string | null) => {
    if (!email) return null;
    if (!keyCache.has(email)) keyCache.set(email, await getAccessTokenForEmail(email));
    return keyCache.get(email) ?? null;
  };

  // ── 1. Send directives to due plans (most-overdue first, capped per pass). ──
  const due = (await getDuePlans().catch(() => [])).slice(0, MAX_PLANS_PER_PASS);
  for (const plan of due) {
    if (overBudget()) break;
    try {
      const key = await keyFor(plan.owner_email);
      if (!key) continue;
      const c = mindsFor(key);

      // Auto-pause before draining a Mind dry.
      const bal = await mindBalance(key, plan.mind_id);
      if (bal != null && bal < STUDY_MIN_COGNITION) {
        await updateTrainingPlan(plan.id, { is_studying: false });
        paused++;
        continue;
      }

      const alias = trainAlias(plan.mind_id);
      const { topic, text } = studyDirective(plan.archetype as ArchetypeKey, plan.persona_name, plan.study_cycles);
      await withTimeout(c.ensureConversation(alias, plan.mind_id), "ensureConversation");
      // Capture the current head so reply-collection can look strictly after it.
      // This can hang on very large histories, so it's timeout-guarded and optional.
      let before: string | undefined;
      try {
        // Returns in ~1s on small histories, hangs on huge ones — bail fast (5s).
        before = await withTimeout(c.getLatestHistoryFingerprint(alias), "getLatestHistoryFingerprint", 5_000);
      } catch {
        before = undefined; // reply-collection falls back to newest-N
      }
      await withTimeout(c.sendMessage({ alias, messageText: text }), "sendMessage");
      await addStudyLog({ plan_id: plan.id, topic, directive: text, fingerprint: before ?? null });
      await updateTrainingPlan(plan.id, {
        study_cycles: plan.study_cycles + 1,
        next_study_at: nextSlot(plan.next_study_at, plan.study_frequency_hours),
      });
      await addPoints([
        {
          subject_email: plan.owner_email ?? "unknown",
          subject_name: (plan.owner_email ?? "").split("@")[0] || null,
          role: "steward",
          event_type: "training",
          points: TRAINING_POINTS_PER_CYCLE,
          meta: { planId: plan.id, persona: plan.persona_name, mind: plan.mind_name, cycle: plan.study_cycles + 1, topic, season: "0" },
        },
      ]);
      sent++;
    } catch (e) {
      // Don't let one bad plan block the queue: push it back with a short backoff.
      console.error("[study] send failed for", plan.persona_name, "-", e instanceof Error ? e.message : e);
      await updateTrainingPlan(plan.id, {
        next_study_at: new Date(Date.now() + RETRY_BACKOFF_MS).toISOString(),
      }).catch(() => {});
    }
  }

  // ── 2. Best-effort reply collection for the study feed. ──
  const pending = (await getUnansweredStudyLogs().catch(() => [])).slice(0, MAX_REPLIES_PER_PASS);
  for (const log of pending) {
    if (overBudget()) break;
    try {
      const plan = await getTrainingPlan(log.plan_id);
      if (!plan) continue;
      const key = await keyFor(plan.owner_email);
      if (!key) continue;
      const c = mindsFor(key);
      const alias = trainAlias(plan.mind_id);
      const rows = await withTimeout(
        c.getHistory(alias, log.fingerprint ? { after: log.fingerprint, limit: 10 } : { limit: 10 }),
        "getHistory",
      );
      rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
      const reply = rows.find((r) => r.senderType !== 1 && r.fingerprint !== log.fingerprint);
      if (reply) {
        await updateStudyLog(log.id, { reply: stripHtml(reply.messageText ?? "").slice(0, 3000) });
        repliesCollected++;
      }
    } catch (e) {
      console.error("[study] reply collection failed for log", log.id, "-", e instanceof Error ? e.message : e);
    }
  }

  return { sent, repliesCollected, paused };
}
