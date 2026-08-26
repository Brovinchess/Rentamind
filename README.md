# 🧠 Rent a Mind

A marketplace demo built on [HelloMinds](https://hellominds.ai) (by Animoca Brands): stewards train Minds into specialists or personas, list them for rent, and renters get **direct, time-boxed access to the live trained Mind** — while both sides farm **Synapses** points toward a future airdrop.

> Concept + full product spec: [docs/CONCEPT.md](docs/CONCEPT.md)

## How it works

- **Renting = a real Circle grant.** Checkout adds the renter's email to the Mind's Circle via the HelloMinds Builder API; expiry removes it. The renter talks to the actual Mind on web chat, email, or Telegram.
- **Rentals settle in Cognition.** The rental payment is a cognition top-up to the rented Mind (simulated checkout in this demo; native per-Mind Stripe top-up in production).
- **Synapses are burn-backed.** Training activity, rental supply, and renter usage all earn points; a settlement pass meters real cognition burned during rental windows.

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


## Demo scope

Live: steward dashboard (real Minds, balances, 30-day burn, Training Scores), listing detail stats, **real circle add/remove on rent/expiry**, live chat with rented Minds, usage-metered Synapses settlement. Seeded: fictional listings (POTUS45, Neuro, Whale Watch, Scout), leaderboard rivals, ratings.

Persona Minds are simulations — parody, not affiliation. Nothing here is financial or medical advice. Not an official HelloMinds product.
