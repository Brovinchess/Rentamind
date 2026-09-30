import MindsNav from "@/components/MindsNav";
import { redirect } from "next/navigation";
import SkillBrowser from "@/components/SkillBrowser";
import { getAuthedUser } from "@/lib/auth";
import { bazaarStats } from "@/lib/core-api";
import { listMindsFor } from "@/lib/minds";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=/skills");

  const [minds, stats] = await Promise.all([
    listMindsFor(user.accessToken).catch(() => []),
    bazaarStats(),
  ]);
  const opts = minds
    .filter((m) => m.isEnabled)
    .map((m) => ({ mindId: m.mindId, name: m.name ?? "unnamed" }));

  return (
    <main className="container page">
      <MindsNav active="/skills" />
      <span className="eyebrow section-eyebrow">Bazaar</span>
      <h2 className="section-title">Give your Mind new abilities</h2>
      <p style={{ color: "var(--muted)", maxWidth: "64ch", marginTop: -8 }}>
        Skills are what a Mind can actually <i>do</i> — research the web, read a calendar, analyse a
        market. A Mind with the right skills answers renters better, earns higher ratings, and is
        worth more per message.
        {stats ? (
          <>
            {" "}
            The catalog has <b>{stats.mindSkills.toLocaleString()}</b> skills and{" "}
            <b>{stats.mindTools.toLocaleString()}</b> tools right now.
          </>
        ) : null}
      </p>

      {!opts.length ? (
        <div className="empty">
          You have no online Minds yet — launch one first, then come back and kit it out.
        </div>
      ) : (
        <SkillBrowser minds={opts} />
      )}
    </main>
  );
}
