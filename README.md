# 🧠 Rent a Mind

A marketplace demo built on [HelloMinds](https://hellominds.ai) (by Animoca Brands): stewards train Minds into specialists or personas, list them for rent, and renters get **direct, time-boxed access to the live trained Mind** — while both sides farm **Synapses** points toward a future airdrop.

> Current product spec: [docs/CONCEPT.md](docs/CONCEPT.md) · QA: [docs/QA-REPORT.md](docs/QA-REPORT.md)

## How it works

- **Sign in with your Builder API key** — the key is the account (validated live, stored encrypted). Every user gets their own Minds, Training Studio, listings, wallet, and points.
- **Training Studio**: describe a persona in plain words; the Mind auto-studies it on a schedule (rotating topics, web research via Tavily), stored in its permanent memory.
- **Renting**: per-message pricing through private proxied sessions (Ask / Draft / Predict modes). Renters never touch the Mind's Circle; a service envelope + injection filter keeps training trainer-only.
- **Proof-of-cognition wallet**: a renter's balance = 50% of the real cognition their own Minds hold (floor 100, cap 5,000), synced live. Spending it earns points for both sides (Season 0 → future airdrop).

## Stack

- Next.js 16 (App Router) — UI in the HelloMinds visual language
- `@animocabrands/minds-client-lib` — live Minds, balances, usage, circles, messaging (SSE/waitForReply)
- Supabase Postgres — `ram_listings`, `ram_rentals`, `ram_points_events`, `ram_ratings` (RLS on, service-role only)

## Run it

```bash
npm install
cp .env.example .env.local   # fill in your keys (see below)
# create tables: run supabase/schema.sql in your Supabase SQL editor
npm run seed                 # seed listings + leaderboard (npm run seed:fresh to wipe)
npm run dev
```

`.env.local` (never committed):

| Var | What |
|---|---|
| `MINDS_BUILDER_API_KEY` | Seed trainer's Builder key (used by scripts/seed-user.mjs) |
| `SESSION_SECRET` | Signs session cookies + encrypts stored Builder keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |


## Status

Everything is live data — no seeded content: real Minds, balances, training cycles, rentals, and points. Remaining for public scale: per-rental daily caps, ratings UI, terms/privacy, error tracking (see QA report).

Persona Minds are simulations — parody, not affiliation. Nothing here is financial or medical advice. Not an official HelloMinds product.
