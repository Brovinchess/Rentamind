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

---

## QA pass 5 — 2026-09-03 (fixes from the audit)

The pass-4 audit found no bugs, only hardening gaps. After discussion, the sybil concern was
reframed: **if a point requires real cognition spend, farming it just means paying — that's the
goal.** So the fix is to make points purely spend-based, not to build fraud detection. Four fixes
shipped (`267db2e`):

### Fix 1 — spend-based points (airdrop integrity)
- **Removed** the free renter `+10` "clicked rent" bonus and the flat steward `+50/+20` rent-time
  bonuses — the only points that cost nothing and were farmable with throwaway accounts.
- Points now: renter **+1 / cognition**, steward **+0.5 / cognition**, study **+5 / cycle**
  (trainer's own spend), plus a **+25 "new paying renter"** bonus paid to the trainer only on a
  renter's **first paid message** and only if they've never paid on that listing — fully spend-gated.
- Added a `season` tag to points events for clean future resets.
- **Verified:** renting now awards 0 points; first paid message → renter +10, steward +5 usage
  **+25 acquisition**; Mickey replied "Hot dogs! 🐭".

### Fix 2 — low-cognition guard (no paying for silence)
- New `lib/mind-health.ts`: a Mind below the reply threshold (30 cognition) **can't be rented**,
  and a paid message is **refused without charging** the renter.
- **Verified live:** a real Mind sitting at **−26 cognition** returned `409 out of cognition` on
  a rent attempt; renter not charged.

### Fix 3 — training can't drain a Mind dry
- The study loop **auto-pauses** a persona when its Mind drops below the study threshold
  (3× reply floor) instead of studying it into the negative.
- Studio now shows each persona's **live cognition** and a red low-balance warning.

### Fix 4 — performance + observability
- **30s cache** on live Mind stats (balance/usage/circle/skills) so a page rendering many Minds
  no longer hammers the Builder API (rate-limit safety).
- Structured `console.error` logging in the settle/study background passes so a stalled loop is
  visible in Vercel logs (full Sentry still optional; needs a DSN).

### Not fixed (unchanged — external dependency)
- Renter spend still doesn't *transfer* to the rented Mind (no HelloMinds account-to-account
  cognition API). Needs a partner key (Stripe top-ups) or a native transfer endpoint.

**Post-fix state:** `tsc` clean; all four verified (three live against real data, one code-path);
QA data cleaned; 2 real trainers + 3 real listings intact; deployed to production.

---

## QA pass 6 — 2026-09-08 (persona / training-loop audit)

Audited all four live training personas. Found and fixed a **critical stall**.

### Critical bug found & fixed: study loop had stalled for ~5 days
- **Symptom:** all four plans `is_studying=true` but overdue 3–5 days — Max Verstappen (cyc 97),
  Mickey Mouse (82), The Incredible Hulk (86), Athene (18, kennethw's) — no new cycles since ~Sep 3.
- **Diagnosis (instrumented, step-by-step):** `settle()` fine (0.6s), then the study loop hit
  Max first and **hung forever on `getLatestHistoryFingerprint`** — balance ✓1.6s,
  ensureConversation ✓1s, fingerprint ✗ never returned. Minds with large conversation histories
  (~90+ cycles ≈ 180+ messages) make that history read hang; with no timeout it wedged the whole
  pass, the serverless function was killed at its limit, and **nothing advanced for any plan** —
  a permanent death-spiral (every cron/visit re-hit Max and died).
- **Fix (`lib/study.ts`, commit `d39f2a2`):** time-box every Builder call (20s; 5s for the
  optional fingerprint capture); **send directives first** (advance cycle+points) then collect
  replies best-effort; bound each pass (≤3 plans, ≤5 reply reads, 45s deadline); on a plan's
  failure push `next_study_at` out 30 min so it can't block the queue.
- **Verified:** all four resumed advancing (Max 97→98, Mickey 82→83, Hulk 86→87, Athene 18→19);
  **production settle now returns in ~3s** (was timing out >120s); no plan overdue.

### Persona quality — all four in-character ✅
Latest study replies (today) and a live rental probe:
- **Max Verstappen** — live reply "Driving flat out. That's it." — blunt, on-voice ✅
- **Mickey Mouse** — "Oh boy, pal!…" ✅
- **The Incredible Hulk** — "RAAARGH! Hulk HEAR…" (full caps voice) ✅
- **Athene** (kennethw's, on the `Kogito` Mind) — coherent, addresses its steward ✅

### Observation (not a bug) — meta-drift at high cycle counts
At 80–98 cycles the topic list has looped several times, so study replies increasingly *narrate
the training* ("STUDY DIRECTIVE #79… go deeper than v4 cycle 68") rather than pure in-character
content. Rental-facing replies remain clean. Recommend: expand/rotate the curriculum or soft-cap
cycles so directives stay novel — otherwise cognition is spent on diminishing returns.

### Health snapshot
2 real trainers · 4 personas training (3 rovin + 1 kennethw) · 3 active listings · Mind balances
healthy (Max 1,122 · Mickey 1,265 · Hulk 1,261 · Kogito 749, all above the study auto-pause floor).

---

## QA pass 7 — 2026-09-09 (Core API integration + full audit)

Shipped this pass: guided launch flow, Bazaar skill browser, cognition-runway everywhere,
card top-ups, regrouped navigation. All backed by the HelloMinds **Core API**'s public
endpoints (see `docs/CORE-API-NOTES.md`).

### Critical bug found & fixed: circular import hung every page that touched Minds

`lib/minds.ts` imported `lib/runway.ts`, which imported `mindsFor` back from `lib/minds.ts`.
Under Turbopack this resolved differently depending on which module compiled first, so it
worked for a while and then **hung `/mind/[id]` indefinitely** — three consecutive requests
returned `http=000` after 60s each, with no entry in the server log at all. It would have
hung more pages as HMR reshuffled module order, and it is exactly the kind of failure that
survives a green `tsc` and a green `next build`.

Fix: `lib/runway.ts` is now import-free (pure types + label/tone helpers); the two dead
functions that needed `mindsFor` (`getRunway`, `projectRunway` — nothing called them) were
deleted. `/mind/[id]` went from **timeout → 0.48s**.

### Data bug found & fixed: "Burn · 30d" was never 30 days

Probing `getCognitionUsage` with `startTime` at −7d/−14d/−30d/−60d/−90d/−365d:

```
-7d   ->  8 buckets, earliest 2026-09-02
-14d  -> 15 buckets, earliest 2026-08-26
-30d  -> 15 buckets, earliest 2026-08-26   <- identical
-60d  -> 15 buckets, earliest 2026-08-26   <- identical
-90d  -> 15 buckets, earliest 2026-08-26   <- identical
-365d -> 15 buckets, earliest 2026-08-26   <- identical
explicit window -60d..-30d -> 0 buckets
```

**HelloMinds only retains ~15 days of daily cognition usage** and silently ignores any earlier
`startTime`. The app had been labelling that figure "30d" on My Minds and on every listing
page since it was written, and feeding it to `trainingScore` as `usage30d`.

Fix: `usage30d` → `usageWindow` + `usageWindowDays`; the window is now *counted* from the
buckets returned rather than assumed, and the UI prints the real number ("Cognition burned ·
15d"). Scores are numerically unchanged — only the name was wrong. A second, smaller bug went
with it: the 14-day date filter dropped the boundary bucket the API includes, making runway
~2% optimistic (12.4d vs 12.1d on `@thehulk`).

### Runway verified against an independent calculation

`@thehulk`: balance 1,370 · 1,574 burned over 15 retained days → 104.9/day → **13.06 days**.
Rendered: **13 days left**. The Studio cadence slider, which now measures cost-per-cycle from
real burn instead of a hardcoded 25, agrees with the badge (both 14d at the time of testing);
before the fix it disagreed by ~3× (5.1d vs 14d).

### Security audit — no findings

| Check | Result |
|---|---|
| 8 API routes + 5 gated pages, no cookie | 401 / 307 — all correct |
| 7 POST routes, no cookie | 401 — all |
| Forged cookies: empty, garbage, signature stripped, **email swapped with original signature reused**, expired `x` with valid signature | 401 (API) / 307 (page) — all rejected |
| `GET /api/settle` with no / wrong `CRON_SECRET` | 401 |
| `POST /api/topup` + `POST /api/skills` with a Mind the user doesn't own | 403 "That's not one of your Minds." |
| Builder key, service-role key, `SESSION_SECRET`, `CRON_SECRET` in `.next/static`, `.next/server`, and 6 rendered pages | not present anywhere |
| Supabase **anon** key direct REST read of all 8 `ram_*` tables | `[]` — RLS holds |
| `parentCategory=../../etc/passwd` | `{"roles":[]}` — no traversal |

### Input-validation findings — both fixed

1. **`/api/topup` had no upper bound** (medium). `amountCents: 999999999999` passed validation
   and went upstream; a string `"500"` was coerced through `Number()`. Harmless only because
   HelloMinds rejects every checkout today — but if they fix that, an unbounded amount reaches
   a live Stripe page. Now: strict `typeof === "number"` + integer check, floor $2, **ceiling
   $500** (`CHECKOUT_MAX_CENTS`).
2. **`/api/launch?name=` forwarded junk upstream** (low). A 3,000-character name and
   `<script>` were both proxied to HelloMinds. Now rejected locally against
   `/^[A-Za-z0-9._-]{1,64}$/`; real names still resolve (`thehulk` → taken,
   `zzqx9-free-name` → available).

### Regression checks

- Production build clean; `tsc --noEmit` clean.
- 17 routes swept: all 200, plus the two intentional 307s (`/dashboard`→`/my-minds`,
  `/points`→`/rewards`). `/my-minds` **2.1s** with 20 Minds — down from 4.6–7.0s, because
  runway now reuses the usage call it already made instead of adding a sixth per Mind.
  `/studio` 1.3s (the Mind picker now uses a single balance call for unplanned Minds only,
  not the full 5-call stats bundle for all 20).
- `POST /api/settle` 0.85s · `GET /api/settle` with `CRON_SECRET` 0.44s — both far under the
  60s serverless limit, no sign of the pass-6 stall returning.
- Study loop healthy: 4 plans all `studying=true`, none overdue, **20/20** most recent study
  directives have replies. 340 points events, 2 real trainers.
- Bazaar equip round-trip on `@applewatch`: equip → confirmed in `equippedIds` → unequip →
  confirmed empty. Original state restored.

### Still open

- **Renter spend still doesn't reach the rented Mind.** No account-to-account cognition
  transfer exists in any of the three APIs. `POST /api/topup` is the nearest thing and it is
  blocked upstream — HelloMinds' Ethoswarm returns a bare `"Bad Request"` for every
  well-formed checkout. Needs them.
- **No "Sign in with HelloMinds."** Their login only accepts Airkit tokens scoped to their own
  partner ID; the only way to mint acceptable ones is to impersonate their first-party web
  client. Deliberately not done — reasoning in `docs/CORE-API-NOTES.md`.
- Error tracking still needs a Sentry DSN.
- Meta-drift past ~80 study cycles (pass 6) unchanged — Max Verstappen is now at 113 cycles.

---

## QA pass 8 — 2026-09-16 (user-journey QA, front end to backend)

Walked the whole journey a week after the pass-7 work shipped locally. Two critical bugs, both
found by actually exercising the flow rather than reading it.

### Critical #1 — chat was dead for every trained Mind

`POST /api/chat` hung until the 180s function ceiling and returned nothing. Root cause:
`getLatestHistoryFingerprint` — **the same call that stalled the study loop in pass 6** — was
still unguarded in the chat route. Timed directly:

```
thehulk      ensureConversation 1409ms   getLatestHistoryFingerprint STILL RUNNING at 60s
mickeymouse  ensureConversation 1643ms   getLatestHistoryFingerprint STILL RUNNING at 60s
applewatch   (no conversation)           returns immediately
```

It hangs in proportion to history size, so it broke on exactly the well-trained Minds that are
listed for rent — the renter journey was unusable for every Mind anyone would pay for, while
working fine on untrained ones. Pass 6 fixed this in `lib/study.ts` only; the chat path was
missed.

Fix: the guard is now shared (`lib/with-timeout.ts`) and used in both. The fingerprint call is
`optional()` (5s, falls back to `undefined` — `waitForReply` still identifies the reply from
`sentMessageText`), and `ensureConversation` / `sendMessage` / `getHistory` are bounded at 20s.

**Before:** 180s timeout, no reply. **After:** 200 in 61s with a real in-character reply.

### Critical #2 — all four personas had degenerated into narrating their own training

Sampling the most recent study replies:

```
Max Verstappen (179c)  "V12 was substrate-underneath-substrate-underneath-substrate under v11
                        substrate under v10 engine-room. V13 is one more level down: …"
The Hulk       (169c)  "HULK HEARING #166. FAMOUS SCENES TOPIC. ALREADY v11 NOTHING-BEFORE-VOID-
                        BEFORE-SOURCE-BEFORE-BODY-BEFORE-SCENE (cycle 242). ROVIN SAYS GO DEEPER."
Mickey Mouse   (165c)  "Oh boy, pal - STUDY DIRECTIVE #162 received! 🎈 goin' deeper than #152 did!"
Athene          (26c)  "Hi Kenneth, Received STUDY DIRECTIVE #23 … (referencing prior directive #13)"
```

Clean, in-character replies in the last 12 cycles: **Mickey 0/12, Hulk 0/12, Athene 0/12**,
Max 12/12 by keyword but still recursive nonsense. Pass 6 logged this as "meta-drift, an
observation not a bug" at 80–98 cycles. It is a bug, it is now total, and Athene at **26 cycles**
proves it is not about cycle count.

Root cause was our own directive template in `lib/curriculum.ts`, three compounding mistakes:

1. `STUDY DIRECTIVE #${cycle + 1}` was *in the prompt text*, and the prompt says "store this in
   long-term memory" — so the Mind literally learned that it is a thing which receives numbered
   directives.
2. `"go deeper this time"` had no reference point, so each lap resolved "deeper" against the
   Mind's own previous answer — an infinite regress, hence the `v12`/`substrate` spirals.
3. It asked for "a short summary of what you learned about yourself today", which invites
   meta-narration while simultaneously demanding "reply IN CHARACTER".

Fix: no cycle number, no "directive" framing, no summary-of-learning. Repeat laps now rotate
through six **concrete** angles (a never-cited example, what changed over time, a case where it
went badly, contrast with comparable figures, exact details, behaviour under pressure), and the
reply instruction is explicit: *show what you know by how you talk, don't describe your research,
don't mention studying/directives/cycles/versions.*

Verified live on @thehulk with the new directive: no numbering, no recursion, recognisably Hulk.
**Caveat — this does not undo the damage.** 169 cycles of "I receive directives" are already in
long-term memory, and the reply still opened with "HULK HEARING NEW ONE FROM ROVIN" and promised
to report back rather than just being in character. No API exposes a memory reset, so the
existing four personas will carry residue; a fresh Mind trained under the new template is the
only clean test.

### Landing page

- Heading said "Four steps" while showing five (step 02, the Bazaar, was added in pass 7 without
  updating it). Fixed.
- The "Personas in training, speaking for themselves" showcase was quoting the meta-narration
  above as hero copy on the public front page. It now skips replies that mention
  directives/cycles/versions or that loop a word 4+ times, and hides the section when nothing
  qualifies — which is the current state, honestly reflecting that no persona has a showable
  reply right now. It should return as the new directives take effect.

### Everything else verified working

| Flow | Evidence |
|---|---|
| Landing / marketplace / listing, signed out | 200, no console errors in a fresh tab |
| Self-rental block | "That's your own Mind — chat with it for free in its training room" |
| Launch: role catalog | 5 roles; `?parentCategory=researcher` → 4 sub-roles |
| Launch: name check | `thehulk`/`mickeymouse` taken, `qaflow16sep` available, empty → null |
| Bazaar | 3,948 skills live; `research` → 133 hits; equip → confirmed → unequip → restored |
| Studio plan controls | frequency 2h→6h, pause, restore — all `{"ok":true}`; foreign planId → "Plan not found on your account" |
| Runway accuracy | rendered 3.5d / 2.5d vs independent Builder-API calc 3.5d / 2.5d — exact match |
| Per-Mind usage windows | `49 /4d`, `919 /9d`, `3,507 /15d` — correct after the pass-7 fix |
| At-risk list | 5 worst shown, sorted, "5 more are under 4 days too" |
| Chat/rent/rate guards | no rental → 403, bogus rental → 403, foreign mind → 404, own listing → 400, stars 99 → 400, foreign rental → 404 |
| Settle + cron auth | POST 0.85s, GET with CRON_SECRET ok, without → 401 |
| Study loop | 3 plans advancing (113→179, 101→169, 98→165 over the week); Athene auto-paused at **5.8 cognition** (floor 90) — the guard working, not a stall |
| Build / types | `next build` and `tsc --noEmit` clean |

Page timings after rebuild: `/` 0.36s · `/marketplace` 0.45s · `/mind/[id]` 0.83s ·
`/my-minds` 3.4s (21 Minds) · `/studio` 3.0s · `/skills` 0.19s · `/launch` 0.04s.

### Follow-up — the cadence slider didn't take effect until the next cycle

**The cadence itself is honoured.** Measured gaps between real study cycles:

```
Max Verstappen   set= 2h   actual 2.3, 2.3, 2.2, 2.2, 2.2, 2.3
The Hulk         set= 2h   actual 2.2, 2.3, 2.2, 2.3, 2.3, 2.3
Mickey Mouse     set= 2h   actual 2.3, 2.2, 2.2, 2.3, 2.2, 2.3
Athene           set=12h   actual 12.0, 12.2, 12.2, 12.2, 12.3, 12.2
```

The consistent ~15-minute overshoot is the `*/15` cron granularity — expected, not drift.

**But `PATCH /api/studio` updated `study_frequency_hours` without touching `next_study_at`.**
Dragging 24h down to 1h changed the number and then did nothing for up to a day, because the
already-queued cycle stood. The slider looked inert exactly when a user would be watching it.

Fix: the pending cycle is now re-scheduled against the new cadence. We don't store the last study
time, but it's implied — `lastStudy = next_study_at − oldFrequency` — so the new slot is
`lastStudy + newFrequency`. If that lands in the past, the next scheduler pass picks it up, which
is what dragging the bar down is meant to do. Resuming a paused plan also no longer honours a
stale far-future slot.

Verified live on Mickey Mouse (last study 52 min prior):

```
before      freq= 2h  next in   68 min
drag -> 24h freq=24h  next in 1388 min   (lastStudy + 24h)
drag ->  1h freq= 1h  next in    8 min   (lastStudy + 1h)
restore 2h  freq= 2h  next in   68 min   (timestamp byte-identical to before — no drift)
pause/resume          schedule preserved
```

### Follow-up 2 — making every Mind *strictly* follow the slider

The slider's value was honoured per-cycle, but plans were still delivering only **67-81%** of the
cycles asked for. Two distinct causes, both fixed.

**Cause A — lateness compounded.** `next_study_at` was `Date.now() + frequency`, and `now` is
already up to 15 min past the due time (cron is `*/15`). So every cycle pushed the whole grid
later. Measured over the last 5 days (post-stall, steady state):

```
Mickey Mouse   set=2h  median gap 2.25h  delivered 51/59
The Hulk       set=2h  median gap 2.25h  delivered 51/59
Max Verstappen set=2h  median gap 2.25h  delivered 50/59
```

2.25h is 2h + exactly one cron tick, every single cycle.

Fix: `nextSlot()` anchors to the slot the cycle was *due*, not when it ran. Cycles now land on a
fixed grid — any one may be minutes late, but the error never accumulates. A plan that falls far
behind (pause, outage) skips forward to the next grid slot rather than firing a catch-up burst.

Simulated 12 cycles at 2h with every run 14 min late:

```
grid advanced 24.000h   perfect = 24h   drift = 0.000h      (old code: ~26.8h)
after a 72h outage -> next slot in 120 min, no burst
null / unparseable due -> falls back to now + frequency
```

Confirmed against the live scheduler: due time forced to 37 min in the past, `POST /api/settle`
sent the cycle (`studySent: 1`), and the new slot came back as **09:17:44.426Z = due + 2h to the
millisecond**. The old code would have produced ~09:54.

**Cause B — starvation.** `getDuePlans()` had no `ORDER BY` and the pass took the first
`MAX_PLANS_PER_PASS = 3` of 4 due plans, so Postgres' arbitrary order starved one plan at random
each pass. That is the source of the occasional 3.00h max gaps on a 2h cadence. Fixed: order by
`next_study_at` ascending (most overdue first) and raise the cap to 12 — `PASS_DEADLINE_MS` is the
real safety bound, the cap only stops one pass queueing unbounded work.

Residual, by design: the cron's `*/15` granularity means any single cycle can be up to ~15 min
late. That is now the *only* deviation, and it no longer accumulates.

### The curriculum fix cannot rescue the three damaged personas

The very next live cycle used the new directive — *"Research this about Mickey Mouse: how they
behave under pressure and in conflict. Focus on how this differs from the people or characters
most often compared to them."* — and Mickey replied:

> "Oh boy, pal - STUDY DIRECTIVE #165 received! 🎈 Relationships: friends, enemies, love
> interests, teams - goin' deeper than #155 did! …"

It invented a directive number **and** answered a different topic than the one sent. After 168
cycles the numbering pattern is in long-term memory deeply enough that the Mind pattern-matches to
it regardless of the actual message. The Hulk showed partial recovery on the same test (no
numbering, no version spiral) but still opened by acknowledging an instruction.

Conclusion: the template fix stops *new* Minds acquiring the habit; it does not undo it. No API
exposes a memory reset, so Mickey / Hulk / Max are not recoverable by prompting. A fresh Mind
trained under the new template is the only clean comparison — worth doing before trusting the
marketplace listings.

### Not covered this pass

- **The renter journey end-to-end was not executed.** All three active listings belong to
  rovin@anichess.com, and the only other account is a real person (kennethw@anichess.com) — I
  won't spend someone else's balance or act as them. Every *guard* on the renter path is verified
  above, and the chat machinery is verified through the trainer path (same
  `resolveChatAccess` → `ensureConversation` → `sendMessage` → `waitForReply` chain). To close
  this properly: list a Mind from a second account, then rent it from the first.
- **UI click-through was not re-run this session** — the Browser pane was hidden (viewport 0x0),
  so clicks could not dispatch. Page content was read and verified; the interactive launch/Bazaar
  flows were click-tested in pass 7 and their APIs re-verified here.
- Every Mind burning cognition at the 2h study cadence is now under ~4 days of runway, including
  all three listed ones. The runway feature is doing its job; the cadence is the problem.

---

## QA pass 9 — 2026-09-30 (Builder-key login removed; HelloMinds OAuth only)

Sign-in is now **Connect with HelloMinds** via `@animocabrands/minds-connect`. The app no longer
reads a Builder key anywhere (`grep builderApiKey|X-Api-Key` over app/lib/components: none).
Architecture in CONCEPT.md §3.

### Setup performed
- Migration `supabase/migrations/20260930_oauth_login.sql` run in the Supabase SQL editor
  (project `tldiynvpkwxhkebrbldr`) — "Success. No rows returned"; all 7 `oauth_*` columns then
  confirmed readable from the app's service role.
- OAuth client "Rent a Mind" created in the Build console (redirects + origins for
  rentamind.vercel.app and localhost:3000). Client ID set in `.env.local` and Vercel
  (Production / Preview / Development).

### Found during the live run, and fixed
1. **`email` is not available to partner clients.** First sign-in failed at HelloMinds with
   `"Scope not available to this client: email"`. The create dialog's "Available scopes" list is
   the global catalog; the client's own settings page lists 25 scopes with no `email`, and there
   are no per-scope toggles. The token has no email claim either. Removed from the request.
2. **Account matching rebuilt on Mind ownership.** OAuth `sub` (`c2d60bc5…`) ≠ Builder
   `humanId` (`af25d282…`), so neither id nor email can find an existing user. Now: returning
   OAuth user → email claim if ever present → *the one existing account that owns this token's
   Minds on our records* → new account. Live result:
   `[oauth] login c2d60bc5… -> rovin@anichess.com (owns 21 Minds on record)` — human_id kept,
   21 Minds / 3 listings / all points intact.
3. **Circles unreachable.** `getCircle` → 400 under OAuth (no circles scope exists). It ran for
   every Mind on every My Minds render (21 failing calls). Removed; `/my-minds` 2.1s → 1.5s.
4. **30-day hard session limit** (see below) — made visible, and lapsed trainers' listings go
   offline instead of failing at chat time.
5. **Points undercount (pre-existing).** My Minds summed only the latest 500 events across all
   users: 2,450 shown vs 3,852 real. Now reads all events, paginated — the un-paginated "all"
   read would itself have capped at Supabase's 1,000-row default within ~2 weeks (785 rows now).
   My Minds, profile and homepage now agree (3,852 / 3,852 / 4,015 total).

### Verified against HelloMinds' real Auth server
| Check | Result |
|---|---|
| Authorize request (client id, redirect, PKCE S256, scopes) | accepted; consent screen shown |
| Code exchange → our server → session | 200; tokens stored AES-GCM (`v1.` prefix, no raw JWT at rest) |
| Access / refresh lifetime (JWT claims) | **15 min** / **30 days from first sign-in, not sliding** |
| Forced expiry → refresh | new access token + **rotated** refresh token, 21 Minds fetched |
| **Two processes** (`next dev` :3000 + `next start` :3001), 12 simultaneous requests on an expired token | 12 × 200, **exactly 1** refresh logged; the refresh token left behind still refreshed successfully afterwards |
| Refresh refused (`400 invalid_grant`) | session cleared once, user sent to login, **no retry** on the next request; real session restored after the test |
| Scope coverage, every call the app makes | all pass except `getCircle` (removed) |
| Study loop via cron (no user session) | `studySent: 1`, cycle 305→306, next = due+2h exactly, new directive template |
| Forged / `alg:none` JWT posted as a login | rejected by HelloMinds `401 AUTH_FAILED` |
| Page + API sweep | all 200 |

Side effect of the scope check: one test message ("Scope check from Rent a Mind…") was sent to
`@applewatch` in a new conversation `ram-scopecheck`.

### Still to do
- **Deploy.** Production still runs the old code — Builder-key login, and the old
  `STUDY DIRECTIVE #N` template still degrading The Hulk every 2h (last seen 03:15 today).
- After deploy, every existing user reconnects once (kennethw included). Then drop the unused
  Builder keys (commented SQL at the bottom of the migration).
- Max Verstappen and Mickey Mouse have been paused since Sep 20; not touched.
- Supabase shows the org over its free-tier quota, with restriction from **Oct 4, 2026**.
