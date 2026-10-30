# Okyo scalability and reliability report — 2026-10-20

## Decision

**10,000 concurrent users are not proven.** The highest simultaneous load demonstrated in this isolated local test was **500 in-flight synthetic recipe reads**, each delayed 200 ms. All 6,841 completed with HTTP 200 during a three-second arrival window (3.23 seconds including drain), with P95 275 ms and P99 384 ms. This is a single-process, in-memory fixture result, not a safe capacity figure for Railway, PostgreSQL, Clerk, the mobile app, or real AI.

The next read stage, configured for 1,000 workers and 5,000 requests/second, reached 866 client requests in flight and tripped the error-rate stop gate after 1.18 seconds: 2,316 HTTP 200, 2,580 retryable HTTP 503 `service_busy`, and 494 requests aborted by the harness. The first measured ceiling was the **API's configured 500 in-flight request limit per process**, not CPU, memory, or Postgres exhaustion. The stage was stopped; 2,500, 5,000, and 10,000 were not attempted.

The AI-style scan stage encountered a separate, lower ceiling: with 5-second mocked provider latency and 30 attempted jobs, 12 completed and 18 received retryable HTTP 503 `ai_temporarily_unavailable`. Peak mocked provider concurrency was 12, matching the configured bulkhead. There is no durable job queue, so rejected scans are not accepted for later processing. A synchronous scan request cannot meet the proposed under-three-second **upload acknowledgement** target when processing takes longer than three seconds.

## Environment and safety

- Identifier: isolated local API at `http://127.0.0.1:8087`, bound to `127.0.0.1`; one Node process on the developer machine. This was not a Railway Development deployment.
- `NODE_ENV=development`, explicit `OKYO_LOAD_TEST_MODE=true`, `OKYO_LOAD_TEST_TARGET=local`, `AI_ENABLED=false`, `FABLE_ENABLED=false`, `EPICURE_ENABLED=false`, `ANALYTICS_ENABLED=off`.
- Database, OpenRouter, Clerk, PostHog, Sentry, Apple private-key, and Railway connection variables were blanked before startup. The harness rejects every target other than `http://127.0.0.1:<port>` and requires a synthetic-mode server handshake before sending load.
- Synthetic `load_...` user IDs, deterministic recipe results, and one packaged cheeseburger fixture image were used. No real account, private photo, real AI request, Clerk authentication, PostHog event, Production access, data deletion, Production setting change, provider charge, hosting upgrade, or paid testing service was involved. No code was pushed.
- Request rates and durations below are configured arrival windows; actual completion can extend beyond the window. Worker count alone is not simultaneous in-flight concurrency, so the measured peak is shown where available.

## What was inspected

The pre-change [baseline report](scalability-baseline-2026-10-20.md) documents the mobile API client and 60-second timeout, Express/Railway service, routes and middleware, base64 upload path and size guards, single and two-phase scan paths, recipe generation, provider retries/timeouts/circuit breaker, process-local and durable idempotency, PostgreSQL pool and indexes, Clerk checks, account deletion, PostHog transport, file/image storage, logging, health checks, and available Railway configuration. Live Railway CPU/memory/replica/autoscaling settings and actual database connection headroom were unavailable; no claim is made about them.

The API has a default 500 in-flight HTTP limit, 12 concurrent provider-call limit, 55-second request deadline, and PostgreSQL pool maximum of 10 connections **per process**. There is no durable scan worker queue. Scale-out must first account for `replicas × 10` potential API connections plus other database clients and reserve. The checked-in Railway health check uses `/ready`, which queries the database. Existing API tests cover provider bulkhead/circuit behavior, idempotency, duplicate phase-two and correction requests, PostgreSQL runtime claims, malformed responses, and account deletion; the mobile repository already has delayed-result navigation coverage, but no mobile code was edited here.

## Measured local workloads

All rows used one API process, mocked AI, no database, and disabled analytics. `0` in an HTTP column means zero observed; `n/m` means successful responses/attempts. `—` means the metric was not captured, not zero.

| Workload | Configured workers; target rate; arrival duration (total elapsed) | Peak in flight | Actual req/s | Results | Latency P50 / P95 / P99 / max | Peak API RSS |
| --- | --- | ---: | ---: | --- | --- | ---: |
| Static browse, restaurant packs | 100; 100/s; 5 s (4.99 s) | — | 100.13 | 500/500 HTTP 200; 0 4xx/429/5xx/timeout | 1.39 / 2.52 / 4.00 / 6.27 ms | 111 MiB |
| Recipe read, serial paced | 100; 100/s; 4 s (3.99 s) | 1 | 100.16 | 400/400 HTTP 200; 0 4xx/429/5xx/timeout | 1.27 / 2.04 / 2.48 / — ms | 97 MiB |
| Mock session check | 100; 100/s; 4 s (3.99 s) | 1 | 100.17 | 400/400 HTTP 200; 0 4xx/429/5xx/timeout | 1.27 / 1.87 / 2.04 / 2.48 ms | 104 MiB |
| Fixture image upload and immediate mock scan | 100; 20/s; 3 s (3.00 s) | 1 | 19.98 | 60/60 HTTP 201; six duplicate retries, zero mismatched scan IDs; 0 4xx/429/5xx/timeout | 7.42 / 9.48 / 11.77 / 11.77 ms | 203 MiB |
| Mixed static browse, recipe read, mock session, fixture upload, description scan | 100; 30/s; 4 s (3.97 s) | 1 | 30.23 | 120/120 HTTP 2xx; 0 4xx/429/5xx/timeout | 2.18 / 9.46 / 10.61 / 19.09 ms | 119 MiB |
| Recipe read with 200 ms synthetic delay | 100; 500/s; 3 s (3.20 s) | 100 | 461.07 | 1,476/1,476 HTTP 200; 0 4xx/429/5xx/timeout | 200.95 / 202.00 / 203.41 / 207.38 ms | 154 MiB |
| Recipe read with 200 ms synthetic delay | 500; 2,500/s; 3 s (3.23 s) | 500 | 2,118.56 | 6,841/6,841 HTTP 200; 0 4xx/429/5xx/timeout | 200.87 / 275.06 / 383.67 / 409.11 ms | 234 MiB |
| Recipe read with 200 ms synthetic delay, stopped by gate | 1,000; 5,000/s; 3 s planned (1.18 s) | 866 | 4,569.64 | 2,316 HTTP 200; 2,580 HTTP 503; 494 harness aborts; 0 4xx/429 or client timeouts | 56.10 / 207.97 / 226.13 / 241.57 ms (includes fast rejections) | 202 MiB |
| Five-second mock AI scan | 100; 10/s; 3 s (6.11 s) | — | 4.91 | 12 HTTP 201; 18 HTTP 503; peak 12 provider calls; 0 4xx/429/timeout | 4.37 / 5,006.24 / 5,006.37 / 5,006.37 ms (fast rejections lower P50) | 59 MiB |

The upload run measured JSON parsing plus immediate mock processing, **not** 100 concurrent uploads: peak in flight was one. Its P95 is not an acknowledgement metric for real scans. The mixed run did not cover onboarding, grocery writes, customization, or analytics delivery. Mock session checks do not measure Clerk. The static browse and serial read runs do not measure real application screens or live database queries. In the failed 1,000-worker read stage, the harness counted 494 aborts toward a 57.03% observed failure rate; it stopped before the requested three seconds. No higher stage was safe to attempt.

Measured API process CPU *time* (user plus system) by row above was 0.555, 0.443, 0.451, 0.457, 0.298, 1.096, 1.381, 0.877, and 0.066 seconds respectively. These are CPU-time deltas, not CPU utilization percentages or Railway CPU metrics. Health P95 was 9.19 ms for the final upload run and 12.68 ms for the stopped read run; older short runs did not capture health samples. The two runs that captured post-load drain observed zero additional wait at their first check. Actual crash/restart count was not instrumented; the one local process remained reachable through the tests.

### Delay and failure behavior

Single mocked scans returned HTTP 201 at 15.008, 30.005, and 52.005 seconds. The 52-second result arrived before the mobile client's configured 60-second timeout. The 55-second scenario returned terminal HTTP 504 `request_timeout` at 55.009 seconds; there was no infinite request. These are one-request checks, not latency distributions. Health P95 while they waited was 2.91, 2.40, 2.62, and 1.74 ms respectively.

Single synthetic provider scenarios returned: upstream 429 mapped to retryable API 503; upstream 500 mapped to API 502; malformed recipe mapped to API 502 `recipe_validation_failed`; missing optional nutrition returned valid HTTP 201; retryable network failure mapped to API 503. Those immediate one-request checks establish response mapping only. The API's own per-user rate limit still produces HTTP 429 when a synthetic user exceeds its normal scan allowance; all synthetic users share loopback IP, so verified local mode scopes that limit by synthetic user instead of collapsing the entire test into one user.

## Pass, fail, and unknown

- **Passed in the local fixture scope:** no cross-user ID reuse when two synthetic users used the same idempotency key; same user/key replay returned the same scan ID; six upload retries showed no duplicate result; excess read and AI work returned typed retryable errors; the process stayed up; delayed scans terminated; health remained responsive in the long-delay cases and the failed 1,000-worker case (12.68 ms P95); the post-load in-flight count returned to idle. The 500-in-flight read stage met P95 <1 second, P99 <3 seconds, and <1% server errors.
- **Failed against target:** the 1,000-worker read stage failed the <1% server-error gate at the API in-flight limit. Five-second scan processing had 60% retryable rejection in the 30-job trial. The current synchronous scan path cannot meet a three-second acknowledgement when processing itself exceeds three seconds. The former Apple revocation test expectation mismatch has been corrected; the current API suite passes.
- **Unproven:** 10,000 idle mobile sessions, 10,000 screen-browsing users, 10,000 simultaneous real reads, 1,000 real sign-ins, 1,000 simultaneous uploads, 500 waiting scans, 100/250/500/1,000 *accepted* simultaneous AI jobs, sudden spike, sustained memory stability, restart/crash recovery, database writes/connection exhaustion, PostHog outage/drop counts, and real mobile background/interruption behavior. No Development Railway or PostgreSQL system was available to measure these safely. An idle harness sends no HTTP requests and cannot establish app-session capacity.
- **Unavailable metrics:** Railway restart count/replica count/CPU percentage, actual Postgres active/waiting connections and query latency/errors, durable queue depth/wait (no queue exists), real scan processing distribution, provider cost, and PostHog event/drop counts. The harness records process CPU *time* and peak RSS, HTTP outcomes and percentiles, mocked provider concurrency, retries/duplicate mismatches, health samples, and in-flight drain. Short, separate local runs cannot prove absence of memory leaks.

## Changes made and why

1. Added an opt-in local synthetic provider and strict environment gate. It makes the existing scan route exercise validation, idempotency, request deadlines, bulkhead, and error mapping with no vendor or user traffic. In load mode the listener binds only to loopback.
2. Added local status and mock session endpoints and a local-only read delay. They expose process memory/CPU time and bulkhead state and make overlapping read requests measurable. They are unavailable outside the isolated mode.
3. Added a dependency-free Node load runner with host refusal, synthetic identities, packaged image fixture, fixed-rate arrivals, configurable concurrency/delay/scenario, repeated idempotency keys, JSON results, and stop gates for health, error rate, and memory. Synthetic users get separate local-mode idempotency and scan-rate scopes; ordinary app behavior retains its existing scopes.
4. Added safety and mock-provider unit tests. That initial load-test work did not rewrite the production queue, auth, deletion, onboarding, recipe, PostHog, Railway, or mobile behavior.

## Follow-up no-cost fixes

- Database readiness now performs one read-only capability/permission query. Previously each `/ready` check wrote or updated a synthetic health row and then ran a second query. Removing that write reduces avoidable database traffic during health polling.
- The protected Prometheus endpoint now reports whether the database pool is configured/initialized and how many connections are total, idle, and waiting. This adds visibility without opening a database connection during metric rendering.
- Updated the Apple account deletion test to match the existing intended behavior: if Apple token revocation fails, account deletion still completes and returns `manual_action_required` for user guidance.
- API TypeScript passed; all **277 API tests** passed after these changes; the load-test host safety tests passed; `git diff --check` passed.

These changes do not increase configured concurrency or the measured capacity. The durable scan queue remains unimplemented: storing and resuming uploaded-photo jobs safely requires a durable image reference/storage decision and a worker runtime. The cost and existing database/storage headroom are unknown, so no new infrastructure was created, no service was scaled, and no Production or Railway settings were changed.

## Recommended next step before launch

The smallest architectural fix for long scans is a **durable, bounded scan-job queue with a separate worker** and a fast submission response containing a status ID. Persist the accepted job and idempotency claim together, cap queue depth and worker concurrency, expose queued/processing/success/terminal-failure states, and let the mobile app poll or resume by ID. This would release API request capacity while AI works and make sub-three-second acknowledgement possible. Its expected numerical capacity is **unknown until measured**; do not choose replica counts, database pool settings, or provider concurrency from this local test.

Before implementing or scaling that design, provision an isolated Development database and service with known Postgres connection limit and Railway CPU/memory/replica telemetry, then run the same gated stages plus long-duration, spike, slow/rejected-DB, failed-provider, and analytics-disabled/unavailable trials. Ensure `replicas × pool maximum` fits the real database limit with reserve. Verify mobile queued and terminal states, delayed navigation, cancellation, and stale-user protection against the real Development API. A safe read cache or additional replicas may help browse traffic later; neither removes the provider or durable-work bottleneck. Hosting cost for those options is unknown from the checkout and no upgrade is recommended without a quote and measured need. Any realistic 10,000-user claim requires an infrastructure test whose cost and Development isolation are agreed in advance.

## Validation and files

- API TypeScript: passed.
- API unit suite after follow-up fixes: **277 passed, 0 failed**. The earlier Apple revocation expectation mismatch was corrected to assert the current documented behavior.
- New local-mode tests: four mock tests and two host/handshake tests passed. Harness validation also included same-key cross-user/same-user replay and six upload retries without mismatched IDs.
- Mobile TypeScript and tests: not run because no mobile files were changed in this task. Existing delayed-success navigation tests were inspected, not rerun.
- `git diff --check`: passed.
- The baseline and this report are under `docs/performance/`. The earlier local test harness changes are in `apps/api/src/server.ts`, `apps/api/src/middleware/operationalSafety.ts`, `apps/api/src/middleware/costControls.ts`, `apps/api/src/services/loadTestMock.ts`, `apps/api/src/services/loadTestMock.test.ts`, and `apps/api/scripts/load-test*.mjs`. Follow-up code changes from the no-cost fixes are in `apps/api/src/persistence/database.ts`, `apps/api/src/observability/metrics.ts`, `apps/api/src/persistence/runtime.test.ts`, `apps/api/src/observability/metrics.test.ts`, and `apps/api/src/services/appleRevocation.test.ts`. The repository had extensive unrelated pre-existing changes, which were preserved.

Manual follow-up: run the local harness with an isolated environment exactly as documented above, inspect scan statuses and health, then validate a queued design on Development infrastructure before raising load or making a launch capacity claim.

To reproduce the small local fixture run, start the API from `apps/api` in one terminal with all external connections explicitly cleared:

```sh
env -i PATH="$PATH" NODE_ENV=development PORT=8087 \
  OKYO_LOAD_TEST_MODE=true OKYO_LOAD_TEST_TARGET=local \
  AI_ENABLED=false FABLE_ENABLED=false EPICURE_ENABLED=false ANALYTICS_ENABLED=off \
  DATABASE_URL= OPENROUTER_API_KEY= CLERK_SECRET_KEY= \
  POSTHOG_API_KEY= POSTHOG_PROJECT_API_KEY= SENTRY_DSN= \
  APPLE_SIGN_IN_PRIVATE_KEY= RAILWAY_ENVIRONMENT= \
  RAILWAY_PROJECT_ID= RAILWAY_SERVICE_ID= \
  node --import tsx src/server.ts
```

From `apps/api` in a second terminal, run a small stage:

```sh
OKYO_LOAD_TEST_MODE=true OKYO_LOAD_TEST_TARGET=local \
  node scripts/load-test.mjs --url http://127.0.0.1:8087 \
  --workload read --concurrency 100 --rps 100 --duration 5
```

The harness refuses a non-loopback URL or a server without the synthetic handshake. Stop the API after the run.
