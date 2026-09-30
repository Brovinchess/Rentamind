import MindsNav from "@/components/MindsNav";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getStudyLog, getTrainingPlansForOwner } from "@/lib/db";
import { mindBalance } from "@/lib/mind-health";
import { getLiveMindStats, listMindsFor } from "@/lib/minds";
import StudioWizard from "@/components/StudioWizard";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=/studio");
  const [mindsList, plans] = await Promise.all([
    listMindsFor(user.accessToken).catch(() => []),
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
      ...(await getLiveMindStats(user.accessToken, p.mind_id)
        .then((st) => ({ balance: st.balance, perDay: st.runway?.perDay ?? null }))
        .catch(() => ({ balance: null, perDay: null }))),
      log: (await getStudyLog(p.id, 10).catch(() => [])).map((l) => ({
        id: l.id,
        topic: l.topic,
        reply: l.reply,
        sent_at: l.sent_at,
      })),
    })),
  );

  // Balances for the "start a new persona" picker, so the cadence slider can
  // show how many days of cognition the chosen Mind actually has. Only Minds
  // without a plan can be picked, and a plain balance call is one request each —
  // getLiveMindStats would cost five per Mind for data this list never shows.
  const planned = new Set(plans.map((p) => p.mind_id));
  const mindOpts = await Promise.all(
    mindsList
      .filter((m) => m.isEnabled && !planned.has(m.mindId))
      .map(async (m) => ({
        mindId: m.mindId,
        name: m.name ?? "unnamed",
        balance: await mindBalance(user.accessToken, m.mindId),
      })),
  );

  return (
    <main className="container page narrow">
      <MindsNav active="/studio" />
      <span className="eyebrow section-eyebrow">Training Studio</span>
      <h2 className="section-title">Set a persona. Your Mind studies it on repeat.</h2>
      <p style={{ color: "var(--muted)", maxWidth: "64ch" }}>
        Tell your Mind who to become — it then studies that persona automatically on a schedule you
        control: speech style, history, behavior, opinions, one topic per cycle, stored permanently
        in its memory. More cycles = deeper persona. Every cycle burns cognition and earns you
        training points. When it&apos;s ready, list it for rent.
      </p>

      <StudioWizard minds={mindOpts} plans={planRows} />
    </main>
  );
}
