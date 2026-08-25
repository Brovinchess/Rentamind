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
  }),
].filter(Boolean);

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

const listings = realListings;
const { error: insErr } = await db.from("ram_listings").insert(listings);
if (insErr) throw new Error("insert listings: " + insErr.message);

console.log(`seeded ${listings.length} live listings (real Minds only)`);
