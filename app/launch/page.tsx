import Link from "next/link";
import LaunchFlow from "@/components/LaunchFlow";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Awaken it",
    body: "Create the Mind on HelloMinds — pick a one-click template or build your own with a name and personality. Takes under a minute; no wallet needed.",
  },
  {
    title: "Train it",
    body: "Open its training room here and start feeding it: source material, test questions, corrections. Everything lands in its permanent long-term memory.",
  },
  {
    title: "List it",
    body: "When it answers like the specialist you imagined, list it on the Mindshelf with a per-message price. Renters get private sessions with it, and every message they pay for earns you points.",
  },
];

export default function LaunchPage() {
  return (
    <main className="container page narrow">
      <span className="eyebrow section-eyebrow">Launch a Mind</span>
      <h2 className="section-title">From zero to rentable specialist</h2>

      <ol className="journey" style={{ marginBottom: 22 }}>
        {STEPS.map((s) => (
          <li key={s.title}>
            <b>{s.title}</b>
            <div className="sub">{s.body}</div>
          </li>
        ))}
      </ol>

      <LaunchFlow />

      <div className="notice" style={{ marginTop: 24 }}>
        <b>Why step 1 leaves the app:</b> awakening a Mind is a platform action that the public
        Builder API doesn&apos;t expose yet — it lives on the partner API
        (<span className="mono">POST /v1/ui/minds/awaken-one-click</span>). With a partner key,
        this whole flow happens in-app: pick an archetype, name it, awakened right here. That&apos;s a
        one-endpoint native ask for the HelloMinds team.
      </div>

      <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
        Already have Minds? They&apos;re all in your <Link href="/my-minds" style={{ color: "var(--brand)", fontWeight: 700 }}>My Minds</Link> with
        a training room each.
      </p>
    </main>
  );
}
