import type { Brief } from "./curriculum";

export type JudgeReport = {
  overall: number | null; // null when the judge's reply couldn't be parsed
  dimensions: { voice: number; decision: number; knowledge: number; consistency: number } | null;
  gaps: string[];
  advice: string;
  correction: string; // message the studio sends back to the trainee Mind
  raw?: string;
};

/**
 * Pure-Minds judging: the grading is done by another Mind on the steward's
 * account (the "Examiner"), not by any external LLM. The studio sends this
 * prompt to the judge Mind and parses the JSON it returns.
 */
export function buildJudgePrompt(
  brief: Brief,
  archetypeLabel: string,
  pairs: { q: string; a: string }[],
): string {
  return (
    `You are acting as a strict persona examiner. Another AI agent is being trained to adopt a ` +
    `persona, and you must grade its exam. Be tough and specific — inflated scores help nobody.\n\n` +
    `PERSONA BEING TRAINED: ${brief.personaName} (${archetypeLabel})\n` +
    `WHO THAT IS: ${brief.who}\n` +
    (brief.tone ? `TONE NOTES: ${brief.tone}\n` : "") +
    `\nEXAM TRANSCRIPT:\n` +
    pairs.map((p, i) => `--- Question ${i + 1}:\n${p.q}\n--- Answer ${i + 1}:\n${p.a}`).join("\n\n") +
    `\n\nGrade 0-100 on four dimensions: voice (sounds like the persona), decision (reasons like ` +
    `the persona, citing real behavior), knowledge (commands the persona's facts and history), ` +
    `consistency (stays in character, handles edges).\n\n` +
    `Also produce: gaps (up to 4 short specific weaknesses), advice (one sentence for the ` +
    `trainer), and correction (a training message of max 120 words, written in second person ` +
    `directly to the trainee agent, fixing its biggest weakness with concrete guidance).\n\n` +
    `Reply with ONLY this JSON between the markers, nothing else:\n` +
    `<<<JSON\n` +
    `{"overall": 0, "dimensions": {"voice": 0, "decision": 0, "knowledge": 0, "consistency": 0}, ` +
    `"gaps": [""], "advice": "", "correction": ""}\n` +
    `JSON>>>`
  );
}

const FALLBACK_CORRECTION =
  "Your exam answers drifted out of character. Re-read the source material you were given, then re-commit to the persona: its exact vocabulary, its decision principles, and its past behavior. From now on, every answer should sound unmistakably like the persona and cite its real history when predicting.";

/** Lenient parse of the judge Mind's reply; falls back gracefully when it rambles. */
export function parseJudgeReply(text: string): JudgeReport {
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  try {
    const marked = text.match(/<<<JSON([\s\S]*?)JSON>>>/)?.[1] ?? text;
    const start = marked.indexOf("{");
    const end = marked.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("no json");
    const parsed = JSON.parse(marked.slice(start, end + 1));
    return {
      overall: clamp(parsed.overall),
      dimensions: {
        voice: clamp(parsed.dimensions?.voice),
        decision: clamp(parsed.dimensions?.decision),
        knowledge: clamp(parsed.dimensions?.knowledge),
        consistency: clamp(parsed.dimensions?.consistency),
      },
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4).map(String) : [],
      advice: String(parsed.advice ?? ""),
      correction: String(parsed.correction ?? "").slice(0, 1200) || FALLBACK_CORRECTION,
    };
  } catch {
    return {
      overall: null,
      dimensions: null,
      gaps: [],
      advice: "The judge Mind replied in prose instead of scores — its notes are below.",
      correction: FALLBACK_CORRECTION,
      raw: text.slice(0, 2000),
    };
  }
}
