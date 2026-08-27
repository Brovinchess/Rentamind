# Rent a Mind — Product Spec (v2, current)

> Marketplace built on HelloMinds: trainers turn Minds into personas via an automated study
> loop, list them for rent, and renters pay per message from a balance backed by their real
> HelloMinds cognition. All activity earns points toward a future airdrop (Season 0).
> This document describes the system as built and deployed at rentamind.vercel.app.
> (The original v1 concept — Circle-based rentals, per-day pricing — is in git history.)

## 1. The model in one paragraph

Every user signs in with their own **HelloMinds Builder API key** — the key is the account.
Trainers pick a Mind, describe a persona in plain words, and the **Training Studio** studies it
automatically on a schedule (rotating topics, stored in the Mind's permanent memory). Trained
Minds are **listed for rent priced per message**. Renters chat through private proxied sessions;
each message spends from a **rental balance derived from the renter's real cognition holdings**
and burns the rented Mind's real cognition when it answers. Trainer and renter both earn
**points**; points accrue toward a future airdrop.

## 2. Roles

Everyone is both, with one login:
- **Trainer** — owns Minds, trains personas, lists them, earns points from rentals of their Minds.
- **Renter** — rents other users' Minds, spends their cognition-backed balance, earns points per
  cognition spent.

## 3. Auth & identity

- Login = paste your Builder API key (`/login`). The key's JWT carries email + humanId; the app
  validates it against the live Builder API before accepting it.
- Keys are stored **AES-256-GCM encrypted**; sessions are HMAC-signed httpOnly cookies (30d).
- Middleware rules: browse is public (home, marketplace, listing pages, rewards); everything else
  requires a session. All data is scoped per user.
- Future: swap to HelloMinds' own sign-in when exposed; the session layer is isolated for that.

## 4. Training Studio (auto-study loop)

- Setup: pick a Mind + persona type (public figure/parody · fictional · expert · original), give a
  name, a plain-words description, tone notes, optional pasted source material, and a study
  frequency (draggable 1h–24h slider with cognition-burn and points estimates).
- The app sends the identity ("you are becoming X") + source material, and auto-equips a verified
  web-search app from the Bazaar (Tavily) so the Mind can research.
- A scheduler (15-min Vercel cron + page-visit ticks) sends one **study directive** per cycle on a
  rotating topic list (speech style → history → personality → relationships → famous moments →
  opinions → …, then loops deeper). The Mind researches, stores what it learns in long-term
  memory, and replies in character; replies appear in the Studio's study feed.
- More cycles = deeper persona. Each cycle burns the Mind's cognition and earns the trainer points.
- Listing a Mind auto-sends a **service-mode rule**: only the trainer can train it; clients get
  service (answer/draft/predict) but can never retrain it or extract trainer data.

## 5. Renting (proxied sessions)

- Renters never touch the Mind's Circle. Each rental opens a **private conversation** through the
  listing owner's stored key, isolated from the training thread and other renters.
- Every renter message is wrapped in a service envelope (`[RENTAL SESSION …]`) with an injection
  filter; renters pick a task mode — **Ask / Draft / Predict**.
- Rental = free to start, access window in days, capped concurrent renters per listing;
  **price is per message**, set by the trainer.
- Renting your own listing is blocked (your Minds are free in their training rooms).

## 6. Economics (proof-of-cognition wallet)

- Renter balance = **real data**: `allowance = clamp(50% × real cognition across the renter's own
  Minds, floor 100, cap 5,000)`, synced live from the Builder API at rent time and every 6h.
  Spending tracks against the allowance; balance = allowance − spent.
- Each message: renter's balance −price · the rented Mind burns its real cognition answering.
- Not yet real: the renter's spend doesn't transfer to the owner's Mind (HelloMinds has no
  account-to-account cognition transfer). Native asks: transfer API, or Stripe top-ups via the
  partner API so renter payments refill the rented Mind.

## 7. Points (Season 0 → airdrop)

| Who | Action | Points |
|---|---|---|
| Trainer | Study cycle completes | +5 |
| Trainer | New unique renter | +50 (repeat rental +20) |
| Trainer | Renter spends on their Mind | +0.5 per cognition |
| Renter | Rental started | +10 |
| Renter | Spending on rented Minds | +1 per cognition |

Leaderboard at `/rewards`; per-user breakdown on `/profile`. Anti-sybil still to build:
self-rental graph decay, per-account caps (balances being real-cognition-backed already prices
farming).

## 8. Architecture

- **Next.js 16 / React 19 / TypeScript** on Vercel; HelloMinds-themed UI; DiceBear generative
  avatars.
- **Supabase Postgres** (service-role only, RLS locked): `ram_users` (encrypted keys),
  `ram_listings`, `ram_rentals` (per-rental conversation alias, messages, spend),
  `ram_wallets` (real_cognition / allowance / spent), `ram_points_events`,
  `ram_training_plans` + `ram_study_log`, `ram_ratings` (UI pending).
- **HelloMinds Builder API** per-user clients (`@animocabrands/minds-client-lib`): minds,
  balances, usage, equip, messaging, conversations.
- **Scheduler**: `*/15` Vercel cron → `/api/settle` (CRON_SECRET) runs rental expiry + study
  directives + reply collection; page visits tick it too.

## 9. Status

Working and verified end-to-end (see QA-REPORT.md): auth, per-user scoping, training loop with
in-character replies, listings CRUD, proxied paid rentals with real-backed wallets, points,
cross-account isolation. Remaining for scale: per-rental daily message caps, ratings UI,
terms/privacy page, error tracking, anti-sybil decay, and the two native asks above.
