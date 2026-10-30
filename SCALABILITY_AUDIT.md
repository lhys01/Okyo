# Okyo scalability audit — 2026-09-15

## Scope and evidence

Audited repository: `/Users/rober/Desktop/Okyo-1` (branch `scaling`). This audit uses the tracked source under `apps/api/src` and `apps/mobile/src`, not ignored `apps/api/dist` output. The compiled output contains an older, removed Supabase-era implementation and is not executed by the current package scripts.

The current product is a mobile-first Expo app backed by an Express 4 TypeScript prototype. It is not a deployed production backend yet. No Railway, Docker, Kubernetes, database migration, ORM, queue, persistent object storage, server-side authentication, Sentry SDK, or production autoscaling configuration is tracked in this repository.

## Current architecture found

```text
Expo mobile app (Zustand + AsyncStorage, local recipe/grocery state)
  ├─ direct PostHog capture, best effort
  ├─ RevenueCat native SDK (client entitlement/purchases)
  └─ JSON/base64 photo POST (currently capped to 2.5 MB after this audit)
       ↓
Express API (`apps/api/src/server.ts`)
  ├─ Zod validation / CORS / mock route handlers
  ├─ process-memory rate limits, caps, result caches, analyses, recipes
  ├─ OpenRouter HTTP calls (vision then recipe, optional Epicure enrichment)
  └─ mock data and process-memory saved/library/challenge state
       ↓
OpenRouter → configured vision/text model
```

The active scan route is `POST /v1/scans`. It accepts a JSON data URL, validates it, performs vision and recipe inference synchronously, then returns one full result. `POST /v1/scans/analyze` plus `/recipe` is an alternative two-step route. Both depend on process-memory analysis state. The app currently uses the single-call route.

Images are resized and JPEG-compressed on the device. The API never writes images to permanent storage. A successful scan result, generated recipe, short-lived analysis context, idempotency result, and scan cache are all memory-resident. This is suitable for a local/mock prototype only.

Mobile supports optional Clerk configuration and uses RevenueCat, but the API does not verify Clerk tokens or establish user ownership. Saved recipes, grocery state, onboarding, and most product data remain local to the device. PostHog is nonblocking; backend capture is now bounded and batched. Sentry is mentioned in `.env.example` but is not installed or initialized.

## Scan latency map

| Stage | Current implementation | Measured/known limit | Main risk |
| --- | --- | --- | --- |
| Capture/compress | Expo ImageManipulator, JPEG | device-dependent | camera image can still be CPU-heavy on device |
| Upload | base64 inside JSON to API | 2.5 MB client/server guard; 3 MB body parser | API bandwidth/heap, no CDN or direct storage |
| Validation | Express JSON + Zod | synchronous parse | large JSON parse blocks the event loop briefly |
| Vision | OpenRouter fetch | `AI_TIMEOUT_MS`, default 45s | provider latency/rate limits |
| Recipe | OpenRouter fetch + bounded existing repair/failover | same timeout; can retry | expensive serial latency/cost |
| Persistence | process memory | TTL / restart loss | no cross-instance availability |
| Response | one JSON response | full recipe body | request remains open for inference |

No representative production latency sample or provider contract/rate-limit evidence is stored in this repository. Existing local fixture tests are not capacity evidence.

## Ranked original bottlenecks

| Rank | Priority | Finding | Why it fails at scale |
| --- | --- | --- | --- |
| 1 | P0 | No durable database, user ownership, or storage | restart loses state; no multi-instance consistency; production data model does not exist |
| 2 | P0 | Synchronous scan waits for AI | scan storms retain connections and can cascade into provider/API saturation |
| 3 | P0 | Rate limits, daily caps, analysis/cache/idempotency were process-local | replicas multiply caps and duplicate paid work |
| 4 | P0 | Base64 photos traversed API memory | burst upload bandwidth and JSON parsing consume API capacity before inference |
| 5 | P0 | No durable queue/dead-letter/backpressure | no controlled wait path when provider throughput is lower than arrivals |
| 6 | P1 | No AI concurrency bulkhead/circuit breaker | provider 429/5xx can trigger retries and occupy all request capacity |
| 7 | P1 | Unbounded in-memory Maps and rate-limit keys | slow memory growth and eventual OOM under churn |
| 8 | P1 | No production readiness, graceful shutdown, or HTTP metrics | unhealthy instances receive traffic; incidents cannot be diagnosed quickly |
| 9 | P1 | Local JSONL quality analytics enabled by default | replica-local I/O is non-durable and can create high write load |
| 10 | P1 | No database/query layer exists | indexes, connection pooling, migrations, and DB SLOs cannot be verified yet |

## Changes made in this audit

- Added bounded process-local request load shedding, AI bulkhead (default 12 calls/process), circuit breaker, and safe 503/Retry-After responses.
- Propagated client disconnect and a 55-second request deadline into OpenRouter/Epicure fetches. A cancelled mobile request no longer keeps starting provider work.
- Added idempotency-key support from the existing mobile scan session ID, request coalescing, conflict detection, and safe result reuse within one process.
- Coalesced concurrent identical scan work and made the scan cache preference-aware so dietary/goal variants cannot reuse one another’s recipe.
- Bounded short-lived in-memory maps and rate-limit key cardinality.
- Reduced scan transfer limits from 10–12 MB to 2.5 MB data-URL bytes, with invisible mobile resize/compression adjustments. The visible image preview remains unchanged.
- Added liveness/readiness, internal Prometheus exposition, request IDs, JSON lifecycle logs, security headers, graceful shutdown, and nonblocking batched backend PostHog delivery.
- Disabled container-local recipe-quality/Epicure JSONL writes by default in production.

These are important prototype hardening measures, not a claim that the current application is horizontally scalable. In particular, the new guards are process-local by design because no shared datastore currently exists.

## Database and deployment audit

There is no active database client, ORM, schema, migration directory, or tracked production connection string in source. Therefore there are no current queries to profile, no N+1 pattern to measure, no indexes to add honestly, and no database pool to tune. A future database design is specified in `docs/performance/SCALABLE_ARCHITECTURE.md`; its index list is a requirement for that future implementation, not an applied migration.

No Railway configuration is tracked. Railway configuration must set health check `/ready`, API/worker process separation, shared Redis, object storage credentials, database pooler configuration, metrics protection, and autoscaling limits before any production launch. Do not point a Railway production deployment at the current API and call it ready: `/ready` intentionally returns 503 under `NODE_ENV=production` because persistent state is absent.

## External dependency audit

| Dependency | Current role | Critical path | Current safety | Production requirement |
| --- | --- | --- | --- | --- |
| OpenRouter | vision/recipe/ask/correction, optional Epicure | yes for live scan | timeout, bounded retries, new local bulkhead/circuit breaker | contracted rate/concurrency limits, queue, provider budget alerts |
| PostHog | mobile/backend analytics | no | fire-and-forget; backend batch/timeout/drop bound | batch ingestion, sampling policy, dashboards |
| RevenueCat | mobile purchases/entitlements | no for scan | client SDK error handling | webhook/backend entitlement verification when server-gated features exist |
| Clerk | optional mobile sign-in | no current API enforcement | client-only | API JWT verification and user/tenant ownership |
| Object storage/CDN | absent | required for scalable scans | none | signed direct uploads, lifecycle policy, CDN |
| Sentry | absent | no | none | add SDK, DSN, trace/error sampling before production |

## Explicit non-changes

No screen, copy, layout, styling, artwork, loading UI, navigation, or animation was changed. The required durable queue and direct-to-object-storage protocol would change how scan progress is transported, but can preserve the existing analyzing/result screens. It is deliberately not faked with an unsafe in-memory queue.
