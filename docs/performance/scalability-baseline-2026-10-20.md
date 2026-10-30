# Okyo scalability baseline — 2026-10-20

This is the pre-change architecture report. It is a code inspection, **not a capacity measurement**. No Production system, user account, photo, AI provider, Clerk, PostHog, or Railway deployment was exercised to prepare it. The 10,000-concurrent-user target is unproven.

## Current request path

The Expo client sends JSON to the Express API. A photo is placed in a base64 data URL and `POST /v1/scans` waits synchronously for vision and recipe work before returning a result. There is also a two-step `/v1/scans/analyze` then `/v1/scans/analyze/:analysisId/recipe` path. The mobile client has a 60-second timeout, one active scan session, cancellation, a stable idempotency key for retry, and a guard against committing an old session's result.

The API rejects bodies above 3 MB and scan data URLs above 2,750,000 characters. Its request in-flight limit defaults to 500 per process, its provider-call limit to 12 per process, and its request deadline to 55 seconds. The provider client uses abort timeouts, limited retries and a process-local circuit breaker. Accepted provider work has no durable queue or worker service. Under excess load it rejects work; it does not promise eventual processing. The API exposes `/health`, `/live`, `/ready`, and `/internal/metrics`; Railway's checked-in configuration points health checks at `/ready` with restart-on-failure. Railway CPU, memory, live replica count, autoscaling, and actual Postgres connection limit are **not available in this checkout**.

The PostgreSQL pool has a fixed maximum of 10 connections **per API process**, 2-second connection acquisition timeout, and query/statement timeouts. Persistent runtime state and quota use primary-key lookups; expiry and idea-submission indexes exist. The `/ready` path performs database queries, including a write, on each call. Queries use pool-level `query`, so no explicit client checkout is held across the slow provider call in the inspected path. The number of API replicas must be constrained against the actual Postgres connection limit before scale-out (`replicas × 10` plus other clients and reserve). Query latency and connection headroom are unmeasured.

Clerk verification happens on authenticated endpoints and on AI endpoints when a bearer token is present; public scans can be guest requests. Development tests must use a local mock auth layer and never generate Clerk traffic. API analytics are bounded, best-effort PostHog batches. The mobile analytics path fires individual best-effort requests; neither path may be included in a real load test. Account deletion is a separate authenticated route and must not be load tested with real identities.

## Bottlenecks and correctness risks to measure

1. **Synchronous scan lifetime:** slow AI calls hold API requests and mobile connections open. At the 500-request in-flight default, 1,000 simultaneous uploads or waiting scans cannot all be accepted by one process. This is a configured ceiling, not measured throughput.
2. **Provider-call ceiling:** at most 12 provider calls per process run at once. A scan can make more than one call. 100–1,000 simultaneous AI-style jobs will require rejection or a durable queue; current code does not guarantee queued completion.
3. **Idempotency across replicas:** non-production `POST /v1/scans` coalesces retries in process memory. Production also has a durable request claim inside the request deadline, but the outer cache is process-local and failed durable claims stay pending. Cross-replica duplicate and crash recovery behavior require isolated tests before any scale claim.
4. **Base64 upload amplification:** body parsing and image decoding consume heap; the 3 MB body cap bounds one request but not hundreds of simultaneous uploads. MIME and content validation are present, yet aggregate memory is unmeasured.
5. **Postgres and readiness:** pool size is known; database limits, active/waiting counts, query latency, and readiness load are unknown. A readiness probe that writes under load may compete with ordinary work.
6. **Replica-local limits/state:** rate limits, circuit breaker, and several caches are in memory, so their effective ceiling and state differ by replica. Multi-replica behavior requires a shared design.
7. **Observability gaps:** HTTP/AI duration and in-flight metrics exist. The synchronous design has no queue depth/wait metrics; database pool counts, dropped analytics events, retry/duplicate counts, and restart/replica metrics need additional local or infrastructure instrumentation for a complete load report.

## Capacity by workload

| Workload | Current defensible figure | What must be measured |
| --- | --- | --- |
| Idle open sessions | Unknown; an idle app is not an API request | Mobile polling and connection behavior |
| Browsing, recipe reads, normal read requests | Unknown | RPS, P95/P99, cache behavior, DB usage |
| Authentication/session checks | Unknown | Local mock session throughput, then provider limits separately |
| Image uploads | At most 500 in-flight API requests per process by configuration | Aggregate heap, parse time, 413/503 rate |
| Scan processing | At most 500 in-flight API requests per process by configuration | End-to-end latency and terminal outcomes |
| AI-style processing | At most 12 simultaneous provider calls per process by configuration | Mock-provider throughput, rejection, breaker recovery |
| Database writes | At most 10 pooled connections per process by configuration | Postgres active/waiting, query latency, errors |
| PostHog events | API queue cap 500, batch size 50; mobile sends individually | Local disabled/unavailable behavior and dropped count |

These are code-level limits, **not proven safe concurrency**. There is no measured highest safe concurrency or reasonable numeric capacity estimate yet. The initial target remains 10,000 concurrent users split by workload, never equated to 10,000 AI scans.

## Pass criteria and stage gates

No cross-user access, data corruption, duplicate recipe on retry, false scan success/failure, unbounded memory/queue growth, infinite hang, process crash, DB exhaustion, or retry storm. Accepted work reaches success or a terminal failure; excess work receives a retryable response. Browsing and health endpoints remain responsive while scans run, and recovery follows load. Normal browsing targets: P95 <1 s, P99 <3 s, server errors <1%. Scan acknowledgement target: P95 <3 s; the current synchronous endpoint may require a separate submission architecture to meet it.

Run 100, 500, 1,000, 2,500, 5,000, then 10,000 only in a clearly isolated Development/local environment, stopping escalation on unsafe errors, memory, database connections, or provider queue pressure. Also run separate idle, browsing, read, auth, upload, waiting, AI (100/250/500/1,000), mixed, spike, and sustained workloads. A local mock run cannot establish Railway Development or Production capacity. Paid infrastructure testing requires a separate cost estimate and explicit authorization before any upgrade or paid traffic.

## Local validation results — 2026-10-20

The existing local-only harness was validated against `http://127.0.0.1:8081` with `NODE_ENV=development`, `OKYO_LOAD_TEST_MODE=true`, `OKYO_LOAD_TEST_TARGET=local`, AI disabled, analytics disabled, and database/provider/auth/Railway credentials explicitly blanked. The server handshake reported `provider=synthetic` and `externalServices=false`. No remote host was contacted.

Only the `browse` workload was measured. It repeatedly requested `GET /v1/restaurant-packs` for five seconds at each stage. It did not simulate real mobile sessions, authenticated reads, uploads, a queue, or the target traffic mix.

| Synthetic workers | Request rate | Duration | Requests | 2xx / 4xx / 429 / 5xx | Timeouts | P50 / P95 / P99 / max (ms) | Peak API RSS |
| ---: | ---: | ---: | ---: | --- | ---: | --- | ---: |
| 100 | 100 req/s | 5 s | 500 | 500 / 0 / 0 / 0 | 0 | 1.37 / 2.46 / 5.17 / 7.93 | 100,728,832 bytes |
| 500 | 500 req/s | 5 s | 2,500 | 2,500 / 0 / 0 / 0 | 0 | 0.47 / 1.14 / 2.38 / 19.38 | 112,525,312 bytes |
| 1,000 | 1,000 req/s | 5 s | 5,000 | 5,000 / 0 / 0 / 0 | 0 | 0.34 / 2.44 / 8.24 / 86.76 | 117,735,424 bytes |

The results show no failures in this short local static-read burst. The highest demonstrated point is **1,000 harness workers at 1,000 requests/second for five seconds on this one route**, not 1,000 users and not a production capacity claim. The harness stopped before 2,500 because it does not collect enough of the requested safety metrics to justify escalation: it has no API CPU percentage, database connection/query measurements, replica/restart data, durable queue measurements, or independent system-level memory and recovery monitoring. It samples process RSS and CPU-time counters, but those are not substitutes for the missing signals. The `idle` workload creates no HTTP activity and therefore does not measure open app sessions.

No dedicated worker queue exists, so queue depth, wait time, and accepted-job terminal-state behavior were not measured. The API pool is configured for at most 10 connections per process, but no database was configured in this test, so database safety and write capacity remain unmeasured. Provider concurrency, uploads, auth throughput, PostHog delivery, delayed processing, spike behavior, and sustained load were not exercised. No 10,000-user capacity estimate can be responsibly inferred from these results; the highest safe concurrency remains **unknown** outside the narrow local read test.

## Validation status

- API TypeScript check: passed.
- Load-test target safety tests: 2 passed, including refusal of Production/external hosts and the synthetic-server handshake.
- API test suite at the time of this baseline run: 275 passed, 1 failed. The former `appleRevocation.test.ts` expectation mismatch has since been corrected; the current API suite result is 277 passed, 0 failed (see the detailed [scalability and reliability report](scalability-report-2026-10-20.md)).
- Small local Development load test: passed at 100, 500, and 1,000 browse workers as reported above.
- Mobile TypeScript/tests: not run; no mobile files were changed for this validation.
- `git diff --check`: passed at report update time.

No application code was changed during the local load validation described above. A later no-cost follow-up removed the database write from readiness checks and added database-pool metrics; details are in the linked report. No real AI request, Clerk request, PostHog event, Production access, real account, private photo, hosting upgrade, or paid load-testing service was used. Before launch, the next useful test needs an isolated Development database and infrastructure metrics, plus a shared/durable scan queue and staged mock-provider tests; do not treat this local run as evidence that Railway can support the requested target.
