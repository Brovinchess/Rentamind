import { getTrainingPlans, getSessionsForPlan } from "@/lib/db";
import { listMindsCached } from "@/lib/minds";
import StudioWizard from "@/components/StudioWizard";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const [mindsList, plans] = await Promise.all([
    listMindsCached().catch(() => []),
    getTrainingPlans().catch(() => []),
  ]);
  const plansWithScores = await Promise.all(
    plans.map(async (p) => {
      const sessions = await getSessionsForPlan(p.id).catch(() => []);
      return {
        id: p.id,
        mindName: p.mind_name,
        personaName: p.persona_name,
        archetype: p.archetype,
        lastScore: p.last_score != null ? Number(p.last_score) : null,
        sessionCount: sessions.length,
        latestSessionId: sessions[0]?.id ?? null,
        latestStatus: sessions[0]?.status ?? null,
      };
    }),
  );

  return (
    <main className="container page narrow">
      <span className="eyebrow section-eyebrow">Training Studio</span>
      <h2 className="section-title">Train a persona without being a prompter</h2>
      <p style={{ color: "var(--muted)", maxWidth: "64ch" }}>
        Pick a Mind, describe the persona, paste some source material — the Studio runs the whole
        training session for you: identity, knowledge feeds, a three-question exam graded by one of
        your other Minds, and a correction. Every message burns cognition and earns you training
        points. Run more sessions to push the score up.
      </p>

      <StudioWizard
        minds={mindsList
          .filter((m) => m.isEnabled)
          .map((m) => ({ mindId: m.mindId, name: m.name ?? "unnamed" }))}
        plans={plansWithScores}
      />
    </main>
  );
}
