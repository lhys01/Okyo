# Okyo Scalable Data Architecture Plan

**Status:** Audit + plan only. No code, config, database, or infrastructure was changed to produce this document.
**Scope:** `apps/api` (Node/Express backend) and `apps/mobile` (Expo/React Native) as of 2026-08-18, branch `onboarding-improved-stage1`.

---

## 1. Executive Recommendation

Okyo today has **no durable backend persistence of any kind**. `apps/api` is a stateless Express process holding everything — saved recipes, savings totals, XP, rate-limit counters, AI caches — in module-scoped JS `Map`/`Array` variables (`apps/api/src/store.ts`, `apps/api/src/services/aiService.ts`, `apps/api/src/middleware/costControls.ts`). There is also **no user identity** (no auth, no device ID) and **no image storage** (photos travel as base64 inside the JSON request body and are discarded after the AI call). RevenueCat entitlement state lives only on-device.

This is not a scaling problem yet — it is a **correctness and durability problem at any user count above 1**, because a server restart or a second instance silently breaks it. The good news: the fix does not require heavy infrastructure. It requires:

1. **One managed PostgreSQL database** (Neon or Railway Postgres — see §3) as the single source of truth for everything currently faked by `store.ts`.
2. **One object storage bucket** (Cloudflare R2, recommended for zero egress fees) for scan images, used only if a user saves a recipe (per `AGENTS.md:99`: "Do not store user food images unless the user saves a recipe or explicitly opts in").
3. **A minimal identity layer** — anonymous install ID first (no email/password required), upgradeable to real accounts later — so per-user data and quotas can exist at all.
4. **Moving the existing in-memory rate limiters/caches into Postgres or a small Redis instance**, since the code already has explicit `// ponytail:` comments marking exactly where this is needed (`aiService.ts:87`, `openRouterProvider.ts:1123`, `costControls.ts:43`).

No queue system, no read replicas, no sharding, no Kubernetes, no multi-region — none of it is justified by the current or 100k-user workload (see §9). The dominant cost at scale will be **AI inference (OpenRouter)**, not the database — see §9.

---

## 2. Current Architecture Map

### 2.1 Sources of truth (all ephemeral, all in-process)

| Data | Where it lives today | Durability | Shared across users? |
|---|---|---|---|
| Saved recipes, savings, XP, challenges | `apps/api/src/store.ts` (`Array`/`Map`) | Wiped on restart/deploy | **Yes — shared by ALL clients hitting the process** (no per-user key exists) |
| Scan analysis context | `analysisStore` Map, 15 min TTL | Wiped on restart | Global, keyed by analysisId only |
| Generated recipe revisions | `generatedRecipeStore` Map, 24h TTL | Wiped on restart | Global, keyed by recipeId |
| Scan-level AI cache | `aiService.ts` Map, 24h TTL, key = sha1(image)+mode+pipeline-version | Wiped on restart | Global |
| Recipe-level AI cache | `openRouterProvider.ts` Map, 7-day TTL, key = dish+ingredients+mode | Wiped on restart | Global |
| Rate limits / daily AI caps | `costControls.ts` module-level counters | Wiped on restart | **Per-process** — multiple instances multiply the effective cap |
| Onboarding answers, dietary prefs, grocery lists, cook sessions, completed meals, saved-recipe IDs, weekly scan count, isPremium flag | AsyncStorage via Zustand `persist` (`apps/mobile/src/state/useOkyoStore.ts:702-753`) | **Device-local only** | N/A — never leaves the device |
| RevenueCat entitlement | On-device SDK state only (`apps/mobile/src/services/revenueCat.ts:14`) | Device-local | N/A |
| Scan images | Base64 in request body → forwarded to OpenRouter → discarded. Local copy at `FileSystem.documentDirectory/okyo-scan-images/` | Device-local | N/A |
| Quality/cost telemetry | JSONL files on local API disk (`apps/api/data/*.jsonl`) | Lost on redeploy (ephemeral container FS) | N/A |
| Static content (mock scans, restaurant packs, badges, leaderboard, XP defs) | `apps/api/src/mockData.ts` | Read-only, code-deployed | Shared, static |

### 2.2 Every current API read/write path

All routes live in `apps/api/src/server.ts` (single file, ~917 lines). Notable ones:

- `POST /v1/scans`, `POST /v1/scans/analyze`, `POST /v1/scans/analyze/:analysisId/recipe` — synchronous, in-process AI call chain, no queue.
- `GET/POST /v1/library`, `POST /v1/recipes/:id/save` — read/write `store.ts` arrays, **no user scoping**.
- `POST /v1/recipes/:id/correct`, `POST /v1/recipes/:id/coaching`, `POST /v1/recipes/:id/ask` — synchronous OpenRouter calls with in-memory idempotency de-dup (10 min TTL, per-process).
- `GET /health` — hardcodes `databaseEnabled: false`.

### 2.3 Single points of failure / risks (present-tense, current codebase)

1. **Any second API instance breaks correctness, not just performance.** Rate limits, daily AI caps, and idempotency keys are per-process. Running 2 instances behind a load balancer doubles the effective `AI_DAILY_REQUEST_CAP` and lets duplicate requests through — this is a cost and correctness bug waiting to happen the moment horizontal scaling is attempted.
2. **All "saved" data is cross-user-shared and non-durable simultaneously** — worst of both worlds: no privacy boundary (everyone shares the same in-memory library) and no persistence (a restart deletes it for everyone).
3. **No image persistence** means "saved recipes" have no way to redisplay the original photo, and there is no dedup — identical images (repeat photos of the same dish) are re-sent to the AI provider and pay full inference cost every time (mitigated somewhat by the scan-level cache, but that cache is also per-process and wiped on deploy).
4. **No user identity** means quotas, saved data, and premium status cannot be honestly enforced server-side. The stated 3-scans/week free tier (`docs/wiki/MONETIZATION.md`) is enforced only client-side in AsyncStorage — trivially bypassed by reinstalling.
5. **RevenueCat is unverified server-side.** A user's premium status is whatever their local SDK reports; there's no webhook, no cross-device sync, and no way to server-gate premium features honestly.
6. **File-based telemetry (`apps/api/data/*.jsonl`) does not survive redeploys** on any ephemeral-filesystem host (Railway containers included), so quality/cost analytics silently loses history on every deploy.
7. **No exponential backoff / no secondary AI provider.** A transient OpenRouter outage or rate-limit produces immediate user-facing failure with no retry-with-backoff. (One quality-driven retry exists for ambiguous vision output — not a resilience mechanism.)

---

## 3. Workload Model (assumptions, not measurements — mark and verify before committing budget)

Three scenarios. All numbers are illustrative assumptions for capacity planning, not measured production data (there is no production yet).

| Metric | Low (early stage) | Medium (10k MAU) | High (100k MAU) |
|---|---|---|---|
| Registered/installed users | 500 | 30,000 | 250,000 |
| Monthly active users (MAU) | 200 | 10,000 | 80,000 |
| Daily active users (DAU, ~20% of MAU) | 40 | 2,000 | 16,000 |
| Scans per active user / month | 8 | 8 | 10 |
| Avg image payload (base64 JSON today; assume compressed JPEG ~300KB if object-stored) | 300 KB | 300 KB | 300 KB |
| Recipe records created / month | ~1,600 (200×8) | 80,000 | 800,000 |
| Saved recipes / month (assume 25% of generated recipes get saved) | 400 | 20,000 | 200,000 |
| Grocery-list operations / month (create/update items, ~3x saved-recipe count) | 1,200 | 60,000 | 600,000 |
| Read:write ratio (library/recipe views vs writes) | ~5:1 | ~5:1 | ~5:1 |
| Peak concurrent scan requests | <5 | ~50 | ~400 |
| DB storage growth / month (rows only, no images) | <50 MB | ~2 GB | ~20 GB |
| Object storage growth / month (only saved-recipe images, ~25% save rate × 300KB) | ~120 MB | ~6 GB | ~60 GB |
| AI-generation jobs / month (scan + recipe + optional correction/coaching calls) | ~2,500 | 130,000 | 1,300,000 |

**Key assumption to flag explicitly:** the 25% save rate and 10 scans/user/month are guesses modeled on typical freemium food-app behavior, not Okyo-measured data. Revisit after the first real cohort of TestFlight/beta users.

---

## 4. Recommended Target Architecture

### 4.1 Decision table

| Component | Recommendation | Why |
|---|---|---|
| **Primary database** | **Neon Postgres — DECIDED (2026-08-18)** | Serverless Postgres, scale-to-zero, built-in pooler, generous free tier, branching for migrations. Cheapest realistic option for "small usage today, need to survive a spike later" without managing a server. Confirm Railway hosting for `apps/api` itself externally (not found in-repo) — if API does end up on Railway, co-locating region reduces latency, but the DB choice itself is settled as Neon. |
| **Object storage** | **Cloudflare R2 — DECIDED (2026-08-18)** | S3-compatible API (reuse `@aws-sdk/client-s3`), **zero egress fees** (unlike S3), cheap storage ($0.015/GB/mo). Egress matters here because recipe images get displayed repeatedly in the saved-recipe library. |
| **CDN** | R2's built-in public-bucket CDN (or Cloudflare in front of R2) | Free with R2, no separate CDN service needed at this scale. |
| **Connection pooling** | **Neon's built-in PgBouncer-compatible pooler** (or Railway's pooled connection string) | Serverless/edge-friendly API deployments open many short-lived connections; pooling is mandatory from day one, not an upgrade-later item — Neon includes it free. |
| **Redis** | **Not needed at Low/Medium scale.** Use Postgres for rate-limit counters and idempotency keys (a single `UPDATE ... RETURNING` or `INSERT ... ON CONFLICT` is fast enough at these volumes). Introduce Upstash Redis (serverless, pay-per-request, ~$0 at low volume) only if Postgres-based rate limiting shows measurable latency at High scale. | Avoids running/paying for a second stateful service before it's proven necessary — matches the "default principle" in the brief. |
| **Background jobs / queue** | **Not a message broker.** Use Postgres-backed job rows (a `ai_jobs` table with `status`, `attempts`, `next_attempt_at`) polled by a lightweight worker loop (`setInterval` in a second small Node process, or a Railway/Render cron-triggered worker). | AI generation volume (≤1.3M/month at High scale ≈ 500/min peak) does not need Kafka/SQS-grade throughput. A Postgres queue (the "poor man's queue" pattern) is simple, transactional with the rest of the data, and one team member can operate it. |
| **Serverless functions** | Not needed — keep the existing single Express app, just make it horizontally scalable (stateless once persistence moves to Postgres/R2). | Avoids a rewrite; the brief explicitly asks against big-bang rewrites. |
| **Multi-region** | No. Single region (co-located with the DB, e.g. US-East) is sufficient until Okyo has meaningfully international, latency-sensitive traffic. | Premature at any modeled scale. |
| **Read replicas** | No, until read QPS or replica-worthy analytics queries are measured and shown to contend with write latency. | Not justified by the workload model even at High scale (a few hundred QPS is well within a single well-indexed Postgres instance). |
| **Sharding** | No. | 20 GB/month growth at High scale over years is nowhere near single-Postgres-instance limits (multi-TB is fine on Neon/RDS-class Postgres). |
| **Kubernetes** | No. | Team is a small founder team; a single deploy target (Railway/Render/Fly) with 2-3 horizontally scaled API instances is sufficient and dramatically simpler to operate. |
| **Event streaming (Kafka etc.)** | No. | No use case requires it; the Postgres-backed job table covers the only "eventy" need (AI job processing). |

### 4.2 Why not Supabase (decided against)

Supabase bundles Postgres + auth + storage + realtime, which could've replaced multiple line items above. The repo's root `.env.example` references `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` from earlier consideration, but zero code ever used it. **User confirmed Neon + R2 (2026-08-18)** — Supabase auth is out of scope; identity layer (§5.1, `accounts` table) gets built directly against Neon as designed.

### 4.3 Target shape (Phase 1 destination, not built yet)

```
Mobile (Expo)
   │  HTTPS + anonymous-install bearer token (see §4.4)
   ▼
API (Express, same codebase, made stateless)
   │              │                    │
   ▼              ▼                    ▼
Postgres      R2 (images,          OpenRouter
(Neon)        saved-recipe only)   (AI provider,
                                    unchanged)
   ▲
   │ polled by
Worker loop (AI job retries, cache eviction, quota resets)
```

---

## 5. Proposed Data Model

Primary key strategy throughout: **UUID v7 (or ULID) primary keys** generated in application code — sortable by creation time (good for pagination), collision-safe across distributed writers, and don't leak sequential counts the way `SERIAL` does. All tables get `created_at timestamptz default now()` and `updated_at timestamptz default now()` (trigger-maintained).

### 5.1 `accounts` (identity)

- **PK:** `id uuid`.
- **Columns:** `install_id text unique not null` (anonymous, generated on first app launch, e.g. via `expo-application`'s installation ID or a UUID persisted in AsyncStorage), `email text unique null` (nullable — filled in only if/when Okyo adds real sign-in), `created_at`, `last_seen_at`.
- **Ownership boundary:** the account row itself; every other user-owned table has `account_id` FK to this.
- **Main read path:** looked up once per request via the bearer token (see §4.4) to resolve `account_id`; cache the mapping in the request context, not a separate store.
- **Main write path:** insert on first app launch (`POST /v1/accounts/bootstrap`), update `last_seen_at` on activity (fire-and-forget, doesn't need to block the request).
- **Indexes:** unique on `install_id`, unique on `email` (partial index `WHERE email IS NOT NULL`).
- **Retention/deletion:** hard-delete cascades to all owned tables (see §8 deletion design) on explicit account deletion request.
- **Store in:** Postgres.

### 5.2 `dietary_preferences`

- **PK:** `account_id uuid` (1:1 with account — no separate surrogate key needed).
- **Columns:** `diet_type text` (e.g. vegetarian/vegan/omnivore), `allergies text[] not null default '{}'` (kept as its own column, distinct from general preferences, because allergy data drives safety-critical filtering — never merge into a generic JSON blob), `dislikes text[] default '{}'`, `goal text` (from onboarding), `updated_at`.
- **Ownership:** account.
- **Reads:** on every recipe-generation request (to filter/flag), on profile screen.
- **Writes:** onboarding completion, settings screen edits.
- **Indexes:** PK only; low cardinality table, no additional index needed.
- **Retention:** deleted with account. Allergies specifically should never be silently dropped on a partial sync failure — writes here should be transactional with the onboarding-completion write, not fire-and-forget.
- **Store in:** Postgres (never cache allergy data in a way that could serve stale/missing allergy info).

### 5.3 `scans`

- **PK:** `id uuid`.
- **Columns:** `account_id uuid not null references accounts`, `image_object_key text null` (R2 key, null until/unless saved — see §7), `image_hash text not null` (content hash, for dedup/cache-key reuse — this is the server-side equivalent of today's `sha1(dataUrl)` cache key), `status text not null` (`pending|analyzed|failed`), `dish_name text`, `confidence numeric`, `mode text`, `idempotency_key text not null`, `created_at`.
- **Ownership:** account.
- **Reads:** `GET /v1/scans/:id`, library list.
- **Writes:** created at scan submission, updated when AI analysis completes.
- **Indexes:** `(account_id, created_at desc)` for the user's scan history; unique `(account_id, idempotency_key)` to make resubmission safe; index on `image_hash` for cross-request cache reuse.
- **Retention:** scans not converted to a saved recipe within N days (default 30) are eligible for cleanup (delete row + any object storage image) — see §7 retention job. Saved-recipe scans persist until account deletion.
- **Store in:** Postgres (metadata); image itself in R2 only if saved.

### 5.4 `recipes` (+ `recipe_revisions`)

- **`recipes` PK:** `id uuid`. Columns: `account_id uuid not null`, `scan_id uuid null references scans`, `current_revision_id uuid`, `title text`, `mode text`, `is_saved boolean not null default false`, `created_at`.
- **`recipe_revisions` PK:** `id uuid`. Columns: `recipe_id uuid not null references recipes`, `parent_revision_id uuid null` (mirrors today's `parentRevisionId`/`supersededBy` chain in `store.ts`), `body jsonb not null` (ingredients, steps, nutrition — the existing `Recipe` TypeScript shape from `types.ts` serializes directly here; JSONB avoids a huge wide table for a structure that's read-mostly and whose shape may still evolve), `generation_source text` (`ai|correction|coaching`), `created_at`.
- **Ownership:** account (via `recipes.account_id`).
- **Reads:** `GET /v1/recipes/:id` joins `recipes` + latest `recipe_revisions`; library list is `SELECT ... WHERE account_id = ? AND is_saved = true ORDER BY created_at DESC LIMIT/OFFSET` (cursor pagination — see §6).
- **Writes:** new revision row per correction/coaching edit (append-only, never mutate a past revision — matches the immutability principle and matches the existing revision-chain design already in the code).
- **Indexes:** `(account_id, is_saved, created_at desc)`, `recipe_revisions(recipe_id, created_at desc)`.
- **Retention:** unsaved recipes tied to an expired scan clean up together; saved recipes persist until account deletion or explicit unsave+cleanup.
- **Store in:** Postgres. JSONB body avoids needing a schema migration every time a recipe field is added, at the cost of losing column-level constraints on nested fields — acceptable tradeoff given the body is written by one trusted service (the AI pipeline), not directly by user input.

### 5.5 `saved_recipes`

Given `recipes.is_saved` already models save state, a **separate join table is only needed if recipes can be saved by multiple accounts** (e.g. a future "save someone else's shared recipe" feature). Not needed for V1 — use `recipes.is_saved` + `recipes.account_id`. Documented here to explain the omission rather than silently leaving it out.

### 5.6 `grocery_lists` / `grocery_items`

- **`grocery_lists` PK:** `id uuid`. Columns: `account_id uuid not null`, `recipe_id uuid null references recipes`, `title text`, `created_at`.
- **`grocery_items` PK:** `id uuid`. Columns: `grocery_list_id uuid not null references grocery_lists on delete cascade`, `name text not null`, `quantity text`, `is_checked boolean not null default false`, `sort_order int not null`.
- **Ownership:** account (via list).
- **Reads:** grocery screen — `SELECT items WHERE grocery_list_id = ? ORDER BY sort_order`.
- **Writes:** checkbox toggles are the highest-frequency write here — make them cheap single-row `UPDATE`s, not whole-list rewrites.
- **Indexes:** `grocery_lists(account_id, created_at desc)`, `grocery_items(grocery_list_id, sort_order)`.
- **Retention:** cascades with recipe/account deletion; consider a standalone TTL for lists never associated with a saved recipe.
- **Store in:** Postgres.

### 5.7 `cook_sessions` / `completed_meals`

- **`cook_sessions` PK:** `id uuid`. Columns: `account_id uuid not null`, `recipe_id uuid not null references recipes`, `started_at`, `current_step int`, `status text` (`active|abandoned|completed`).
- **`completed_meals` PK:** `id uuid`. Columns: `account_id uuid not null`, `recipe_id uuid not null`, `cook_session_id uuid null`, `completed_at`, `rating int null`, `estimated_savings numeric null` (snapshot at completion time — see §5.8 on why this is a snapshot, not a live-computed value).
- **Ownership:** account.
- **Reads:** savings dashboard, cook-history screen.
- **Writes:** `cook_sessions` updated frequently (step progression) — cheap, single-row, no need to version.
- **Indexes:** `cook_sessions(account_id, status)`, `completed_meals(account_id, completed_at desc)`.
- **Retention:** kept until account deletion; this is the historical record the savings dashboard depends on.
- **Store in:** Postgres.

### 5.8 `savings_snapshots`

- **PK:** `id uuid`. Columns: `account_id uuid not null`, `completed_meal_id uuid references completed_meals`, `restaurant_price numeric`, `homemade_cost numeric`, `amount_saved numeric`, `created_at`.
- **Why a snapshot table and not a live recompute:** `docs/wiki/COST_ENGINE.md` defines savings as a formula over ingredient costs, which can drift over time (ingredient price assumptions may be tuned later). Snapshotting at completion time means historical "total money saved" numbers stay stable even if the pricing model improves later — otherwise a pricing-model update would silently rewrite users' past savings history, which would read as dishonest (violates `CLAUDE.md`'s "Treat AI outputs as uncertain... never present as exact" spirit).
- **Reads:** `SUM(amount_saved) WHERE account_id = ?` for the dashboard total — cheap with an index.
- **Indexes:** `(account_id, created_at desc)`.
- **Store in:** Postgres.

### 5.9 `entitlements` (RevenueCat reference, not a receipt store)

- **PK:** `account_id uuid`.
- **Columns:** `revenuecat_app_user_id text unique not null` (the RC-side identity, mapped 1:1 to Okyo's `account_id` at bootstrap so RC's `app_user_id` = Okyo's `account_id` — simplest possible mapping, no separate lookup table needed), `is_premium boolean not null default false`, `entitlement_expires_at timestamptz null`, `updated_at`.
- **Explicitly NOT stored:** raw App Store/Play Store receipts, payment card data, or full RevenueCat webhook payloads. Only the minimal fields needed to server-gate a feature.
- **Reads:** on any server-gated premium check (e.g. server-enforced scan quota bump for premium users).
- **Writes:** from a new RevenueCat webhook endpoint (`POST /v1/webhooks/revenuecat`, does not exist today — this is new work, see §7 and §9 Phase 1/2) verified via RC's webhook signing secret.
- **Indexes:** unique on `revenuecat_app_user_id`.
- **Retention:** deleted with account; **do not** treat this table as a billing system of record — RevenueCat remains that. This table is a fast local cache of "is this account currently entitled," refreshed by webhooks and reconciled periodically (nightly job calling RC's REST API for any account whose webhook may have been missed).
- **Store in:** Postgres.

### 5.10 `idempotency_keys`

- **PK:** `key text` (client-supplied, e.g. UUID generated on-device per mutation attempt).
- **Columns:** `account_id uuid`, `endpoint text`, `response_body jsonb`, `status_code int`, `created_at`.
- **Purpose:** replaces today's per-process in-memory `correctionRequestResults`/`recipeRequestResults` Maps (`aiService.ts:89-100`) with a durable, cross-instance version — a retried request (mobile network flakiness is common) returns the cached response instead of re-running an expensive AI call or double-charging the daily cap.
- **Reads/writes:** `INSERT ... ON CONFLICT (key) DO NOTHING RETURNING *` at request start; if conflict, fetch existing row and return its cached response.
- **Indexes:** PK covers it. Add `created_at` cleanup index for the retention job (expire after 24h, matching today's TTL).
- **Store in:** Postgres (small, hot table — fine for Postgres at this volume; revisit only if idempotency-check latency is measured as a bottleneck).

### 5.11 `ai_jobs`

- **PK:** `id uuid`. Columns: `account_id uuid`, `job_type text` (`scan_analysis|recipe_generation|correction|coaching`), `payload jsonb`, `status text` (`queued|in_progress|succeeded|failed`), `attempts int not null default 0`, `max_attempts int not null default 3`, `next_attempt_at timestamptz`, `last_error text`, `created_at`, `completed_at`.
- **Purpose:** this is the "small job system" from §4.1 — replaces purely-synchronous AI calls with a durable, retryable record. The API can still respond synchronously for the common case (insert row, attempt immediately, respond with result) but now has a durable retry path when OpenRouter times out, instead of the current all-or-nothing single attempt.
- **Reads:** worker loop polls `WHERE status = 'queued' AND next_attempt_at <= now() ORDER BY created_at LIMIT N FOR UPDATE SKIP LOCKED` (standard Postgres queue pattern, safe for multiple worker instances).
- **Writes:** insert on job submission, update on each attempt.
- **Indexes:** partial index `WHERE status = 'queued'` on `next_attempt_at`.
- **Retention:** succeeded/failed jobs older than 30 days purged by cleanup job (keep for debugging window, not forever).
- **Store in:** Postgres.

### 5.12 `deletion_tombstones` (audit trail for account deletion)

- **PK:** `id uuid`. Columns: `account_id uuid` (the deleted ID, kept even after cascade-delete of the account row itself — this table is intentionally NOT FK-cascaded), `deleted_at`, `deletion_reason text null`.
- **Purpose:** proves a deletion request was honored (useful for support/compliance questions like "did you actually delete my data") without retaining any of the deleted content itself.
- **Store in:** Postgres, small table, effectively append-only.

### 5.13 Pagination, FK/cascade summary

- All list endpoints (library, grocery lists, cook history) use **cursor/keyset pagination** on `(created_at, id)` — never `OFFSET`, which degrades badly past a few thousand rows and every one of these tables will exceed that at High scale.
- Cascade behavior: `grocery_items → grocery_lists → recipes → accounts` and `recipe_revisions → recipes → accounts` all cascade on delete, so a single `DELETE FROM accounts WHERE id = ?` is sufficient to remove all owned data except the deliberately-non-cascaded `deletion_tombstones` row (written just before the delete, in the same transaction).

---

## 6. Table/Index Design Summary

| Table | Primary key | Core index(es) | Notes |
|---|---|---|---|
| `accounts` | `id` | unique `install_id`, unique `email` (partial) | |
| `dietary_preferences` | `account_id` | — | 1:1, allergies as own column |
| `scans` | `id` | `(account_id, created_at desc)`, unique `(account_id, idempotency_key)`, `image_hash` | |
| `recipes` | `id` | `(account_id, is_saved, created_at desc)` | |
| `recipe_revisions` | `id` | `(recipe_id, created_at desc)` | JSONB body |
| `grocery_lists` | `id` | `(account_id, created_at desc)` | |
| `grocery_items` | `id` | `(grocery_list_id, sort_order)` | high-frequency checkbox updates |
| `cook_sessions` | `id` | `(account_id, status)` | |
| `completed_meals` | `id` | `(account_id, completed_at desc)` | |
| `savings_snapshots` | `id` | `(account_id, created_at desc)` | append-only |
| `entitlements` | `account_id` | unique `revenuecat_app_user_id` | no receipts stored |
| `idempotency_keys` | `key` | `created_at` (for TTL cleanup) | replaces in-memory dedup maps |
| `ai_jobs` | `id` | partial `WHERE status='queued'` on `next_attempt_at` | Postgres-as-queue |
| `deletion_tombstones` | `id` | — | not cascade-linked to accounts |

Every FK column additionally gets a plain btree index (needed for the cascade deletes and joins above) — standard Postgres practice, not separately enumerated per table.

---

## 7. Storage and Image Strategy

Direct-to-R2 upload from the mobile client (presigned PUT URL), not proxying image bytes through the API:

1. Mobile requests a presigned upload URL: `POST /v1/scans/upload-url` → API generates an R2 object key (`scans/{account_id}/{scan_id}.jpg`), returns a short-lived (5 min) presigned PUT URL. This also means the API never needs the 16MB JSON body limit it has today (`server.ts:57`) — that limit exists only because images are currently embedded in JSON.
2. Mobile uploads directly to R2, then calls `POST /v1/scans` with the object key (not the image bytes) to kick off analysis.
3. API downloads the image from R2 server-side (or passes an authorized fetch URL, provider-dependent) to send to OpenRouter — this keeps OpenRouter API key usage server-only, matching current behavior.
4. **Content hashing for dedup:** compute `image_hash` (SHA-256) client-side or on first server touch; use it as the scan-cache key exactly as today's `sha1(dataUrl)` does, just durable in Postgres instead of an in-memory Map.
5. **Retention:** if the resulting scan is never saved as a recipe, delete the R2 object after 30 days (matches `scans` row cleanup, §5.3) via a nightly job querying `scans WHERE image_object_key IS NOT NULL AND status != saved AND created_at < now() - interval '30 days'`. If saved, the image persists until account/recipe deletion. This directly implements `AGENTS.md:99`'s "do not store user food images unless the user saves a recipe or explicitly opts in" — today's code already honors the *spirit* of this (no server storage at all); the new design must not regress it during the storage rollout.
6. **Validation:** enforce MIME type (`image/jpeg|png|webp` only) and max size (reuse existing `MAX_SCAN_IMAGE_BYTES` env var, ~12MB) at presigned-URL-generation time (reject the request) and again via R2 bucket policy (defense in depth).
7. **Upload expiry:** presigned URLs expire in 5 minutes; unused/orphaned R2 objects (uploaded but never referenced by a `scans` row within 1 hour) are swept by the same nightly cleanup job.
8. **Compression:** downscale/re-encode on-device before upload (Expo `expo-image-manipulator`, already compatible with the existing Expo stack) to a max dimension (e.g. 1600px) and JPEG quality ~80 — reduces both upload bandwidth and R2 storage cost with no accuracy loss for a vision model.
9. **Abuse prevention:** presigned-URL generation itself is rate-limited per account (reuse the existing sliding-window limiter, now keyed by `account_id` instead of IP once identity exists — IP-based limiting remains a secondary defense for pre-account requests).

---

## 8. AI-Job and Idempotency Design

Builds directly on `ai_jobs` (§5.11) and `idempotency_keys` (§5.10):

- **Idempotent scan submission:** mobile generates a UUID as the idempotency key per user-initiated action (a single button tap), sent as `Idempotency-Key` header. API checks `idempotency_keys` first; a retried request (timeout + client retry, common on mobile networks) returns the original result instead of re-running AI inference and double-charging the daily cap — this fixes a real gap: today's in-memory dedup (`aiService.ts:89-100`) doesn't survive a process restart mid-request-storm.
- **Retry policy:** `ai_jobs.attempts`/`max_attempts` (default 3) with exponential backoff (`next_attempt_at = now() + (2^attempts) * base_delay`), base delay ~5s. This is new resilience the current code lacks entirely (today: single attempt, immediate failure to the client on any OpenRouter error).
- **Failed-job cleanup:** jobs exceeding `max_attempts` are marked `failed` and surfaced to the client with the existing honest-failure UX (`AGENTS.md:105-113` — never show a fake result, always a clear friendly failure state). A nightly job purges `succeeded`/`failed` rows older than 30 days.
- **Per-user quotas:** move `AI_DAILY_REQUEST_CAP` and the per-account free-tier scan limit (currently client-only, `docs/wiki/MONETIZATION.md`'s 3/week) into a Postgres-backed counter: `SELECT count(*) FROM scans WHERE account_id = ? AND created_at > date_trunc('week', now())`, checked before allowing a new scan. This is what finally makes the free-tier limit real instead of trivially bypassable by reinstalling.
- **Global daily cap** (cost-safety net, independent of per-user quota): a single `ai_daily_counters(day date primary key, count int)` row, incremented via `INSERT ... ON CONFLICT (day) DO UPDATE SET count = count + 1 RETURNING count`, checked against `AI_DAILY_REQUEST_CAP` — same semantics as today's in-memory counter (`costControls.ts:45-72`) but durable and shared correctly across instances.

---

## 9. Privacy and Deletion Design

- **Data minimization:** the schema in §5 deliberately excludes anything not needed — no raw payment receipts (§5.9), no permanent storage of unsaved scan images (§7), no storage of RevenueCat webhook payloads beyond the fields in §5.9.
- **Account deletion, end-to-end:**
  1. Client calls `DELETE /v1/account`.
  2. API writes a `deletion_tombstones` row (§5.12).
  3. API issues `DELETE FROM accounts WHERE id = ?` — cascades remove all rows in §5 tables owned by the account (recipes, revisions, grocery lists/items, cook sessions, completed meals, savings snapshots, entitlements, dietary preferences).
  4. API deletes all R2 objects under `scans/{account_id}/*` (list + batch delete).
  5. API clears any cached entries keyed by the account (idempotency rows expire naturally within 24h; no long-lived cache keys by account exist per this design).
  6. If a third-party analytics provider is later wired in (§10 notes analytics is currently a disabled no-op — nothing to delete there today), issue that provider's user-deletion API call here too.
  7. RevenueCat itself is **not** deleted by Okyo (it's the source of truth for billing/subscription history, which has its own retention obligations) — Okyo only removes its own `entitlements` row, which severs the link on Okyo's side. Document this boundary for users in the privacy policy.
- **Backup deletion implications:** managed Postgres backups (Neon/Railway) retain point-in-time snapshots for a provider-defined window (typically 7-30 days). A deleted account's data will exist in backups until they age out — this is standard and should be disclosed in the privacy policy rather than engineered around (attempting to scrub individual rows from backups is not practical with managed Postgres).
- **Access control:** every query in the API layer must filter by `account_id` derived from the authenticated request context — never trust an `account_id` passed in the request body/query string. This is a straightforward but critical rule given today's code has zero precedent for scoped queries (everything is currently global).
- **Logging redaction:** continue the existing discipline (`AGENTS.md:97`: never log API keys or full base64 image payloads) and extend it to never log full `dietary_preferences.allergies` or `recipe_revisions.body` contents in error logs — log record IDs, not content.
- **Retention windows:** unsaved scans/images: 30 days. Idempotency keys: 24 hours. Completed `ai_jobs`: 30 days. Everything else: until account deletion.

---

## 10. Cost Model

Relative cost categories; **dollar figures below are unverified estimates and must be confirmed against current provider pricing pages before budgeting** (marked "requires verification").

| Category | Early stage (~200 MAU) | 10,000 MAU | 100,000 MAU | Dominant? |
|---|---|---|---|---|
| Database (Neon/Railway Postgres) | Free tier likely sufficient | Low tens of $/mo (small compute + <5GB storage) | Low hundreds of $/mo (larger compute tier, ~20GB+ storage) *(requires verification)* | No |
| Object storage (R2) | ~$0 (< 1GB) | ~$1-5/mo (storage) + $0 egress | ~$10-20/mo (storage) + $0 egress | No |
| Bandwidth/egress | Negligible | Negligible (R2 has no egress fee; API response payloads are small JSON) | Low, still small relative to AI | No |
| Background jobs (Postgres-backed, no separate service) | $0 (runs in existing API/worker process) | $0-few $/mo (maybe a small always-on worker dyno) | Tens of $/mo (dedicated worker instance) | No |
| Cache/queue (Redis, if/when introduced) | $0 (not needed) | $0-few $/mo (Upstash pay-per-request) | Tens of $/mo if introduced | No |
| Observability (error tracking, logs) | Free tier (Sentry/Logtail free tiers) | ~$0-30/mo | ~$50-100/mo *(requires verification)* | No |
| **AI costs (OpenRouter, gpt-4o-mini class model)** | **Low tens of $/mo** at ~2,500 calls/mo | **Hundreds of $/mo** at ~130,000 calls/mo | **Low-to-mid thousands of $/mo** at ~1.3M calls/mo *(requires verification against current OpenRouter/model pricing — vision calls in particular cost meaningfully more per call than text-only)* | **Yes — by a wide margin at every scale tier** |

**This is the single most important cost-model conclusion:** at every modeled scale, AI inference cost (OpenRouter vision + text calls) dwarfs infrastructure cost by roughly an order of magnitude or more. Database/storage/queue choices should optimize for *operational simplicity*, not marginal cost savings — the real cost lever is AI call volume (cache hit rate, dedup via `image_hash`, avoiding redundant correction/coaching calls), not which Postgres provider is chosen.

---

## 11. Scaling Thresholds

| Trigger | Action |
|---|---|
| Any 2nd API instance is deployed for the first time | Phase 1 (Postgres-backed persistence) must already be live — do not scale horizontally on the current in-memory code, it will silently corrupt rate limits/quotas. |
| Postgres connection count approaches pool limit under load | Confirm pooler is actually in front of the app (Neon/Railway pooled connection string) before adding read replicas. |
| p95 API latency for scan/recipe endpoints exceeds ~5s consistently, and profiling shows it's DB-bound (not AI-call-bound, which dominates today per existing project memory) | Add targeted indexes / consider a read replica for the specific hot read path — not a general-purpose replica rollout. |
| R2 storage bill or object count suggests unsaved-scan images aren't being cleaned up | Verify the 30-day retention job is actually running (cron/worker health check), not immediately reach for a different storage tier. |
| Postgres-backed job queue (`ai_jobs`) shows worker lag (jobs sitting `queued` past their `next_attempt_at` by more than a few seconds under normal load) | Add a second worker instance (the `FOR UPDATE SKIP LOCKED` pattern already supports concurrent workers safely) before reaching for a message broker. |
| Measured DAU sustained above ~20,000 with clear read-latency pressure on a single Postgres instance despite indexing/pooling being correct | Only then evaluate a read replica — this is explicitly the "only-if-needed" Phase 4 trigger, not a default. |

---

## 12. Migration Roadmap

### Phase 0 — Immediate, low-risk fixes (no schema change, no new services)

- **Files affected:** `apps/api/src/middleware/costControls.ts`, `apps/api/src/services/aiService.ts`, `apps/api/src/services/openRouterProvider.ts`.
- **What:** none of this is required *before* Phase 1 — but if the team wants safety before the DB lands, add a startup guard that refuses to boot a 2nd instance (e.g. a documented ops rule: "single instance only until Phase 1 ships") to prevent the silent quota-multiplication risk in §2.3 item 1 from being hit accidentally.
- **Risk:** none — this is a policy/ops note, not a code change.
- **Rollback:** N/A.
- **Trigger for Phase 1:** decision to onboard real users beyond a closed friends-and-family test, or decision to deploy a 2nd instance for any reason (including zero-downtime deploys, which inherently run 2 instances briefly).

### Phase 1 — Foundational schema/storage changes

- **Files/services affected:** new `apps/api/src/db/` (connection + query layer — a lightweight query builder like Kysely fits the existing minimal-dependency philosophy better than a full ORM), new migration files, `apps/api/src/store.ts` (replaced), `apps/api/src/server.ts` (routes updated to read/write Postgres instead of `store.ts`), new R2 client module, new `POST /v1/accounts/bootstrap` route, new `apps/mobile/src/state/` changes to send a bearer token (the install ID) with every request.
- **Data migration plan:** none needed — there is no production data to migrate (confirmed: `databaseEnabled: false`, `store.ts` is process-memory only). This is a **greenfield schema creation**, not a migration of existing rows — a rare and favorable position.
- **Risk:** the app currently ships with globally-shared, unscoped data (§2.3 item 2) — after this phase, that behavior changes (each user sees only their own data), which is the intended fix but should be communicated as a deliberate behavior change if any existing testers relied on the shared-library quirk.
- **Validation plan:** contract-test each rewritten route against the existing `docs/wiki/API_SPEC.md` response shapes so the mobile client requires minimal changes; add integration tests hitting a real (test-database) Postgres instance for the create/save/list/delete paths per table in §5.
- **Rollback plan:** keep `store.ts`-based routes behind a feature flag (`USE_POSTGRES=false` reads the old in-memory path) for one release cycle, so a bad Postgres rollout can be reverted without a code deploy — remove the flag once Phase 1 is confirmed stable.
- **Trigger for Phase 2:** Phase 1 deployed and stable for at least one release cycle with no data-loss/correctness incidents.

### Phase 2 — Job processing and operational controls

- **Files/services affected:** new `ai_jobs`/`idempotency_keys` tables and worker loop process, `apps/api/src/services/aiService.ts` (wrap AI calls in job records), `apps/api/src/middleware/costControls.ts` (counters move to Postgres per §8), new `POST /v1/webhooks/revenuecat` route + `entitlements` table wiring.
- **Risk:** introducing a worker process adds one more thing to operate — mitigate by running it as a second entrypoint in the same codebase/container image (not a separate repo), keeping "small team, simple ops" intact.
- **Validation plan:** simulate OpenRouter timeouts/errors in a staging environment and confirm the retry/backoff path behaves as designed; verify idempotent resubmission returns cached results instead of double-charging the daily cap.
- **Rollback plan:** worker loop can be paused (stop the process) without breaking synchronous request handling, since the synchronous path can still attempt inline execution and only fall back to the job table on failure — degrade gracefully rather than hard-depend on the worker.
- **Trigger for Phase 3:** real usage data exists (post-launch) to replace the assumptions in §3 with measured numbers, and/or any threshold in §11 is actually hit.

### Phase 3 — Scaling triggers (only when §11 thresholds are actually observed)

- Add a second worker instance if job lag is measured.
- Add Upstash Redis only if Postgres-based rate limiting is measured to add unacceptable latency at real traffic (unlikely below 100k MAU per the workload model).
- Add targeted indexes based on actual slow-query logs (Neon/Railway both expose these), not speculative ones beyond §6.

### Phase 4 — Only-if-needed architecture upgrades

- Read replica: only if §11's replica trigger is hit.
- Multi-region: only if Okyo expands to a user base with measured latency complaints from a specific region.
- Sharding/Kubernetes/event streaming: not anticipated at any realistic Okyo scale under this plan's assumptions; revisit only if a fundamentally different product direction (e.g. real-time multi-user features) emerges.

---

## 13. Risks and Open Questions

**Risks:**
1. The 25% recipe-save-rate and 10-scans/user/month assumptions in §3 are unverified — early real-usage data should replace them quickly after any beta launch, and the cost model in §9 should be re-run.
2. Moving from "everyone shares one library" to "per-account data" is a genuine behavior change for any existing testers — needs a short heads-up, not a silent switch.
3. OpenRouter vision-call pricing (the actual dominant cost driver) was not verified against current published pricing in this pass — flagged throughout as "requires verification." Get exact current pricing before finalizing budget commitments.
4. Railway hosting was assumed by the task brief but not found anywhere in this repo (no `railway.json`/`Procfile`/etc., no mention in `CLAUDE.md`/`AGENTS.md`) — confirm actual hosting target before Phase 1, since it affects the Postgres provider choice in §4.1.

**Open questions requiring user decisions:**
1. ~~Neon vs. Railway Postgres vs. Supabase~~ — **Decided 2026-08-18: Neon + R2.** Still confirm where `apps/api` itself is hosted (Railway assumed by brief, not found in-repo) — affects region co-location, not the DB/storage choice.
2. **Identity model for V1:** anonymous-install-only (no email, matches "fast onboarding" priority in `CLAUDE.md`) vs. requiring real sign-in from day one. This plan assumes anonymous-first per the stated product priorities, but it's the user's call.
3. **RevenueCat webhook implementation timing:** bundled into Phase 2 here, but could be deferred if server-enforced premium gating isn't an immediate priority — currently client-only entitlement checking has been the status quo and "works" for a pre-launch app.
4. **Exact free-tier scan limit enforcement point:** this plan proposes making the existing 3/week limit server-authoritative in Phase 2 — confirm that's still the desired product behavior before implementing.

---

## Confirmation

No application code, database, cloud service, environment variable, migration, or Git history was created, modified, deployed, provisioned, or reset while producing this document. The only filesystem change made is the creation of this single new file, `Okyo_Scalable_Data_Architecture_Plan.md`, at the repository root.
