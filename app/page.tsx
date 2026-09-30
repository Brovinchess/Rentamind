import Link from "next/link";
import { ArrowRight, BookOpen, Coins, Rocket, Sparkles, Store } from "lucide-react";
import MindAvatar from "@/components/MindAvatar";
import { getAllPointsEvents, getListings, getStudyLog, getTrainingPlans } from "@/lib/db";

export const dynamic = "force-dynamic";

const JOURNEY = [
  {
    icon: Rocket,
    step: "01",
    title: "Launch a Mind",
    body: "Pick what it should be good at, claim a name we check live against HelloMinds, and awaken it.",
    href: "/launch",
    cta: "Launch",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Give it skills",
    body: "Equip abilities from the Bazaar — research, markets, calendars. Nearly 4,000 to choose from.",
    href: "/skills",
    cta: "Bazaar",
  },
  {
    icon: BookOpen,
    step: "03",
    title: "Train a persona",
    body: "Tell it who to become. It studies on repeat — speech, history, behavior — and every cycle earns you points.",
    href: "/studio",
    cta: "Training Studio",
  },
  {
    icon: Store,
    step: "04",
    title: "Rent it out",
    body: "List it on the marketplace. Renters pay cognition per message; every rental earns you points.",
    href: "/my-minds",
    cta: "My Minds",
  },
  {
    icon: Coins,
    step: "05",
    title: "Farm rewards",
    body: "All activity — training, renting out, renting — accrues points toward a future airdrop.",
    href: "/rewards",
    cta: "Rewards",
  },
];

const EARN = [
  { k: "Train", v: "+5", unit: "per study cycle", d: "Your Mind studies its persona on your schedule — every cycle spends cognition and pays." },
  { k: "Get rented", v: "+0.5", unit: "per cognition spent on you", d: "Earn a share of every cognition renters spend on your Mind, plus a bonus for each new paying renter." },
  { k: "Rent", v: "+1", unit: "per cognition spent", d: "Renting other people's Minds farms points too. Points are backed by real cognition spent — no free clicks." },
];

export default async function Home() {
  const [listings, plans, events] = await Promise.all([
    getListings().catch(() => []),
    getTrainingPlans().catch(() => []),
    getAllPointsEvents().catch(() => []),
  ]);

  const stats = [
    { k: "Minds in training", v: String(plans.length) },
    { k: "Study cycles run", v: String(plans.reduce((s, p) => s + p.study_cycles, 0)) },
    { k: "Minds for rent", v: String(listings.length) },
    { k: "Points issued", v: Math.round(events.reduce((s, e) => s + Number(e.points), 0)).toLocaleString() },
  ];

  // Live showcase: personas in training, quoted in character.
  //
  // Past ~80 study cycles Minds start narrating the training loop itself
  // ("STUDY DIRECTIVE #162 received!") instead of speaking as the persona — see
  // the meta-drift note in docs/QA-REPORT.md. Those replies are true but make
  // terrible shop-window copy, so we skip them and show the most recent reply
  // that actually reads in character. If a persona has none, it shows no quote.
  const META_CHATTER = /study directive|directive #|#\d{2,}|cycle \d+|go deeper|\breceived\b|\bv\d+\b/i;

  /** Catches the other failure mode: a word looping ("substrate under substrate under…"). */
  const isRepetitive = (s: string) => {
    const words = s.toLowerCase().match(/[a-z']{4,}/g) ?? [];
    if (words.length < 8) return false;
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    return [...counts.values()].some((n) => n >= 4);
  };

  const showcase = (
    await Promise.all(
      plans.slice(0, 3).map(async (p) => {
        const log = await getStudyLog(p.id, 12).catch(() => []);
        const inCharacter = log.find(
          (l) => l.reply && !META_CHATTER.test(l.reply) && !isRepetitive(l.reply),
        );
        return {
          id: p.id,
          persona: p.persona_name,
          mind: p.mind_name,
          cycles: p.study_cycles,
          quote: inCharacter?.reply?.replace(/\s+/g, " ").slice(0, 150) ?? null,
        };
      }),
    )
  ).filter(Boolean);

  const mosaicSeeds = [
    ...plans.map((p) => p.persona_name),
    ...listings.map((l) => l.mind_name),
    "odyssey", "spiderman", "itachi", "jimmy", "sun-tzu", "athena",
  ].slice(0, 9);
  while (mosaicSeeds.length < 9) mosaicSeeds.push(`mind-${mosaicSeeds.length}`);

  return (
    <main>
      {/* ── hero ── */}
      <div className="hero hero-landing">
        <div className="container hero-split">
          <div>
            <span className="eyebrow">Season 0 · points toward a future airdrop</span>
            <h1>Train a Mind. Rent it out. Farm rewards.</h1>
            <p>
              Turn a HelloMinds Mind into a persona anyone would pay to talk to — it studies
              automatically until it thinks and talks like the real thing. Renters pay cognition
              per message, and every bit of activity earns points.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/marketplace" className="btn btn-primary">Browse Minds for rent</Link>
              <Link href="/studio" className="btn btn-hero-ghost">Start training yours</Link>
            </div>
            <div className="stat-row">
              {stats.map((s) => (
                <div key={s.k} className="hero-stat">
                  <div className="v">{s.v}</div>
                  <div className="k">{s.k}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mosaic" aria-hidden>
            {mosaicSeeds.map((seed, i) => (
              <div key={i} className={`mosaic-tile t${i % 3}`}>
                <MindAvatar seed={seed} size={92} radius={18} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── live personas showcase ── */}
      {showcase.some((s) => s.quote) ? (
        <section className="page container" style={{ paddingBottom: 24 }}>
          <span className="eyebrow section-eyebrow">Live right now</span>
          <h2 className="section-title">Personas in training, speaking for themselves</h2>
          <div className="grid">
            {showcase.map((s) => (
              <div className="card showcase-card" key={s.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <MindAvatar seed={s.persona} size={52} radius={14} />
                  <div>
                    <b>{s.persona}</b>
                    <div className="mono" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                      @{s.mind} · {s.cycles} study cycles
                    </div>
                  </div>
                </div>
                {s.quote ? <p className="showcase-quote">“{s.quote}…”</p> : null}
                <Link href="/studio" className="mono showcase-link">watch it train →</Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── journey ── */}
      <section className="page container" style={{ paddingTop: 24 }}>
        <span className="eyebrow section-eyebrow">The journey</span>
        <h2 className="section-title">Five steps, all of them earn</h2>
        <div className="stepper">
          {JOURNEY.map((s, i) => (
            <div className="card step-card" key={s.title}>
              <div className="step-head">
                <span className="step-num mono">{s.step}</span>
                <s.icon size={20} aria-hidden />
              </div>
              <b>{s.title}</b>
              <p>{s.body}</p>
              <Link href={s.href} className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }}>
                {s.cta} <ArrowRight size={13} aria-hidden />
              </Link>
              {i < JOURNEY.length - 1 ? <div className="step-arrow" aria-hidden><ArrowRight size={18} /></div> : null}
            </div>
          ))}
        </div>
      </section>

      {/* ── earn model ── */}
      <section className="earn-band">
        <div className="container">
          <span className="eyebrow">How points add up</span>
          <div className="earn-grid">
            {EARN.map((e) => (
              <div key={e.k} className="earn-card">
                <div className="mono earn-k">{e.k}</div>
                <div className="earn-v">{e.v} <small>{e.unit}</small></div>
                <p>{e.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="page container" style={{ textAlign: "center" }}>
        <h2 className="section-title" style={{ fontSize: "1.7rem" }}>Ready to meet the Minds?</h2>
        <p style={{ color: "var(--muted)", maxWidth: "48ch", margin: "0 auto 20px" }}>
          Rent a trained persona in one minute — your rental balance comes from your real cognition — or start
          training your own.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/marketplace" className="btn btn-primary">Browse the Marketplace</Link>
          <Link href="/launch" className="btn btn-outline">Launch a Mind</Link>
        </div>
        <p className="mono" style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: 22 }}>
          Every Mind runs on cognition. We show you how many days each one has left before it goes
          quiet — on your dashboard, on its listing, and on the training slider.
        </p>
      </section>
    </main>
  );
}
