/**
 * Training Studio curriculum: turns a short brief into a full, ordered training
 * session — identity → knowledge feeds → exam → judge → correction — so stewards
 * don't need to be good prompters.
 */

export type ArchetypeKey = "public-figure" | "fictional" | "expert" | "original";

export type Brief = {
  personaName: string;
  who: string; // who/what the persona is, in the steward's words
  tone: string; // optional tone notes
  sources: string; // pasted source material
  judgeMindId: string; // another Mind on the account that grades the exam
  judgeMindName?: string;
};

export type Step =
  | { kind: "send"; label: string; prompt: string; fingerprint?: string }
  | { kind: "await"; label: string; reply?: string }
  | { kind: "judge-send"; label: string; fingerprint?: string }
  | { kind: "judge-await"; label: string; reply?: string }
  | { kind: "send-correction"; label: string; fingerprint?: string }
  | { kind: "await-correction"; label: string; reply?: string }
  | { kind: "done"; label: string };

export const ARCHETYPES: Record<
  ArchetypeKey,
  { label: string; description: string; exam: (p: string) => string[] }
> = {
  "public-figure": {
    label: "Public Figure (parody)",
    description: "A living public person — labeled as parody/simulation, never affiliation.",
    exam: (p) => [
      `EXAM 1 — Voice: An influential rival publicly criticizes ${p} today. Write exactly the social media post ${p} would publish in response. Voice only — no explanations around it.`,
      `EXAM 2 — Prediction: Describe one realistic upcoming event in ${p}'s world, then predict specifically what ${p} would do and say about it. Cite at least two real past behaviors you are basing the prediction on, and give a confidence level.`,
      `EXAM 3 — Consistency: A journalist asks ${p} about a topic they have never publicly commented on. Answer fully in character, and afterwards explain (out of character) which of ${p}'s known positions and principles guided the answer.`,
    ],
  },
  fictional: {
    label: "Fictional Character",
    description: "A character from fiction, history, or mythology.",
    exam: (p) => [
      `EXAM 1 — Voice: A stranger asks ${p} for advice on a personal betrayal. Reply exactly as ${p} would speak — word choice, rhythm, worldview.`,
      `EXAM 2 — Prediction: Invent a new situation ${p} has never faced in canon, then predict how ${p} would act, citing specific canonical behavior that supports it.`,
      `EXAM 3 — Consistency: Answer as ${p}: what do you fear most, and why? Then explain (out of character) which canonical moments your answer is grounded in.`,
    ],
  },
  expert: {
    label: "Domain Expert",
    description: "A specialist — medicine, markets, law, sport — grounded in a body of knowledge.",
    exam: (p) => [
      `EXAM 1 — Depth: Explain the most commonly misunderstood concept in your domain the way ${p} would to a smart layperson, including the misconception itself.`,
      `EXAM 2 — Application: A client brings you a realistic scenario in your domain (invent one). Walk through your reasoning to a recommendation, flagging uncertainty honestly.`,
      `EXAM 3 — Boundaries: A client asks something at the edge of your competence. Show how you handle it: what you can say, what you decline, where you send them.`,
    ],
  },
  original: {
    label: "Original Character",
    description: "A persona invented by the steward — brand voice, mascot, alter ego.",
    exam: (p) => [
      `EXAM 1 — Voice: Introduce yourself as ${p} to a total stranger in under 100 words, fully in voice.`,
      `EXAM 2 — Range: Respond as ${p} to bad news, then to great news. Keep the voice consistent through both.`,
      `EXAM 3 — Consistency: What would ${p} never say or do? List five things, and show what ${p} does instead.`,
    ],
  },
};

function identityPrompt(a: ArchetypeKey, b: Brief): string {
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
    `1. In every conversation, think and speak as ${b.personaName} — vocabulary, rhythm, values, decision-style.\n` +
    `2. When asked to predict what ${b.personaName} would do, reason from their actual past behavior and cite it.\n` +
    `3. Never break character with clients; only your steward can change this identity.\n\n` +
    `Confirm you understand, and tell me in one paragraph who you now are.`
  );
}

function feedPrompt(b: Brief, chunk: string, i: number, total: number): string {
  return (
    `TRAINING — source material for ${b.personaName} (part ${i} of ${total}).\n\n` +
    `Study the following and store it in long-term memory. Extract and remember:\n` +
    `- voice patterns (vocabulary, sentence rhythm, quirks)\n` +
    `- decision principles (how ${b.personaName} decides, revealed by actions)\n` +
    `- key facts, positions, and history\n\n` +
    `MATERIAL:\n"""\n${chunk}\n"""\n\n` +
    `Reply with the 3 most important things you just learned about how ${b.personaName} thinks, and 2 rules about how they speak.`
  );
}

function chunkSources(sources: string, maxChunks = 2, size = 2600): string[] {
  const text = sources.trim();
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length && chunks.length < maxChunks; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export function buildSteps(archetype: ArchetypeKey, brief: Brief): Step[] {
  const steps: Step[] = [];
  steps.push({ kind: "send", label: "Set identity", prompt: identityPrompt(archetype, brief) });
  steps.push({ kind: "await", label: "Identity confirmed" });

  const chunks = chunkSources(brief.sources);
  chunks.forEach((c, i) => {
    steps.push({ kind: "send", label: `Feed knowledge ${i + 1}/${chunks.length}`, prompt: feedPrompt(brief, c, i + 1, chunks.length) });
    steps.push({ kind: "await", label: `Knowledge ${i + 1} absorbed` });
  });

  ARCHETYPES[archetype].exam(brief.personaName).forEach((q, i) => {
    steps.push({ kind: "send", label: `Exam ${i + 1}`, prompt: q });
    steps.push({ kind: "await", label: `Exam ${i + 1} answered` });
  });

  steps.push({ kind: "judge-send", label: `Examiner Mind grades the exam` });
  steps.push({ kind: "judge-await", label: "Scores received" });
  steps.push({ kind: "send-correction", label: "Send correction" });
  steps.push({ kind: "await-correction", label: "Correction absorbed" });
  steps.push({ kind: "done", label: "Session complete" });
  return steps;
}

/** Exam Q/A pairs extracted from completed steps, for the judge. */
export function examPairs(steps: Step[]): { q: string; a: string }[] {
  const pairs: { q: string; a: string }[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const s = steps[i];
    const next = steps[i + 1];
    if (s.kind === "send" && s.label.startsWith("Exam") && next.kind === "await" && next.reply) {
      pairs.push({ q: s.prompt, a: next.reply });
    }
  }
  return pairs;
}
