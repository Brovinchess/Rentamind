import {
  addPoints,
  addStudyLog,
  getDuePlans,
  getTrainingPlan,
  getUnansweredStudyLogs,
  updateStudyLog,
  updateTrainingPlan,
} from "./db";
import { studyDirective, type ArchetypeKey } from "./curriculum";
import { minds, STEWARD_EMAIL } from "./minds";

export const TRAINING_POINTS_PER_CYCLE = 5;

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
  const c = minds();

  // 1. Collect replies to earlier directives.
  const pending = await getUnansweredStudyLogs().catch(() => []);
  for (const log of pending) {
    try {
      const plan = await getTrainingPlan(log.plan_id);
      if (!plan) continue;
      const alias = trainAlias(plan.mind_id);
      const rows = await c.getHistory(alias, log.fingerprint ? { after: log.fingerprint, limit: 10 } : { limit: 10 });
      rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
      const reply = rows.find((r) => r.senderType !== 1 && r.fingerprint !== log.fingerprint);
      if (reply) {
        await updateStudyLog(log.id, { reply: stripHtml(reply.messageText ?? "").slice(0, 3000) });
        repliesCollected++;
      }
    } catch {
      // best-effort; retry next pass
    }
  }

  // 2. Send new directives to due plans.
  const due = await getDuePlans().catch(() => []);
  for (const plan of due) {
    try {
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
          subject_email: STEWARD_EMAIL,
          subject_name: "Rovin",
          role: "steward",
          event_type: "training",
          points: TRAINING_POINTS_PER_CYCLE,
          meta: { planId: plan.id, persona: plan.persona_name, mind: plan.mind_name, cycle: plan.study_cycles + 1, topic },
        },
      ]);
      sent++;
    } catch {
      // best-effort; plan stays due and retries next pass
    }
  }

  return { sent, repliesCollected };
}
