# Okyo scalability action plan

This plan keeps work local or within already-paid Development resources. It does not approve a hosting upgrade, paid test service, AI-provider spend, or Production change. If a step would create a new charge, stop before doing it.

## What is already done at no extra cost

- The API has limits for busy requests, simultaneous AI calls, request time, and image size. When it is full, it can ask the app to retry instead of accepting unlimited work.
- A local-only test mode uses fake users, a packaged test image, and made-up AI results. It refuses Production and external websites.
- Database readiness checks now read the required permissions without writing a row every time Railway checks whether the API is healthy.
- Private API metrics now show whether the database pool is active and whether requests are waiting for a database connection.
- The API typecheck passes, and all 277 API tests pass.
- The local test reached 500 simultaneous delayed read requests, but the 1,000-worker stage hit the API's configured limit. A separate mock scan run reached the limit of 12 simultaneous AI-style calls and rejected the extra work safely.

## Next steps

### 1. Confirm what Development resources already exist

Check whether Okyo already has an isolated Development API and database, and find their current limits and recent resource readings. Do not change settings or send test traffic yet. If this requires a new service, larger plan, or paid usage, pause.

**Why:** We need to know what resources we can safely test before raising traffic. Local computer results do not predict Railway limits.

### 2. Prepare a safe scan waiting-line design

Plan how a scan can be accepted quickly, wait its turn, and later show “working,” “done,” or a clear failure in the app. Keep the waiting line capped so it cannot grow forever. Make sure retries do not create duplicate recipes and server restarts do not lose accepted work.

**Why:** Today a scan request stays open while AI works. At busy times, extra requests are rejected instead of waiting safely.

**Cost gate:** Writing and testing a design locally does not require a new vendor. Running a separate worker, adding image storage, or increasing database capacity may cost money. The cost and current database headroom are unknown, so do not provision or enable those services until confirmed to fit the existing plan at no extra charge.

### 3. Improve the local tests before higher stages

Make sure each test reports how many requests were actually happening at the same time, how long the API and health check took, memory use, failures, retries, and recovery after traffic stops. Treat “app open but idle” separately; an idle phone does not necessarily send requests.

**Why:** A worker count alone can look like thousands of users even when only a small number of requests overlap.

### 4. Run staged tests only where they are safe and free

Use synthetic users and fake AI responses. Start with small tests, then increase only while error rates, memory, health checks, and database connections stay within the agreed limits. Test browsing separately from image uploads and slow scans. Stop when a stage crosses a limit.

Do not send real scans to an AI provider, use real accounts or photos, or point the test at Production. If a useful test needs paid Development usage, stop and keep the result marked unknown.

### 5. Decide on capacity from measurements

Record separate results for idle use, browsing, sign-in checks, recipe reads, uploads, scans waiting for work, and AI-style jobs. Include the exact Development resources used. Keep the 10,000-user goal labeled **unproven** until a safe test actually measures the relevant workload.

## Do not change yet

- Do not raise the 500-request or 12-provider-call limits just to make a test pass. The current measurements do not show that the API host or AI provider has spare capacity.
- Do not add API replicas without checking how their database connections add up. The current API pool can use up to 10 connections per replica.
- Do not add object storage, a worker service, a larger database plan, or a load-testing service unless it is confirmed to have no additional cost and to be isolated from Production.
- Do not claim support for 10,000 users from the local tests so far.

## Current status in one sentence

Okyo has useful protections and its local read tests handled substantial short bursts, but busy scans and database-backed scale still need a safe waiting-line design and measured Development capacity before the app can make a large-user claim.

See the [detailed scalability report](scalability-report-2026-10-20.md) for exact test numbers, limits, and open questions.
