import Link from "next/link";

export const metadata = { title: "Privacy Policy · Rent a Mind" };

export default function PrivacyPage() {
  return (
    <main className="container page narrow legal">
      <span className="eyebrow section-eyebrow">Legal</span>
      <h2 className="section-title">Privacy Policy</h2>
      <p className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Last updated: September 30, 2026</p>

      <h3>1. What we store</h3>
      <p>In our database (Supabase, hosted in the cloud):</p>
      <ul>
        <li><b>Account:</b> the email address and HelloMinds account id you share when you connect, and sign-in timestamps.</li>
        <li>
          <b>Your HelloMinds connection</b> — the access and refresh tokens HelloMinds issues when you
          click &ldquo;Connect with HelloMinds&rdquo;, stored <b>encrypted (AES-256-GCM)</b>. They
          are decrypted only server-side, only to do what you approved on HelloMinds&apos; consent
          screen (training, listings, rental sessions, balance reads), and are never shown to other
          users or sent anywhere except HelloMinds. They are kept server-side, not in your browser,
          so your Minds can keep training and serving renters while you&apos;re away.
        </li>
        <li><b>Marketplace data:</b> your listings, rentals, ratings, points events, wallet numbers (real-cognition snapshot, allowance, spend).</li>
        <li><b>Training data:</b> persona briefs you write, study topics, and the Minds&apos; study replies.</li>
      </ul>

      <h3>2. What we don&apos;t store</h3>
      <p>
        Chat transcripts live on <b>HelloMinds</b>, not in our database — we read them through the
        API to display your conversations. We never see or store your HelloMinds password (you sign in on HelloMinds itself), payment
        details (there are no payments), or analytics profiles. Session cookies are essential-only;
        there is no ad tracking.
      </p>

      <h3>3. Who sees what</h3>
      <ul>
        <li><b>Public:</b> your listings (title, description, price, rating), leaderboard entries (email + points), and homepage stats.</li>
        <li><b>The Mind&apos;s trainer:</b> rental conversations happen on the trainer&apos;s HelloMinds account, so a trainer can see chats renters have with their listed Mind. Don&apos;t share secrets with a rented Mind.</li>
        <li><b>Third parties we rely on:</b> HelloMinds/Animoca (all Mind operations), Supabase (database), Vercel (hosting), DiceBear (avatar images generated from names), Tavily via the Bazaar (Mind web research). Each has its own privacy policy.</li>
      </ul>

      <h3>4. Your choices</h3>
      <ul>
        <li><b>Leave:</b> press <b>Disconnect</b> on your profile. We revoke our access at HelloMinds and delete the stored tokens; your Minds stop training and can&apos;t be rented until you connect again.</li>
        <li><b>Delete:</b> ask the operator to delete your account row, listings, rentals, wallet, and points, and we will.</li>
        <li><b>Pause:</b> stop training or delist your Minds anytime; nothing runs against your account without an active connection.</li>
      </ul>

      <h3>5. Security, honestly</h3>
      <p>
        Tokens are encrypted at rest, the app only holds the permissions you approved, sessions are
        signed httpOnly cookies, the database blocks public access, and cross-account access is
        enforced server-side. This is still an experimental demo — don&apos;t use it for anything
        sensitive.
      </p>

      <p style={{ marginTop: 24 }}>
        See also the <Link href="/terms" style={{ color: "var(--brand)", fontWeight: 700 }}>Terms of Use</Link>.
      </p>
    </main>
  );
}
