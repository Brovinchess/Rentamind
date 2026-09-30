# HelloMinds Core API — what we use, what we can't, and why

Source: `https://docs.hellominds.ai/core-api/openapi.json` — "HelloMinds Core API" v2.10.0.
Servers: `https://api.hellominds.ai`, `https://api.preprod.hellominds.ai`. 74 paths.
Read and probed live Sep 9, 2026. Everything below was captured from the live API.

## Three different APIs

| Surface | Host | Auth | Used here? |
|---|---|---|---|
| **Builder API** | `api.build.hellominds.ai` | `X-Api-Key` = user's Builder key | Yes — messaging, balances, usage, circles, equip |
| **Partner / Ethoswarm** | `dev.ethoswarm.ai` | species-scoped partner key | No — our key is rejected ("Unknown API key") |
| **Core API** | `api.hellominds.ai` | user-session JWT (cookie or Bearer) | Yes, **the public half** |

**56 of 74 Core operations need a user session. 18 are public.** We use the public ones.

### The Builder key is not a Core session token

Decoded, our Builder key is a JWT with `role: "builder"`, `iss: "useminds-backend-authentication"`,
`iat` 2026-07-20, `exp` 2027-07-20 — **not expired**. The Core API still rejects it:

```
Authorization: Bearer <builder key>   -> 400 BAD_INPUT/VALIDATION_FAILED
                                         "Invalid token: Authentication token is invalid or expired"
no auth at all                        -> 400 "Authentication required: no auth token provided"
```

Two different messages, so the key is read and rejected on its claims — not ignored. Confirmed
against `/v1/humans/{hid}/minds`, `/v1/minds/{id}/credits`, `/runway`, `/schedule`.

## The 18 public endpoints

```
GET  /v1/auth/ping
GET  /v1/minds/{mindId}                      ← id + name only (see below)
GET  /v1/minds/check/name?name=              ← { isAvailable }          ★ we use this
GET  /v1/bazaar/{,apps,skills,tools,stats,graph,...}                    ★ we use this
GET  /v1/species/{species}{,/items}          ← role taxonomy            ★ we use this
GET  /v1/referral/species/{species}/referral-usd
POST /v1/auth/login                          ← Airkit token exchange
POST /v1/auth/logout
POST /v1/payments/minds/{mindId}/checkout    ← Stripe checkout          ★ we use this
```

### `GET /v1/minds/{mindId}` is thinner than the schema suggests

`MindDetailItem` declares 9 fields; the anonymous projection returns **exactly two**:

```json
{"mindId":"9620513e-f36b-1410-8466-00039ce7df11","name":"thehulk"}
```

Omitted: `species`, `isEnabled`, `email`, `walletAddresses`, `chains`, `telegramBotId`, `archetype`.
So there is **no free avatar, description, species, archetype, owner, stats, or created date**.
It is an existence-and-name oracle, nothing more. Unknown ids return 400, not 404.

### `GET /v1/minds/check/name` — used by the launch flow

```
?name=thehulk                  -> {"isAvailable":false}
?name=zzqx9truly-not-taken     -> {"isAvailable":true}
missing/empty name             -> 400 "Name query parameter is required"
```

We proxy this through `GET /api/launch?name=` behind a session, so it can't be used anonymously
as a name-enumeration oracle through our app.

### Species taxonomy — used by the launch flow

Two levels. `GET /v1/species/moca/items` returns 5 roles; `?parentCategory=assistant` descends.
(`category` filters to one node; only `parentCategory` drills down.) `moca` is the only species
observed; anything else 400s.

Each node has `title`, a short `description`, `iconName`, `equippedToolSlugs` (a JSON-encoded
**string**, not an array), and `dna` — which for some roles is an entire multi-page system prompt,
so the UI uses `description`.

### Bazaar — used by the Bazaar page

`stats` -> `{"mindSkills":3921,"mindTools":257,"apps":327}`. Uniform envelope
`{totalCount, page, pageSize, items}`, default pageSize 25, `search` on apps/skills. Every item
carries a name, description, `createdAt`, and an `equippedCount` popularity signal.

We browse this catalog anonymously and then **equip with the user's own Builder key** — the two
halves come from different APIs, which is why the Bazaar page works at all.

### `POST /v1/payments/minds/{mindId}/checkout` — implemented, upstream is broken

Validation ladder, in this exact order (each confirmed by a distinct error):

| condition | response |
|---|---|
| no `email` (unauthenticated) | `"email is required"` |
| `cadence: "monthly"` unauthenticated | `"Only one-time payments are available"` |
| `amountCents` < 200 | `"amountCents must be at least 200"` — **minimum is $2.00** |
| everything valid | **`ETHOSWARM_API_FAILED "Bad Request"`** |

Tested at 200/201/500/5000/100000/1e6/1e8/999999999 cents, with and without localhost redirect
URLs, on prod and preprod. **No combination ever returned a Stripe URL.** The wrapper accepts the
request and Ethoswarm rejects it — most likely these Minds aren't payments-provisioned upstream.

`POST /api/topup` implements the whole flow and surfaces the upstream message verbatim rather than
faking success; the UI then points at app.hellominds.ai. It starts working the moment HelloMinds
fixes their side, with no code change.

### No anonymous path to owner, balance, credits, runway or schedule

`/credits`, `/runway`, `/schedule` all hard-fail before touching data. Owner and balance are
reachable only via a session JWT or the Builder key.

## Sign in with HelloMinds — now built, via the sanctioned OAuth SDK

**Superseded (Sep 30, 2026).** This section originally concluded there was no sanctioned way for a
third-party app to sign in HelloMinds users: the Core API's `POST /v1/auth/login` only accepts
Airkit tokens scoped to HelloMinds' own partner ID, and minting those would have meant
impersonating their first-party web client. That remains true of the Core API.

On Sep 23, 2026 HelloMinds published a proper partner OAuth flow instead:

- `@animocabrands/minds-connect` — browser OAuth 2.1 authorization code + PKCE. Auth API at
  `https://api.oauth.hellominds.ai` (`/v2/oauth/login`, `/v2/oauth/token`, `/v2/oauth/revoke`).
  Public client: `client_id` only, no secret. Clients are registered in the Build console with an
  exact redirect URI and origin.
- `@animocabrands/minds-client-lib` ≥0.1.7 accepts `{ accessToken }` as well as a Builder key, and
  adds `awakenMind()` + `checkMindName()`.
- 26 scopes, including `minds:awaken`. The OAuth token is for the **Builder** API — it does not
  unlock the Core API's runway / schedule / payments endpoints.

Rent a Mind now uses this exclusively; see CONCEPT.md §3 for the architecture. Verified before
wiring it in: a forged JWT claiming to be an existing user, and an `alg:none` JWT, are both
rejected by the Builder API with `401 AUTH_FAILED` — which is what makes it safe for
`POST /api/auth/oauth` to accept tokens from the browser.

## Builder API quirk found while building runway: usage is only retained ~15 days

`getCognitionUsage(mindId, {interval:"1d", startTime})` **ignores any `startTime` earlier than
about 15 days ago** and returns the same buckets regardless:

```
-7d   ->  8 buckets, earliest 2026-09-02
-14d  -> 15 buckets, earliest 2026-08-26
-30d  -> 15 buckets, earliest 2026-08-26   identical
-60d  -> 15 buckets, earliest 2026-08-26   identical
-90d  -> 15 buckets, earliest 2026-08-26   identical
-365d -> 15 buckets, earliest 2026-08-26   identical
explicit window -60d..-30d -> 0 buckets
```

Buckets are dense (one per day, a 7-day ask returns 8), so **the bucket count is the number of
days covered** — which is fewer than 15 for a young or barely-used Mind. This is why the app now
reports a per-Mind window instead of a fixed one, and why "Burn · 30d" was wrong for the whole
life of the project.

## Runway and schedule: reimplemented, not borrowed

`GET /v1/minds/{id}/runway` is session-gated, so `lib/runway.ts` computes the same thing from
Builder-API usage, using their documented definition: **balance ÷ mean daily spend over a trailing
14-day window**, with `status: "estimated" | "idle"`. Same field names, same semantics — swapping in
the native call later touches one function.

`GET /v1/minds/{id}/schedule` (native scheduled cognition cycles) is also session-gated. Our cron
study loop is the substitute; `next_study_at` on a training plan is our equivalent of a
`ScheduleCycle`.

## Cross-cutting API quirks

- Auth failures and not-found both return **HTTP 400**, never the 401/403/404 the spec documents.
- Errors are `{method, url, error: {type, subType, message}}`; `subType: "ETHOSWARM_API_FAILED"`
  means the failure came from upstream, not from the request shape.
