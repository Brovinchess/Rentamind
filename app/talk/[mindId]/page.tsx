import Link from "next/link";
import { notFound } from "next/navigation";
import ChatBox from "@/components/ChatBox";
import MindAvatar from "@/components/MindAvatar";
import { getLiveMindStats, listMindsCached, trainingScore } from "@/lib/minds";

export const dynamic = "force-dynamic";

/** Steward chat room — talk to (and train) any Mind on your account, listed or not. */
export default async function TalkPage({ params }: { params: Promise<{ mindId: string }> }) {
  const { mindId } = await params;
  const owned = await listMindsCached().catch(() => []);
  const mind = owned.find((m) => m.mindId === mindId);
  if (!mind) notFound();

  const stats = await getLiveMindStats(mindId);
  const score = trainingScore({
    createdAt: mind.createdAt,
    usage30d: stats.usage30d,
    skillsCount: stats.skillsCount,
  });

  return (
    <main className="container page narrow">
      <Link href="/my-minds" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        ← Back to My Minds
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 4px", flexWrap: "wrap" }}>
        <MindAvatar seed={mind.name ?? mindId} size={52} radius={14} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>@{mind.name}</h2>
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            training room · TS {score} · balance{" "}
            {stats.balance != null ? Math.round(stats.balance).toLocaleString() : "—"} cognition
          </span>
        </div>
        {mind.isEnabled ? (
          <span className="pill pill-live"><span className="dot" /> online</span>
        ) : (
          <span className="pill pill-demo">paused</span>
        )}
      </div>

      <ChatBox
        mindId={mindId}
        starters={[
          {
            label: "Set its specialty",
            text: "From now on, you are a specialist. Here is your subject and how you should think about it: ",
          },
          {
            label: "Feed it knowledge",
            text: "Study the following material and store it in your long-term memory. Tell me the three most important things you learned: ",
          },
          {
            label: "Test it",
            text: "Based on everything you know so far, how would you respond to this scenario: ",
          },
          {
            label: "Audit its memory",
            text: "Summarize everything you currently know about your subject, and how you have been told to behave. Be specific.",
          },
        ]}
      />

      <div className="notice" style={{ marginTop: 18 }}>
        <b>Training tips:</b> feed it source material and correct its answers — everything you say
        lands in its long-term memory. Try: <i>&quot;Study this and adopt the voice…&quot;</i>, then test with
        <i> &quot;How would you react to X?&quot;</i>, then correct: <i>&quot;Closer, but you&apos;d never say Y.&quot;</i>{" "}
        Finish a session with <i>&quot;Summarize everything you now know about your subject.&quot;</i>
      </div>
    </main>
  );
}
