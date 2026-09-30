# Rent a Mind — Product Spec (v2, current)

> Marketplace built on HelloMinds: trainers turn Minds into personas via an automated study
> loop, list them for rent, and renters pay per message from a balance backed by their real
> HelloMinds cognition. All activity earns points toward a future airdrop (Season 0).
> This document describes the system as built and deployed at rentamind.vercel.app.
> (The original v1 concept — Circle-based rentals, per-day pricing — is in git history.)

## 1. The model in one paragraph

Every user signs in with **Connect with HelloMinds** (OAuth) — their HelloMinds account is the account.
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

- **Sign-in is "Connect with HelloMinds"** — OAuth 2.1 + PKCE via `@animocabrands/minds-connect`
  (published Sep 23, 2026). The user signs in and approves permissions on HelloMinds itself; we
  never see their password. Builder-key login has been removed entirely.
- **The server owns the OAuth session (BFF), not the browser.** The SDK assumes the page keeps the
  token fresh, but most of this app runs while the owner is away — the study loop, and renters
  chatting through the owner's Mind. So the browser only does the redirect, hands the tokens to
  `POST /api/auth/oauth`, and keeps nothing (in-memory token store). The server stores them
  AES-256-GCM encrypted in `ram_users` and is the only thing that ever refreshes them
  (`lib/oauth.ts`).
- **Refresh tokens rotate on every use**, so refreshes are serialised: one in-flight promise per
  user, plus a 30s DB lease (`oauth_refresh_lock_until`) across serverless instances. A second
  concurrent refresh would hold a dead token, and Auth may revoke the whole session for reuse.
- **Identity:** the access token's `sub` is a HelloMinds *userId*, a different namespace from the
  Builder key's *humanId* (`/v1/users/{userId}/minds` vs `/v1/humans/{humanId}/minds`; verified:
  rovin is `c2d60bc5…` via OAuth, `af25d282…` via Builder key). HelloMinds does **not** offer
  partner apps the `email` scope and the token carries no email. So existing users are matched
  by **Mind ownership**: a token can only list its owner's Minds, and our plans/listings record
  which account each Mind belongs to — one unambiguous match adopts that account and keeps its
  `human_id`, listings, plans, rentals and points. Never adopts an account another OAuth user
  already claimed. Brand-new users get a placeholder key `hm-<userId>@oauth.invalid`.
- **Lifetimes (verified from the token claims):** access token **15 minutes**; refresh token
  **30 days from the original sign-in, not extended by refreshing**. Every user must reconnect
  every 30 days. The profile and My Minds show the deadline and warn in the last 7 days; a
  trainer whose connection lapsed has their listings shown **offline** and rent/chat refused
  (409) before any charge.
- **Circles aren't reachable** with OAuth (no scope exists), so circle size was dropped from the
  UI. Rentals never depended on circles.
- **Two separate off-switches.** *Sign out* ends the browser session only — Minds keep training
  and serving renters. *Disconnect* (profile) revokes our refresh token at HelloMinds and deletes
  it, which stops both.
- Scopes are requested all at once at sign-in (`lib/oauth-config.ts`, 14 scopes) — background
  work has no moment to ask for more later. Requesting a scope the client may not use fails the
  whole login (`"Scope not available to this client: email"`).
- OAuth client "Rent a Mind" (`3d5a0469-1cd2-4417-9e25-eb4d16438960`) in the Build console;
  redirects `https://rentamind.vercel.app/auth/callback` + `http://localhost:3000/auth/callback`,
  origins to match. `NEXT_PUBLIC_MINDS_OAUTH_CLIENT_ID` is set locally and in all Vercel envs.
- Middleware: browse is public (home, marketplace, listing pages, rewards, `/auth/callback`);
  everything else requires a session. All data is scoped per user.

## 3b. Launching a Mind (guided)

- `/launch` is a three-step flow: **pick a role → claim a name → awaken**.
- Roles come live from the Core API's public species taxonomy (`/v1/species/moca/items`,
  two levels: 5 top roles, each with sub-roles). Names are checked live against
  `/v1/minds/check/name`, proxied behind our session so it isn't an open enumeration oracle.
- Awakening itself still happens on HelloMinds — `POST /v1/minds/awaken` needs a user session
  we can't hold. The app then detects the new Mind by polling and hands off to the Studio.

## 3c. Bazaar (`/skills`)

- Browse the full public skill catalog (~3,900 skills) from the Core API with no credentials,
  then **equip with the signed-in user's own HelloMinds connection**. Ownership is enforced server-side.
- Skills are the lever on answer quality, which is what renters actually pay for.

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
  listing owner's HelloMinds connection (the owner consents to `messaging:send` at sign-in), isolated from the training thread and other renters.
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
- **Runway** — every Mind shows how many days of cognition it has left: `balance ÷ mean daily
  spend over 14 days`, the Core API's own definition, computed in `lib/runway.ts` from Builder
  usage. It appears on My Minds, on each listing (so renters don't rent a Mind that's about to go
  quiet), and on the Studio cadence slider, where the per-cycle cost is *measured* from real burn
  rather than assumed.
- **Top-up** (`/api/topup`) implements the Core API's public Stripe checkout to fund a specific
  Mind — ownership-checked, $2 minimum. HelloMinds' upstream currently rejects it for every Mind
  we've tried; the UI reports that honestly and links to app.hellominds.ai.
- Still not real: the renter's spend doesn't transfer to the owner's Mind (no account-to-account
  cognition transfer exists in any of the three APIs). If HelloMinds fixes the checkout 400, the
  top-up path becomes the answer.

## 7. Points (Season 0 → airdrop)

Points are **spend-based** — every point is backed by cognition actually spent, so there are no
free bonuses a throwaway account can farm (see `lib/points.ts`).

| Who | Action | Points |
|---|---|---|
| Trainer | Study cycle completes | +5 |
| Trainer | Renter spends on their Mind | +0.5 per cognition |
| Trainer | A renter's **first paid** message on a rental | +25 (spend-gated, once per rental) |
| Renter | Spending on rented Minds | +1 per cognition |

Leaderboard at `/rewards`; per-user breakdown on `/profile`. Deliberately no message caps and no
sybil heuristics: paying for cognition *is* the goal, so multi-account farming is just prepaying.

## 8. Architecture

- **Next.js 16 / React 19 / TypeScript** on Vercel; HelloMinds-themed UI; DiceBear generative
  avatars.
- **Supabase Postgres** (service-role only, RLS locked): `ram_users` (encrypted keys),
  `ram_listings`, `ram_rentals` (per-rental conversation alias, messages, spend),
  `ram_wallets` (real_cognition / allowance / spent), `ram_points_events`,
  `ram_training_plans` + `ram_study_log`, `ram_ratings` (UI pending).
- **HelloMinds Builder API** per-user clients (`@animocabrands/minds-client-lib`): minds,
  balances, usage, equip, messaging, conversations.
- **HelloMinds Core API** (`lib/core-api.ts`) — public endpoints only, no credentials: name
  availability, the species/role taxonomy, the Bazaar catalog, and Stripe checkout. Session-gated
  endpoints (awaken, runway, schedule, credits) are typed and wired but unreachable; see
  `docs/CORE-API-NOTES.md`.
- **Scheduler**: `*/15` Vercel cron → `/api/settle` (CRON_SECRET) runs rental expiry + study
  directives + reply collection; page visits tick it too.

## 9. Status

Working and verified end-to-end (see QA-REPORT.md): auth, per-user scoping, training loop with
in-character replies, listings CRUD, proxied paid rentals with real-backed wallets, points,
cross-account isolation, guided launch, Bazaar equipping, and cognition runway everywhere.
Remaining: error tracking (needs a Sentry DSN), a wider study curriculum to avoid meta-drift past
~80 cycles, and the three asks for the HelloMinds team in `docs/CORE-API-NOTES.md` (federated
login, the checkout fix, a partner key).
