// Seed the Rent a Mind demo database.
// Usage: node --env-file=.env.local scripts/seed.mjs [--fresh]
// --fresh wipes ram_* tables first. Default run only seeds when ram_listings is empty.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const builderKey = process.env.MINDS_BUILDER_API_KEY;
if (!url || !key) throw new Error("supabase env missing");
const db = createClient(url, key, { auth: { persistSession: false } });
const fresh = process.argv.includes("--fresh");

// ── live minds → real rentable listings ──────────────────────────────────────
let liveMinds = [];
if (builderKey) {
  const res = await fetch("https://api.build.hellominds.ai/v1/humans/" +
    JSON.parse(atob(builderKey.split(".")[1])).humanId + "/minds", {
    headers: { "X-Api-Key": builderKey },
  });
  if (res.ok) liveMinds = await res.json();
}
const byName = Object.fromEntries(liveMinds.map((m) => [m.name, m]));
const steward = { steward_email: "rovin@anichess.com", steward_name: "Rovin" };

const realListing = (name, extra) => {
  const m = byName[name];
  if (!m) return null;
  return {
    mind_id: m.mindId,
    mind_name: m.name,
    ...steward,
    is_seeded: false,
    training_score: 0, // computed live from the Builder API at render time
    ...extra,
  };
};

const realListings = [
  realListing("travisscott", {
    title: "La Flame Mind",
    tagline: "Rages like Travis. Thinks like Travis.",
    description:
      "Trained on years of interviews, lyrics, production choices and album rollouts. Ask it how Travis would market a drop, react to a headline, or what he'd say on stage. The longer it trains, the sharper the voice.",
    category: "Personas",
    tags: ["music", "culture", "marketing"],
    emoji: "mic",
    label: "PARODY",
    rate_cognition_per_day: 120,
    sample_qa: [
      { q: "How would Travis announce a surprise album this weekend?", a: "No warning. One cryptic frame on IG at 3am — a burning ferris wheel — then the pre-save link goes live at midnight. It's not a rollout, it's a sighting." },
      { q: "Would he collab with an AI producer?", a: "If it sounds like nothing else on earth? Straight up. But it has to feel raw — he'd bury the credit deep in the liner notes and let the mystery cook." },
    ],
    rating: 4.7,
    rating_count: 89,
  }),
  realListing("lebronjames", {
    title: "King James Mind",
    tagline: "Four rings of decision history in one Mind.",
    description:
      "Every career decision, presser, and fourth-quarter read, distilled. Rent it for takes on trades, legacy math, and what LeBron would actually do next. Sports desks: this is your instant columnist sparring partner.",
    category: "Sports",
    tags: ["nba", "analysis", "predictions"],
    emoji: "trophy",
    label: "PARODY",
    rate_cognition_per_day: 150,
    sample_qa: [
      { q: "Does he take a minimum deal to chase ring five?", a: "History says no — every move balanced legacy AND business. He'd take the mid-level exception structured around ownership optics before he ever takes the minimum." },
    ],
    rating: 4.8,
    rating_count: 132,
  }),
  realListing("Tiger.Wood", {
    title: "Tiger Mind",
    tagline: "Course management from 82 wins of memory.",
    description:
      "Major-by-major decision history, swing philosophy eras, and tournament strategy. Ask how Tiger would play any hole, read any leaderboard, or manage a Sunday back nine.",
    category: "Sports",
    tags: ["golf", "strategy"],
    emoji: "flag",
    label: "PARODY",
    rate_cognition_per_day: 100,
    sample_qa: [
      { q: "Driver or stinger on a 310-yard par 4 with water left?", a: "Stinger 2-iron, every time it matters. The pin position decides the second shot, not the tee shot. Water left means the miss is right, short, boring — and lethal." },
    ],
    rating: 4.6,
    rating_count: 64,
  }),
  realListing("itachi", {
    title: "Itachi Mind",
    tagline: "Strategy consulting from the shadows.",
    description:
      "A strategist persona trained on lore, tactics, and the art of the long game. Surprisingly good at product strategy and negotiation prep — it thinks three moves ahead and tells you which sacrifice you're not seeing.",
    category: "Culture",
    tags: ["anime", "strategy", "negotiation"],
    emoji: "moon",
    label: "",
    rate_cognition_per_day: 80,
    sample_qa: [
      { q: "My co-founder wants to pivot. How do I play the board meeting?", a: "Let them present first, fully. People defend hardest what they haven't finished saying. Then concede the strongest 20% of their case before you counter — the room will follow whoever looked least afraid." },
    ],
    rating: 4.9,
    rating_count: 41,
  }),
  realListing("timotheechalamet", {
    title: "Chalamet Mind",
    tagline: "Film taste you can borrow by the day.",
    description:
      "Trained on festival circuits, role choices, and a decade of film culture. Rent it for script coverage with taste, press-tour simulations, or 'would he take this role?' calls.",
    category: "Culture",
    tags: ["film", "media"],
    emoji: "film",
    label: "PARODY",
    rate_cognition_per_day: 90,
    sample_qa: [
      { q: "Biopic of a 90s tech founder — take the role?", a: "Only if the script is about the loneliness, not the keynote. He picks interiority over imitation — if the third act is a product launch, pass." },
    ],
    rating: 4.5,
    rating_count: 57,
  }),
].filter(Boolean);

// ── fictional seeded listings (marketplace depth; not rentable for real) ─────
const seeded = [
  {
    mind_id: null, mind_name: "potus45", steward_email: "labs@magamind.xyz", steward_name: "MAGAmind Labs",
    title: "POTUS45 Mind", tagline: "Predicts the next post before it's posted.",
    description: "Trained on 60k tweets, every rally transcript, four years of decisions and two campaigns. Give it a scenario — a court ruling, a market crash, a rival's gaffe — and it drafts the reaction, in the voice, with the caps lock where the caps lock would be. Simulation for research and entertainment; not affiliated with any real person.",
    category: "Personas", tags: ["politics", "prediction", "media"], emoji: "landmark", label: "PARODY",
    rate_cognition_per_day: 300, training_score: 940, rating: 4.8, rating_count: 1204, is_seeded: true,
    sample_qa: [
      { q: "Fed cuts rates 50bps tomorrow. The post?", a: "\"Jerome finally listened to me. Rates WAY down (should have been done two years ago!). The Economy will be the GREATEST in history. Thank you for your attention to this matter!\"" },
      { q: "How would he handle a debate question on AI?", a: "Pivot to strength in 15 words or less, brand the opponent as 'weak on tech', claim credit for 'the greatest AI companies in the world', land a nickname on the moderator." },
    ],
  },
  {
    mind_id: null, mind_name: "neuromind", steward_email: "vega@neurorent.io", steward_name: "Dr. Vega",
    title: "Neuro Mind", tagline: "A neurosurgery library that answers back.",
    description: "Fed 8 years of journals, case digests, and conference proceedings. Rent it to unpack surgical news, decode a paper, or prep informed questions for a specialist appointment. Informational only — it will refuse to give medical advice.",
    category: "Experts", tags: ["medicine", "research"], emoji: "stethoscope", label: "INFO ONLY",
    rate_cognition_per_day: 250, training_score: 910, rating: 4.9, rating_count: 866, is_seeded: true,
    sample_qa: [
      { q: "That new glioblastoma trial in the news — real breakthrough?", a: "Phase II, n=47, no control arm — promising signal on progression-free survival but the headline is ahead of the evidence. Here's what the endpoints actually measured, and what a Phase III would need to show…" },
    ],
  },
  {
    mind_id: null, mind_name: "whalewatch", steward_email: "ops@whalewatch.eth", steward_name: "whalewatcher.eth",
    title: "Whale Watch Mind", tagline: "It remembers every wallet you've ever wondered about.",
    description: "Eleven months of on-chain pattern training across Base, Ethereum and Solana. Ask it who's accumulating, which cluster just woke up, and what happened the last three times this exact pattern appeared.",
    category: "Trading", tags: ["crypto", "on-chain", "alerts"], emoji: "waves", label: "",
    rate_cognition_per_day: 200, training_score: 835, rating: 4.6, rating_count: 412, is_seeded: true,
    sample_qa: [
      { q: "Big $MENTE cluster moved to a CEX. Bearish?", a: "Same cluster did this twice before — both times it was OTC repositioning, not a dump: outflows returned to fresh cold wallets within 72h. Watch the return path, not the deposit." },
    ],
  },
  {
    mind_id: null, mind_name: "scoutmind", steward_email: "kenji@transferroom.ai", steward_name: "kenji.builds",
    title: "Scout Mind", tagline: "Every transfer window since 2015, on recall.",
    description: "Trained on transfer histories, tactical systems, and scouting reports. Rent during the window: it flags which rumors fit the club's actual system and which are agent noise.",
    category: "Sports", tags: ["football", "transfers", "scouting"], emoji: "target", label: "",
    rate_cognition_per_day: 110, training_score: 720, rating: 4.4, rating_count: 238, is_seeded: true,
    sample_qa: [
      { q: "Does the Osimhen-to-United rumor make sense?", a: "Not in a back-three build. His runs need a partner occupying the pivot — United's system isolates the 9. It's an agent-driven story; the profile they've actually scouted three times this season is a different archetype." },
    ],
  },
];

// ── leaderboard seed events ──────────────────────────────────────────────────
const seedPoints = [
  ["labs@magamind.xyz", "MAGAmind Labs", 48200],
  ["vega@neurorent.io", "Dr. Vega", 39750],
  ["ops@whalewatch.eth", "whalewatcher.eth", 31400],
  ["kenji@transferroom.ai", "kenji.builds", 22100],
  ["sofia@trainsminds.com", "sofia.trains", 18900],
  ["rovin@anichess.com", "Rovin", 1250],
].map(([subject_email, subject_name, points]) => ({
  subject_email, subject_name, points,
  role: "steward", event_type: "seed",
  meta: { note: "pre-season points" },
}));

// ── run ──────────────────────────────────────────────────────────────────────
if (fresh) {
  for (const t of ["ram_ratings", "ram_points_events", "ram_rentals", "ram_listings"]) {
    const { error } = await db.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`${t} wipe: ${error.message}`);
  }
  console.log("wiped ram_* tables");
}

const { count, error: cntErr } = await db.from("ram_listings").select("*", { count: "exact", head: true });
if (cntErr) throw new Error("Cannot read ram_listings — did you run supabase/schema.sql? " + cntErr.message);
if ((count ?? 0) > 0 && !fresh) {
  console.log(`ram_listings already has ${count} rows; use --fresh to reseed.`);
  process.exit(0);
}

const listings = [...realListings, ...seeded];
const { error: insErr } = await db.from("ram_listings").insert(listings);
if (insErr) throw new Error("insert listings: " + insErr.message);
const { error: ptsErr } = await db.from("ram_points_events").insert(seedPoints);
if (ptsErr) throw new Error("insert points: " + ptsErr.message);

console.log(`seeded ${listings.length} listings (${realListings.length} live, ${seeded.length} fictional) + ${seedPoints.length} leaderboard rows`);
