# Rent a Mind — Concept & Build Spec

> Marketplace layer on HelloMinds: stewards train Minds into specialists/personas and rent direct access to them. Renters fund the cognition burn. Both sides farm points toward a future airdrop. Decisions locked with Rovin 2026-08-25: concept pitch + hybrid demo in HelloMinds theme; **direct access** rental model (circles); **renter-funded cognition**; points from **training + rental supply/demand + renter usage**.

---

## 1. Thesis

A Mind compounds value the longer its steward trains it — memory, skills, DNA refinement. Today that value is locked to one person. Rent a Mind unlocks it:

- **Stewards** train Minds into something worth borrowing (a Trump-persona forecaster, a neurosurgery explainer, a niche-market analyst) and list them for rent.
- **Renters** get direct, time-boxed access to the live trained Mind on its native surfaces (web chat, email, Telegram).
- **Rentals settle in Cognition** — the renter's payment IS a cognition top-up to that Mind — so HelloMinds earns on every rented minute through its existing revenue unit.
- **Points** (future airdrop) reward training, supplying rentable Minds, and renting — bootstrapping both sides of the marketplace before cash pricing exists.

## 2. Roles

| Role | Who | Gets |
|---|---|---|
| Steward | Mind owner/trainer | Points (later: cash share), reputation, leaderboard |
| Renter | Any user with an email | Time-boxed access to a trained Mind; points for usage |
| Platform | HelloMinds/Animoca | Cognition sales + rental margin + listing/verification fees |

## 3. User journeys

### Steward: train → list → earn
1. **Train** — normal HelloMinds usage: chat/email/Telegram, feed documents (artifacts), build Skills conversationally, refine DNA. The product frames this as "training" and shows a **Training Score** = f(mind age, cognition invested by steward, skills equipped, knowledge artifacts, rating history).
2. **List** — create a listing: persona title, description, category/tags, sample transcript ("what would Trump tweet about X?"), rental terms: **daily rate in Cognition**, minimum period, max concurrent renters. Recommend a **dedicated rental Mind** (not your personal daily driver) — memory is shared.
3. **Earn** — points per completed rental hour, per unique renter, per unit of renter cognition burned on the Mind. Reputation from ratings.

### Renter: browse → rent → chat → expire
1. **Browse** marketplace: categories (Personas, Experts, Trading, Research, Coaching…), filters, Training Score, ratings, price, sample Q&A.
2. **Rent** — checkout = Stripe Cognition top-up to that Mind (keyed to renter's email, native endpoint) + platform margin. Confirmation email.
3. **Access** — renter's email added to the Mind's **Circle** for the rental window → renter chats via web app, email, or Telegram, exactly like a steward would. In-app chat with live "watch it think" activity stream.
4. **Expire** — scheduler removes renter from circle at window end; prompt to renew + rate.

### Example listings (demo seeds)
- **POTUS45 Mind** — trained on Trump speeches/tweets/decision history; predicts responses to hypotheticals. Labeled **parody/simulation** (not affiliated).
- **Neuro Mind** — brain-surgery literature; explains surgical news and research. **Informational, not medical advice** label.
- **Whale Watch Mind** — on-chain trading pattern analyst (fits existing Superior Trader vibe).

## 4. Points economy — "Synapses"

Every action that grows or exercises a Mind earns Synapses. Burn-backed: points are anchored to real cognition purchased/consumed, which is real USD into the platform.

| Earner | Action | Points logic |
|---|---|---|
| Steward | Training activity | 1 Synapse per cognition burned by steward's own usage on a listed (or soon-listed) Mind; daily cap; streak multiplier by mind age; bonus for publishing a Skill |
| Steward | Rental supply | Base points per completed rental hour × unique-renter multiplier; repeat-renter bonus; rating-gated multiplier |
| Renter | Rented usage | Points per cognition burned on rented Minds (drives demand side) |

**Anti-sybil** (renter-usage is the farming vector):
- Points anchored to *paid* cognition (Stripe-verified top-ups), not free credits.
- Self-rental decay: steward↔renter graph clustering, shared payment fingerprint / device / IP → diminishing returns to zero.
- Rating-gated multipliers; slashing for spam listings; seasonal caps.
- Seasons + public leaderboard; airdrop unannounced ratio (aligns with Ethoswarm $MENTE economy).

## 5. Platform revenue

1. **Cognition margin (core, day 1)** — every rental converts renter demand into cognition purchases that wouldn't otherwise exist. The rental payment IS a top-up.
2. **Rental take rate** — X% margin added at checkout above the cognition component. Later: steward cash pricing with platform 15–20% cut, paid out via the Stripe Connect rails already in the partner API.
3. **Featured listings + Verified Persona review fee** — reuses the Bazaar's Verified/Wild trust labels.
4. **Token runway** — Synapses → airdrop → staking/curation on top Minds (Ethoswarm-aligned).

## 6. Technical design

### 6.1 Feature → existing API mapping (all verified in my product reference)

| Feature | Endpoint |
|---|---|
| Steward login (demo) | Builder API key; `parseHumanIdFromBuilderApiKey` (client lib) |
| List steward's Minds | `GET /v1/humans/{humanId}/minds` (Builder) |
| Mind detail (model, wallet, email) | `GET /v1/minds/{mindId}` (Builder) |
| Cognition balance / runway | `GET /v1/minds/{mindId}/credits` (Builder); `/runway` (Partner) |
| Usage metering | `GET /v1/minds/{mindId}/cognition/usage` + `/usage-by-tool` (Builder) |
| **Grant rental access** | `POST /v1/circles/{mindId}` add renter email (Builder) |
| **Revoke at expiry** | `DELETE /v1/circles/{mindId}` (Builder) |
| **Renter funds cognition** | `POST /v1/ui/minds/{mindId}/top-up` → Stripe Checkout URL, `?mode=test` for demo (Partner); `/subscribe` for monthly |
| In-app chat | Builder messaging: conversation by alias, send, history, SSE events |
| "Watch it think" stream | `GET /v1/messaging/custom/minds/{mindId}/activity` SSE (Partner) |
| Catalog enrichment | Public Bazaar: skills/apps/tools, stats, graph |
| Listing visibility | `POST /v1/ui/minds/{mindId}/status` `isListed` (Partner) |
| Nudge/notify steward | `POST /v1/messaging/custom/beacons` (Partner) |

### 6.2 What we build (marketplace layer)

- **Frontend**: Next.js App Router, HelloMinds visual theme (navy `#394F95`, orange CTA, Manrope + Space Mono, light cards / dark navy header).
- **Backend**: Next.js server actions/route handlers + Postgres.
  - Tables: `users` (steward keys encrypted, renter emails), `listings` (mindId, terms, category, samples), `rentals` (window, status, renter, cognition snapshot at start/end), `points_ledger` (event-sourced), `ratings`.
- **Rental orchestrator**: checkout success → circle add → schedule expiry job (cron/queue) → circle remove → settle points from usage delta over the window.
- **Points engine**: periodic job reads cognition usage time-series per rented Mind, attributes window deltas to active rentals, writes ledger entries.
- **Auth (demo)**: steward pastes Builder API key ("Builder login"); renter identified by email (magic-link later).

### 6.3 Demo scope (hybrid — live wherever data exists)

**Live** (with Rovin's Builder key): steward login, real 14 Minds w/ balances + usage charts, real circle add/remove on rent/expiry, real in-app chat with a rented Mind, real Bazaar catalog, Stripe `?mode=test` top-up checkout.
**Mocked/seeded**: other users' listings (POTUS45, Neuro, Whale Watch…), points ledger + leaderboard, ratings, rental history.

### 6.4 Known gaps → native-platform asks (the pitch to HelloMinds)

1. **Per-renter metering** — usage is mind-level, not per-conversation. Demo approximates by rental window. Ask: per-conversation cognition attribution.
2. **Circle TTL** — no expiry on circle membership; we run a scheduler. Ask: TTL param on circle add.
3. **Shared memory** — renters' chats enter the Mind's LTM; steward data can leak to renters. Mitigation now: dedicated-rental-Mind UX + disclosure banners both sides. Ask: memory partitions / "rental mode" / clone-to-rentable-archetype.
4. **Concurrency** — one Mind, many renters → queueing; cap concurrent rentals per listing.
5. **IP & safety** — public-figure personas labeled parody; medical/financial disclaimer categories; moderation queue; reuse Verified/Wild.

## 7. KPIs

Supply: listed Minds, avg Training Score. Demand: rental hours, unique renters, renter cognition burned (= GMV), repeat-rental rate. Platform: cognition revenue from rentals, take. Integrity: % points flagged sybil.

## 8. Roadmap

- **Phase 0 — Demo** (this build): hybrid live/mock, pitch-ready.
- **Phase 1 — Points beta**: real rentals, Synapses live, no cash between users; cognition-settled only.
- **Phase 2 — Cash rentals**: steward pricing, payouts via Stripe Connect, take rate on.
- **Phase 3 — Native primitives**: clone/memory partition, per-conversation metering, circle TTL.
- **Phase 4 — Token**: airdrop against Synapses; staking/curation.
