import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getStudyLog, getTrainingPlansForOwner } from "@/lib/db";
import { listMindsFor } from "@/lib/minds";
import StudioWizard from "@/components/StudioWizard";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=/studio");
  const [mindsList, plans] = await Promise.all([
    listMindsFor(user.builderKey).catch(() => []),
    getTrainingPlansForOwner(user.email).catch(() => []),
  ]);
  const planRows = await Promise.all(
    plans.map(async (p) => ({
      id: p.id,
      mindId: p.mind_id,
      mindName: p.mind_name,
      personaName: p.persona_name,
      archetype: p.archetype,
      frequencyHours: p.study_frequency_hours,
      cycles: p.study_cycles,
      isStudying: p.is_studying,
      nextStudyAt: p.next_study_at,
      log: (await getStudyLog(p.id, 10).catch(() => [])).map((l) => ({
        id: l.id,
        topic: l.topic,
        reply: l.reply,
        sent_at: l.sent_at,
      })),
    })),
  );

  return (
    <main className="container page narrow">
      <span className="eyebrow section-eyebrow">Training Studio</span>
      <h2 className="section-title">Set a persona. Your Mind studies it on repeat.</h2>
      <p style={{ color: "var(--muted)", maxWidth: "64ch" }}>
        Tell your Mind who to become — it then studies that persona automatically on a schedule you
        control: speech style, history, behavior, opinions, one topic per cycle, stored permanently
        in its memory. More cycles = deeper persona. Every cycle burns cognition and earns you
        training points. When it&apos;s ready, list it for rent.
      </p>

      <StudioWizard
        minds={mindsList
          .filter((m) => m.isEnabled)
          .map((m) => ({ mindId: m.mindId, name: m.name ?? "unnamed" }))}
        plans={planRows}
      />
    </main>
  );
}
