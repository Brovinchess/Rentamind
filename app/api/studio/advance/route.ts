import { NextResponse } from "next/server";
import {
  addPoints,
  getTrainingPlan,
  getTrainingSession,
  updateTrainingPlan,
  updateTrainingSession,
} from "@/lib/db";
import { examPairs, type Brief, type Step } from "@/lib/curriculum";
import { buildJudgePrompt, parseJudgeReply, type JudgeReport } from "@/lib/judge";
import { ARCHETYPES, type ArchetypeKey } from "@/lib/curriculum";
import { minds, STEWARD_EMAIL } from "@/lib/minds";

export const maxDuration = 120;

const TRAINING_POINTS_PER_MESSAGE = 5;

function trainAlias(mindId: string) {
  return `ram-${mindId.slice(0, 8)}`;
}
function judgeAlias(judgeMindId: string) {
  return `ram-judge-${judgeMindId.slice(0, 8)}`;
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

/** Find the first Mind reply after a fingerprint in an alias's history. */
async function findReply(alias: string, mindId: string, after?: string): Promise<string | null> {
  const c = minds();
  await c.ensureConversation(alias, mindId);
  const rows = await c.getHistory(alias, after ? { after, limit: 20 } : { limit: 20 });
  rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  const reply = rows.find((r) => r.senderType !== 1 && r.fingerprint !== after);
  return reply ? stripHtml(reply.messageText ?? "") : null;
}

async function sendTo(alias: string, mindId: string, text: string): Promise<string | undefined> {
  const c = minds();
  await c.ensureConversation(alias, mindId);
  const before = await c.getLatestHistoryFingerprint(alias);
  await c.sendMessage({ alias, messageText: text });
  return before;
}

/**
 * POST /api/studio/advance {sessionId} — one tick of the training state machine.
 * Each call does at most one quick thing (send a message, check for a reply,
 * parse the judge's scores); the client polls until the session is done.
 */
export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    const session = sessionId ? await getTrainingSession(sessionId) : null;
    if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
    if (session.status !== "running") {
      return NextResponse.json({ status: session.status, cursor: session.cursor, steps: session.steps, report: session.report, score: session.score });
    }
    const plan = await getTrainingPlan(session.plan_id);
    if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });

    const brief = plan.brief as unknown as Brief;
    const steps = session.steps as Step[];
    const step = steps[session.cursor];
    if (!step) {
      await updateTrainingSession(session.id, { status: "failed" });
      return NextResponse.json({ error: "corrupt session state" }, { status: 500 });
    }

    const alias = trainAlias(plan.mind_id);
    const jAlias = judgeAlias(brief.judgeMindId);
    let cursor = session.cursor;
    let waiting = false;

    switch (step.kind) {
      case "send": {
        step.fingerprint = await sendTo(alias, plan.mind_id, step.prompt);
        cursor++;
        break;
      }
      case "await": {
        const prev = steps[cursor - 1] as Extract<Step, { kind: "send" }>;
        const reply = await findReply(alias, plan.mind_id, prev.fingerprint);
        if (reply) {
          step.reply = reply.slice(0, 4000);
          cursor++;
        } else {
          waiting = true;
        }
        break;
      }
      case "judge-send": {
        const prompt = buildJudgePrompt(brief, ARCHETYPES[plan.archetype as ArchetypeKey]?.label ?? plan.archetype, examPairs(steps));
        step.fingerprint = await sendTo(jAlias, brief.judgeMindId, prompt);
        cursor++;
        break;
      }
      case "judge-await": {
        const prev = steps[cursor - 1] as Extract<Step, { kind: "judge-send" }>;
        const reply = await findReply(jAlias, brief.judgeMindId, prev.fingerprint);
        if (reply) {
          step.reply = reply.slice(0, 4000);
          const report = parseJudgeReply(reply);
          await updateTrainingSession(session.id, {
            report: report as unknown as Record<string, unknown>,
            score: report.overall,
          });
          session.report = report as unknown as Record<string, unknown>;
          cursor++;
        } else {
          waiting = true;
        }
        break;
      }
      case "send-correction": {
        const report = session.report as unknown as JudgeReport | null;
        const correction = report?.correction ?? "";
        step.fingerprint = await sendTo(
          alias,
          plan.mind_id,
          `TRAINING — correction from your examiner:\n\n${correction}\n\nAcknowledge, and restate in one sentence what you will do differently.`,
        );
        cursor++;
        break;
      }
      case "await-correction": {
        const prev = steps[cursor - 1] as Extract<Step, { kind: "send-correction" }>;
        const reply = await findReply(alias, plan.mind_id, prev.fingerprint);
        if (reply) {
          step.reply = reply.slice(0, 4000);
          cursor++;
        } else {
          waiting = true;
        }
        break;
      }
      case "done":
        break;
    }

    const finished = steps[cursor]?.kind === "done";
    await updateTrainingSession(session.id, { steps, cursor, ...(finished ? { status: "done", finished_at: new Date().toISOString() } : {}) });

    if (finished) {
      const sent = steps.filter((s) => s.kind === "send" || s.kind === "send-correction").length;
      const pts = sent * TRAINING_POINTS_PER_MESSAGE;
      const report = session.report as unknown as JudgeReport | null;
      if (report?.overall != null) {
        await updateTrainingPlan(plan.id, { last_score: report.overall });
      }
      await addPoints([
        {
          subject_email: STEWARD_EMAIL,
          subject_name: "Rovin",
          role: "steward",
          event_type: "training",
          points: pts,
          meta: { planId: plan.id, persona: plan.persona_name, mind: plan.mind_name, score: report?.overall ?? null },
        },
      ]);
    }

    return NextResponse.json({
      status: finished ? "done" : "running",
      waiting,
      cursor,
      steps,
      report: session.report,
      score: (session.report as unknown as JudgeReport | null)?.overall ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "advance error" }, { status: 500 });
  }
}
