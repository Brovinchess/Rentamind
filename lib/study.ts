import {
  addPoints,
  addStudyLog,
  getDuePlans,
  getTrainingPlan,
  getUnansweredStudyLogs,
  updateStudyLog,
  updateTrainingPlan,
} from "./db";
import { getBuilderKeyForEmail } from "./auth";
import { studyDirective, type ArchetypeKey } from "./curriculum";
import { mindsFor } from "./minds";
import { MIN_MIND_COGNITION, mindBalance } from "./mind-health";

export const TRAINING_POINTS_PER_CYCLE = 5;
// Keep a bit more headroom for study than for a single reply — a directive plus
// the Mind's research/reply can cost more than one rental message.
const STUDY_MIN_COGNITION = MIN_MIND_COGNITION * 3;

export function trainAlias(mindId: string) {
  return `ram-${mindId.slice(0, 8)}`;
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
 * The study scheduler (Jarvis-style cron worker). One pass:
 * 1. collect replies for directives that were sent earlier
 * 2. send a new study directive to every plan that is due
 * Fire-and-forget sends — replies are collected on later passes.
 */
export async function runDueStudies(): Promise<{ sent: number; repliesCollected: number }> {
  let sent = 0;
  let repliesCollected = 0;
  const keyCache = new Map<string, string | null>();
  const keyFor = async (email: string | null) => {
    if (!email) return null;
    if (!keyCache.has(email)) keyCache.set(email, await getBuilderKeyForEmail(email));
    return keyCache.get(email) ?? null;
  };

  // 1. Collect replies to earlier directives.
  const pending = await getUnansweredStudyLogs().catch(() => []);
  for (const log of pending) {
    try {
      const plan = await getTrainingPlan(log.plan_id);
      if (!plan) continue;
      const key = await keyFor(plan.owner_email);
      if (!key) continue;
      const c = mindsFor(key);
      const alias = trainAlias(plan.mind_id);
      const rows = await c.getHistory(alias, log.fingerprint ? { after: log.fingerprint, limit: 10 } : { limit: 10 });
      rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
      const reply = rows.find((r) => r.senderType !== 1 && r.fingerprint !== log.fingerprint);
      if (reply) {
        await updateStudyLog(log.id, { reply: stripHtml(reply.messageText ?? "").slice(0, 3000) });
        repliesCollected++;
      }
    } catch (e) {
      console.error("[study] reply collection failed for log", log.id, e);
    }
  }

  // 2. Send new directives to due plans.
  const due = await getDuePlans().catch(() => []);
  for (const plan of due) {
    try {
      const key = await keyFor(plan.owner_email);
      if (!key) continue;
      const c = mindsFor(key);
      // Fix 3: auto-pause a persona's study loop before it drains its Mind dry.
      const bal = await mindBalance(key, plan.mind_id);
      if (bal != null && bal < STUDY_MIN_COGNITION) {
        await updateTrainingPlan(plan.id, { is_studying: false });
        continue;
      }
      const alias = trainAlias(plan.mind_id);
      const { topic, text } = studyDirective(plan.archetype as ArchetypeKey, plan.persona_name, plan.study_cycles);
      await c.ensureConversation(alias, plan.mind_id);
      const before = await c.getLatestHistoryFingerprint(alias);
      await c.sendMessage({ alias, messageText: text });
      await addStudyLog({ plan_id: plan.id, topic, directive: text, fingerprint: before ?? null });
      await updateTrainingPlan(plan.id, {
        study_cycles: plan.study_cycles + 1,
        next_study_at: new Date(Date.now() + plan.study_frequency_hours * 3600_000).toISOString(),
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
      console.error("[study] directive send failed for plan", plan.id, e);
    }
  }

  return { sent, repliesCollected };
}
