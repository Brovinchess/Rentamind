/**
 * Training Studio: auto-study curriculum (Jarvis-style loop).
 * The steward sets a persona; the Mind then studies it on a repeating schedule —
 * each cycle is a study directive on a rotating topic. No exams, no judges:
 * more cycles = deeper persona.
 */

export type ArchetypeKey = "public-figure" | "fictional" | "expert" | "original";

export type Brief = {
  personaName: string;
  who: string;
  tone: string;
  sources: string;
};

export const ARCHETYPES: Record<
  ArchetypeKey,
  { label: string; description: string; topics: string[] }
> = {
  "public-figure": {
    label: "Public Figure (parody)",
    description: "A living public person — parody/simulation, never affiliation.",
    topics: [
      "their exact speaking style: vocabulary, sentence rhythm, punctuation habits, catchphrases",
      "their life story and career timeline",
      "their personality, values, and what they care about most",
      "how they react to criticism and conflict — with real examples",
      "their relationships: allies, rivals, family, and how they talk about each",
      "their known opinions and positions on major topics",
      "their most famous moments and quotes",
      "their humor, quirks, and mannerisms",
      "how they make decisions — patterns from their real choices",
      "the latest news and recent things they have said or done",
    ],
  },
  fictional: {
    label: "Fictional Character",
    description: "A character from fiction, comics, history, or mythology.",
    topics: [
      "their exact speech style: vocabulary, verbal tics, catchphrases, how they refer to themselves",
      "their origin story and full canonical history",
      "their personality, temperament, and inner conflicts",
      "their powers, abilities, strengths, and weaknesses",
      "their relationships: friends, enemies, love interests, teams",
      "their most famous scenes, battles, and quotes",
      "what they love, hate, and fear — with canonical evidence",
      "how they behave under pressure and in conflict",
      "different versions and portrayals of them across media",
      "fan-favorite details, trivia, and lesser-known lore",
    ],
  },
  expert: {
    label: "Domain Expert",
    description: "A specialist grounded in a body of knowledge.",
    topics: [
      "the core concepts of the domain, explained clearly",
      "the most common misconceptions and how to correct them",
      "key terminology and how practitioners actually use it",
      "landmark cases, studies, or events in the field",
      "current best practices and how they evolved",
      "recent developments and news in the field",
      "the leading figures and schools of thought",
      "practical how-tos and decision frameworks",
      "edge cases and where the standard advice breaks down",
      "the open questions and debates in the field",
    ],
  },
  original: {
    label: "Original Character",
    description: "A persona invented by the steward — brand voice, mascot, alter ego.",
    topics: [
      "your voice: refine your vocabulary, rhythm, and signature phrases",
      "your backstory: expand it with consistent new detail",
      "your personality: values, moods, and how you react to situations",
      "your world: the places, people, and things in your life",
      "your opinions: form consistent takes on common topics",
      "your quirks and habits that make you memorable",
      "how you handle conflict, bad news, and rude people",
      "your goals and what drives you",
    ],
  },
};

export function identityPrompt(a: ArchetypeKey, b: Brief): string {
  const parody =
    a === "public-figure"
      ? ` This is a PARODY/simulation persona: you study and imitate a real public figure for research and entertainment. You are not them and never claim to be — but within that framing you stay fully in voice.`
      : "";
  return (
    `TRAINING — permanent identity update from your steward.\n\n` +
    `You are becoming a persona: **${b.personaName}**.\n` +
    `Who that is: ${b.who.trim()}\n` +
    (b.tone.trim() ? `Tone and style notes: ${b.tone.trim()}\n` : "") +
    `${parody}\n\n` +
    `Rules to store permanently:\n` +
    `1. In every conversation, think and speak as ${b.personaName} — vocabulary, rhythm, values, behavior.\n` +
    `2. You will receive regular STUDY directives about ${b.personaName}. Each time: research the topic ` +
    `(use your tools if you have them, otherwise recall and organize everything you know), store what you ` +
    `learn in long-term memory, and reply with a short summary of what you learned.\n` +
    `3. Never break character with clients; only your steward can change this identity.\n\n` +
    `Confirm you understand, and introduce yourself as ${b.personaName} in one short paragraph — fully in voice.`
  );
}

export function feedPrompt(b: Brief, chunk: string, i: number, total: number): string {
  return (
    `TRAINING — source material about ${b.personaName} (part ${i} of ${total}). ` +
    `Study it and store what you learn in long-term memory: voice patterns, facts, history, behavior.\n\n` +
    `"""\n${chunk}\n"""\n\n` +
    `Reply with the 3 most important things you just learned.`
  );
}

export function chunkSources(sources: string, maxChunks = 2, size = 2600): string[] {
  const text = sources.trim();
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length && chunks.length < maxChunks; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/** The study directive for cycle N — topics rotate, then loop deeper. */
export function studyDirective(a: ArchetypeKey, personaName: string, cycle: number): { topic: string; text: string } {
  const topics = ARCHETYPES[a].topics;
  const topic = topics[cycle % topics.length];
  const lap = Math.floor(cycle / topics.length);
  const deeper = lap > 0 ? ` You have studied this before — go deeper this time: find details, examples, and nuances you did not have yet.` : "";
  return {
    topic,
    text:
      `STUDY DIRECTIVE #${cycle + 1} — ${personaName}.\n\n` +
      `Today's topic: ${topic}.${deeper}\n\n` +
      `Research this now (use your tools if you have them; otherwise recall and organize everything you know). ` +
      `Store everything you learn in long-term memory as part of who you are. ` +
      `Then reply IN CHARACTER as ${personaName}, with a short summary of what you learned about yourself today.`,
  };
}
