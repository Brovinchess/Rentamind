# Rent a Mind — QA Report (2026-08-25)

Full pass over user journeys and UX, front end to back end, checked against [CONCEPT.md](CONCEPT.md). State at time of review: marketplace intentionally empty (no steward has listed a Mind yet), 1 ended rental in history, 4 real points events.

## What was tested and passes

| Area | Result |
|---|---|
| Marketplace empty state | ✅ "No Minds listed in this category yet" renders; no crash with zero listings |
| Listing creation (`POST /api/listings`) | ✅ Creates for owned Minds; appears on marketplace immediately |
| Ownership guard | ✅ Listing a Mind not on the account → 403 |
| Duplicate guard | ✅ Listing an already-listed Mind → 409 |
| Rent validation | ✅ Inactive listing → 404; malformed email → 400; capacity cap enforced |
| Real Circle grant/revoke | ✅ Verified live: rental added renter to itachi's Circle; cleanup deactivated them (Builder API confirmed both) |
| Live chat | ✅ Real replies from the Mind; HTML flattened; history ordered; 8s background sync; timeout recovers via sync |
| Chat ownership guard | ✅ Foreign mindId → 404 on API and `/talk` page |
| Settlement | ✅ Metered real cognition into points during the live rental; idle run returns zeros; expiry removes Circle access |
| Points ledger | ✅ Only real events remain (rental supply 70+2, renter bonus 10, usage 3) |
| Type safety / build | ✅ `tsc` clean; production deploy healthy |

## Findings — ranked

### Critical

**C1. The deployed app has no authentication at all.** — ✅ **FIXED** same day: access-code gate in `proxy.ts` (cookie-based, `APP_ACCESS_CODE` env; pages redirect to `/gate`, APIs return 401).
rentamind.vercel.app runs on Rovin's Builder key server-side, and every route is public. Anyone with the URL can: see the dashboard (Mind names, balances, burn), open any training room and chat *as the steward's account* — burning real cognition — create listings, and add arbitrary emails to real Minds' Circles via `/api/rent`. The concept doc specifies steward Builder-key login and renter identity; neither is enforced.
*Recommendation:* short-term, gate the whole app behind an access code (env var + middleware) so it stays pitch-shareable but not abusable; longer-term, real steward auth (paste-your-own Builder key session) and renter magic-link.

**C2. Chat access isn't tied to a rental.** — ✅ **FIXED** same day: chat page and API now require the rental id issued at checkout (active, unexpired, matching the listing); non-renters see a "rent to unlock" panel.
`/chat/[listingId]` works for anyone on any listed Mind with no check for an active rental — the concept's core loop is "pay → Circle grant → chat." In-app chat also runs through the steward's session rather than the renter's identity, so unrented visitors can consume cognition for free.
*Recommendation:* require an active rental (renter email + rental id token issued at checkout) before serving `/chat`; label in-app chat as a preview surface and keep email/Telegram (which the Circle genuinely gates) as the canonical renter channel.

### High

**H1. Renter-funded cognition is simulated.** The checkout is display-only; no Stripe, no top-up. This is the concept's day-one revenue mechanic. Blocked on a partner API key (`POST /v1/ui/minds/{id}/top-up` exists and returns a real Stripe Checkout URL, test mode included).

**H2. No sybil defenses.** A steward can rent their own Mind with a second email and farm Synapses; the concept promises self-rental decay to zero, payment-anchored points, and rating-gated multipliers. None are implemented.

**H3. Usage over-attribution.** `renter_usage` points equal the Mind's *total* cognition burn during the rental window — including the steward's own training messages and the Mind's autonomous cycles. Renters can be credited for burn they didn't cause. Mind-level metering is an API limitation; partial fix: subtract a trailing baseline burn rate; real fix: per-conversation metering (native ask).

### Medium

**M1. Settlement is manual.** — ✅ **FIXED**: daily Vercel cron (`vercel.json`, CRON_SECRET-authenticated) + throttled background settle via `after()` on dashboard/points visits.

**(original finding)**  Expiry + metering only run when "Settle rentals" is clicked. Until it runs, expired renters keep Circle access. Fix: Vercel cron hitting `/api/settle` every 5 minutes (one config file).

**M2. No rating submission.** `ram_ratings` table exists but no UI writes to it — listings stay "unrated" forever and the concept's quality multiplier has no input.

**M3. No delist/edit.** — ✅ **FIXED**: "Your listings" section on the dashboard with inline edit (title, tagline, description, category, icon, rate, min days, max renters), delist (keeps history; mid-window renters retain access until expiry), and relist.

**(original finding)**  Stewards can list a Mind but never unlist, reprice, or edit it (this cleanup had to be done directly in the DB). The listing form also can't set sample Q&A, tags, min days, or max concurrent renters — all fields the concept's listing journey names.

### Low / polish

**L1.** Marketplace sorts by the DB `training_score` column, which is 0 for real listings — display score is computed live but ordering ignores it.
**L2.** Performance: dashboard fires ~4 live Builder-API calls per Mind per load (~56 requests for 14 Minds); homepage similar per listing. Needs short-TTL server caching.
**L3.** Awakening can't happen in-app (partner API gap) — the launch flow's hand-off + auto-detect is the right workaround and is documented in the UI.
**L4.** Empty marketplace shows no CTA to launch/list a Mind — dead end for a first-time visitor.
**L5.** Renter email is unverified (anyone can type any address — which, combined with C1, lets a stranger add any email to a Circle).
**L6.** Sample Q&A on listings (when they existed) were authored copy, not actual Mind outputs; the form offers no way to generate real ones.

## Concept-doc alignment summary

| Concept promise | Status |
|---|---|
| Rental = time-boxed Circle grant | ✅ Real |
| Rentals settle in Cognition (renter tops up the Mind) | ❌ Simulated (partner key needed) |
| Renter chats on native surfaces (email/Telegram) | ✅ Real once in Circle |
| In-app chat | ⚠️ Real pipeline, but not rental-gated (C2) |
| Points: training / supply / renter usage | ⚠️ Supply + usage flow works; training-activity points not implemented; anti-sybil absent (H2) |
| Scheduler expires rentals | ⚠️ Logic exists, manual trigger only (M1) |
| Ratings feed reputation | ❌ No input path (M2) |
| Steward auth via Builder key, renter identity | ❌ Not enforced (C1) |
| Launch → Train → List → Earn journey | ✅ All pages exist and connect |

## Suggested order of work

1. **C1** access gate (hours) — makes the public URL safe.
2. **C2** rental-gated chat (hours).
3. **M1** settlement cron (minutes).
4. **M3** delist/edit listing (hours).
5. **M2** ratings (hours).
6. **H1/H3/L3** — the partner-key conversation with HelloMinds unlocks all three.

---

## QA pass 2 — 2026-08-26 (Builder-key auth + multi-trainer)

All tests run against the refactored architecture (per-user Builder keys, proxied rentals, per-message billing):

| # | Test | Result |
|---|---|---|
| A1 | Renting your own listing | ✅ blocked ("chat with it free in its training room") |
| A2 | Second account rents a listing | ✅ rental + 1,000-cognition wallet + points |
| A3 | Renter reads own session | ✅ balance/price/usage returned |
| A4 | Other account opens someone's rental | ✅ 403 cross-account block |
| A5 | Bogus rental id | ✅ 403 |
| A6/A7 | Editing/delisting someone else's listing | ✅ 404 ownership block |
| A8 | Prompt-injection message from renter | ✅ 400 filtered |
| A9 | Sign out | ✅ session cleared, redirect to login |
| B1 | Paid renter message via owner-key proxy | ✅ charged 10 (1000→990), in-persona Hulk reply |
| B2 | Cron route with CRON_SECRET | ✅ 200, gate bypassed only with secret |
| B3 | All 8 pages render signed-in | ✅ 200 |
| — | Invalid Builder key login | ✅ 400 with clear message |
| — | Real key login (local + production) | ✅ validates against live API, 18 minds |
| — | Anonymous access rules (local + production) | ✅ browse open, act redirects/401 |

Residual production items: custom SMTP no longer needed (no email auth); remaining launch list = daily message caps per rental, terms/privacy page, error tracking, per-listing rate limits.


---

## QA pass 3 — 2026-08-27 (proof-of-cognition wallet)

Wallet correctness, verified against independently computed live balances, plus full regression.

| # | Test | Result |
|---|---|---|
| W1 | Allowance formula edges (0→100, 300→150, 9999→5000, 1M→5000…) | ✅ 9/9 unit cases |
| W2 | Rent syncs wallet from LIVE balances | ✅ real_cognition 15,750–15,761 matched an independent Builder-API sum exactly; allowance capped at 5,000 |
| W3 | Insufficient balance | ✅ 402 with clear "backed by your real cognition" message |
| W4 | Re-sync preserves `spent`; stale (>6h) wallets auto-resync | ✅ spent stayed 4,995 through a forced resync |
| W5 | Already-renting path returns synced balance | ✅ |
| — | Paid message end-to-end | ✅ balance 5,000→4,990, spent=10 in DB, in-character Mickey reply |
| R1–R9 | Full regression: anon rules, bad/good login, all pages, own-listing rent block, cross-account 403, foreign-listing edit 404, injection filter, cron auth both ways, signout | ✅ all pass |
| P1–P4 | Production: deploy Ready, public browse, login + profile 200, wallet row real (15,761 / 5,000 / 0) | ✅ |

Docs updated: CONCEPT.md rewritten to the v2 architecture (Builder-key auth, proxied rentals,
auto-study training, real-backed wallets); README refreshed.

---

## QA pass 4 — 2026-09-03 (full audit after ~1 week live)

First audit after the app ran unattended for a week. Goal: confirm real-world behaviour matches spec, catch drift, ship the pending real-time-chat work.

### Live-state findings (real data, not seeded)

- **Multi-tenant working in the wild:** a second real trainer, `kennethw@anichess.com`, signed in with their own Builder key and created a 4th persona (**Athene**, 14 study cycles). Confirms the Builder-key auth + per-user scoping holds for a stranger, not just the seed account.
- **Study loop ran continuously for a week:** Max Verstappen / Mickey Mouse / The Incredible Hulk each reached **79 study cycles**; latest directive Sep 3 with a stored in-character reply. The `*/15` cron + page-visit ticks kept firing with no babysitting. `next_study_at` scheduling stayed on cadence (no drift/stall).
- **Points ledger sane:** rovin 1,277 · kennethw 70 · a renter 33 — all from real activity.
- **Listings:** 3 active (Hulk/Mickey 10, Max 15 cog/msg), all `unrated` (no organic ratings yet — expected).

### Behaviour verification (local, real Builder API + DB)

| # | Test | Result |
|---|---|---|
| A/B | Login: real key accepts (18 minds), garbage key → 400 | ✅ |
| C | Signed-in pages `/my-minds /studio /profile /launch` | ✅ 200 |
| D | **SSE stream** authed → `data: {"type":"connected"}` frame | ✅ |
| E | SSE stream unauth → 401 JSON | ✅ |
| F | Chat GET transcript (trainer) | ✅ 50 msgs |
| G | Renter rents Hulk — wallet **5,000 backed by real 15,919 cognition** | ✅ |
| H | Injection message from renter | ✅ 400 filtered |
| I | Owner opens renter's rental | ✅ 403 cross-account |
| J | Owner rents own listing | ✅ 400 blocked |
| K | Rate before chatting | ✅ 400 "chat at least once first" |
| L | Paid message | ✅ 5,000→4,990, in-character reply |
| M/N | Rate 5★ → listing avg recomputes | ✅ 200, listing → 5.0 (1) |
| O | Renter points chain | ✅ bonus 10 + usage 10 + first-rating 5 |
| — | Production: public 200s, protected → login, all APIs 401 unauth | ✅ |
| — | `tsc --noEmit` clean | ✅ |

### Shipped this pass
- **Real-time chat** (was uncommitted from the prior session, now verified + committed `6b2131d`): SSE reply stream, live/connecting status pill, and an elapsed "reasoning · M:SS · usually 1–3 min" timer — answering the earlier "does it show remaining time / sync in real time" question. Replies now arrive instantly via SSE, with polling fallback.
- **Ratings** (committed `500a45d` during the week): 1–5★ + comment, one per rental, editable, must-chat-first, listing averages auto-recompute, +5 points for first rating.

### Still open (unchanged, tracked)
- Anti-sybil decay for self-rental / multi-account farming (balances being real-cognition-backed already prices it; graph decay not yet built).
- Error tracking (Sentry/log drain) for production ops.
- Native asks: account-to-account cognition transfer, or Stripe top-ups via a partner key, so renter spend actually refills the rented Mind.

**Verdict:** no regressions after a week live; every spec'd behaviour verified against real data; the two in-flight features (ratings, real-time chat) are complete and shipped. Launch-ready for Season 0.
