import MindsNav from "@/components/MindsNav";
import Link from "next/link";
import LaunchFlow from "@/components/LaunchFlow";

export const dynamic = "force-dynamic";

export default function LaunchPage() {
  return (
    <main className="container page narrow">
      <MindsNav active="/launch" />
      <span className="eyebrow section-eyebrow">Launch a Mind</span>
      <h2 className="section-title">From zero to rentable specialist</h2>
      <p style={{ color: "var(--muted)", maxWidth: "64ch", marginTop: -8 }}>
        Pick what your Mind should be good at, claim its name, and awaken it. The role catalog and
        the name check below are live from HelloMinds, so the name you pick here is the name you get.
      </p>

      <LaunchFlow />

      <div className="notice" style={{ marginTop: 24 }}>
        <b>Why awakening opens HelloMinds:</b> creating a Mind is the one action no key we can hold
        performs. It lives on the Core API (<span className="mono">POST /v1/minds/awaken</span>),
        which only accepts a HelloMinds user session. Everything either side of
        it happens here.
      </div>

      <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
        Already have Minds? They&apos;re all in{" "}
        <Link href="/my-minds" style={{ color: "var(--brand)", fontWeight: 700 }}>My Minds</Link>, and{" "}
        <Link href="/studio" style={{ color: "var(--brand)", fontWeight: 700 }}>Training Studio</Link> is
        where you give one a persona.
      </p>
    </main>
  );
}
