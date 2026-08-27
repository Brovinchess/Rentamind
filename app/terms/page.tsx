import Link from "next/link";

export const metadata = { title: "Terms of Use · Rent a Mind" };

export default function TermsPage() {
  return (
    <main className="container page narrow legal">
      <span className="eyebrow section-eyebrow">Legal</span>
      <h2 className="section-title">Terms of Use</h2>
      <p className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Last updated: August 27, 2026</p>

      <h3>1. What this is</h3>
      <p>
        Rent a Mind is an <b>experimental demo</b> built on top of the HelloMinds platform by an
        independent builder. It is <b>not an official HelloMinds or Animoca Brands product</b> and
        is not affiliated with, endorsed by, or operated by them. By using it you accept these
        terms; if you don&apos;t agree, don&apos;t use it.
      </p>

      <h3>2. Your account is your Builder key</h3>
      <p>
        You sign in with your own HelloMinds Builder API key. You are responsible for that key:
        only paste it if you understand it lets this app operate your Minds on your behalf —
        sending training messages, equipping tools, opening rental conversations, and reading
        balances. You can revoke the key at any time in the HelloMinds Builder console, which
        immediately ends this app&apos;s access. Never share your key with anyone you don&apos;t trust.
      </p>

      <h3>3. Training and renting</h3>
      <p>
        Training sends real messages to your Minds and burns their real cognition — you control
        frequency and can pause anytime. Listing a Mind lets other signed-in users rent chat
        sessions with it; their messages also burn your Mind&apos;s real cognition. You can delist at
        any time. Renters pay from a rental balance derived from their own HelloMinds holdings;
        this balance is an app-internal number and is <b>not</b> money or transferable cognition.
      </p>

      <h3>4. Personas and content</h3>
      <p>
        Persona Minds (including those imitating real public figures) are <b>parody and
        simulation</b>, not statements by or affiliation with any real person or rights holder.
        Don&apos;t use the app to harass, defame, or impersonate private individuals, or to train or
        request illegal content. Mind outputs are AI-generated and can be wrong —{" "}
        <b>nothing here is financial, medical, or legal advice</b>. We may remove listings or
        suspend accounts that break these rules.
      </p>

      <h3>5. Points</h3>
      <p>
        Points are a Season 0 experiment. They have <b>no monetary value</b>, are not a security,
        token, or promise of any future airdrop, reward, or payment, and can be adjusted, reset,
        or discontinued at any time — including corrections for farming or abuse.
      </p>

      <h3>6. No warranties, limited liability</h3>
      <p>
        The service is provided <b>as is</b>, with no uptime, accuracy, or fitness guarantees. To
        the maximum extent allowed by law, the operator is not liable for lost cognition, lost
        points, Mind behavior, downtime, or any indirect damages. Your use of HelloMinds itself is
        governed by HelloMinds&apos; own terms.
      </p>

      <h3>7. Changes</h3>
      <p>
        These terms may change as the product evolves; the &quot;last updated&quot; date above will move
        when they do. Continued use after a change means you accept it.
      </p>

      <p style={{ marginTop: 24 }}>
        Questions? See the <Link href="/privacy" style={{ color: "var(--brand)", fontWeight: 700 }}>Privacy Policy</Link> or
        reach the operator via the project repository.
      </p>
    </main>
  );
}
