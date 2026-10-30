# Production AI and Clerk configuration gate

Production AI remains disabled by default and fails closed. Billable AI is
available only when `AI_ENABLED=true`, `PRODUCTION_AI_ENABLED=true`, shared
PostgreSQL state and quota reservations are healthy, quota configuration is
valid, Clerk uses a live secret and exact authorized parties, and the provider
key has the expected local configuration shape. Readiness intentionally does
not contact OpenRouter or Clerk. Keep both AI flags false until the external
setup and manual spending checks below are complete.

The server allowlist permits `openai/gpt-4o-mini`,
`google/gemini-3.1-flash-lite`, `google/gemini-3.5-flash`, and
`anthropic/claude-fable-5`. Unknown environment-selected models safely fall
back to the approved default; dispatch rejects unapproved models. The client
may request only the named `fable` opt-in, never a model ID. Recipe fallback
is bounded to the approved primary and two fixed alternatives. Every provider
attempt, including retries, Epicure enrichment and fallbacks, reserves quota
immediately before dispatch. Reservations remain consumed on failures or
ambiguous network outcomes.

## Durable shared quotas and state

The API uses PostgreSQL. Apply `apps/api/migrations/001_runtime.sql` and
`apps/api/migrations/002_idea_submissions.sql` using a
database owner/admin role. Give the API runtime role only the access required
by this migration; replace `<runtime-role>` with the actual database role in
the SQL console:

```sql
GRANT USAGE ON SCHEMA okyo_private TO "<runtime-role>";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE okyo_private.okyo_quota TO "<runtime-role>";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE okyo_private.okyo_runtime TO "<runtime-role>";
GRANT EXECUTE ON FUNCTION okyo_private.okyo_reserve_quota(text[], integer[]) TO "<runtime-role>";
GRANT EXECUTE ON FUNCTION okyo_private.okyo_cleanup_runtime() TO "<runtime-role>";
GRANT INSERT ON TABLE okyo_private.idea_submissions TO "<runtime-role>";
```

The Settings Idea board writes to `okyo_private.idea_submissions`. The API role
can insert submissions but cannot read them. As a database owner/admin, review
the newest notes with:

```sql
SELECT created_at, category, message, status
FROM okyo_private.idea_submissions
ORDER BY created_at DESC;
```

Set these API service variables using the deployment secret manager. These are
shapes only; do not copy placeholders as credentials:

```dotenv
DATABASE_URL=postgresql://<runtime-role>:<password>@<postgres-host>:5432/<database>?sslmode=verify-full
# Use only for private Railway networking when DATABASE_URL has no public TLS:
# DATABASE_TRANSPORT=private-network
QUOTA_SCOPE_HMAC_KEY=<random-server-only-value-at-least-32-characters>
AI_DAILY_REQUEST_CAP=500
AI_SUBJECT_DAILY_CALL_CAP=30
FABLE_DAILY_REQUEST_CAP=10
# Set this only if Okyo serves a browser client. Native Expo requests omit Origin.
# CORS_ALLOWED_ORIGINS=https://<exact-production-browser-origin>
AI_ENABLED=false
PRODUCTION_AI_ENABLED=false
```

Use verified TLS for public database connections. `DATABASE_TRANSPORT` must be
exactly `private-network` only when the database is reached through a trusted
private network. The HMAC value must be generated and stored as a backend-only
secret; changing it changes hashed quota/state scopes. PostgreSQL reservations
are atomic across connections and API replicas. Expired state and prior-day
quota rows are cleaned periodically. `/ready` checks database connectivity,
migration functions and runtime-role grants, quota configuration, Clerk
configuration, and local provider-key configuration. It does not validate
external credentials or call an AI provider. Missing or unavailable PostgreSQL
prevents AI readiness and provider calls.

Before changing either AI flag, verify the migration and grants from the
runtime role, then run simultaneous reservations and process-restart tests
against the actual database with two API instances. Review that `/ready`
returns 503 before enablement and only returns ready after all prerequisites
are satisfied. Local PGlite tests do not replace this deployment verification.

## Clerk production configuration

`CLERK_SECRET_KEY` is server-only and must be the live (`sk_live_`) key.
`CLERK_AUTHORIZED_PARTIES` is required and must be a comma-separated list of
exact Clerk `azp` values observed from legitimate sessions for each shipped
client. Web entries must be registered HTTPS origins. Native entries must be
the exact registered party values. Wildcards, guessed values, plain HTTP, and
empty entries are rejected. Clerk verification enforces the authorized party
before deriving a user ID. Public scans remain guest-accessible; a valid
optional Clerk session only lets the API apply user-scoped quotas.

Placeholder shape only:

```dotenv
CLERK_SECRET_KEY=<server-only-live-clerk-secret>
CLERK_AUTHORIZED_PARTIES=<exact-production-https-origin>,<exact-native-azp-value>
```

Production authentication returns unavailable when the secret is missing or
not live-prefixed, or when the authorized-party list is absent or malformed.
The API also probes the Clerk instance before production AI readiness. A
matching prefix is not proof that the secret is valid.

## Synthetic fixtures

`apps/api/src/mockData.ts` contains fixed demonstration records (scan IDs
`001`–`003` and named sample recipes). These are source fixtures, not data from
real users. Development can keep them. Production blocks fixture-backed scan
and recipe reads, saves, and challenge actions. A production scan failure is
not replaced with mock output.

## Manual checks still required

- In Railway, provision/identify the production PostgreSQL database, apply the
  migration, grant the runtime role as above, and set the database transport,
  quota HMAC key, and caps. Confirm `/ready` reports the database and quota
  store healthy from every replica.
- In the existing `stunning-empathy` service's production environment, set the
  root directory to `/apps/api`. This causes Railway to read
  `/apps/api/railway.toml`, which builds with `npm ci && npm run build`, starts
  with `npm run start`, and uses `/ready` as the deployment health check. Do
  not create another service. Set `TRUST_PROXY=true` only for this Railway
  deployment so client-IP rate limits use Railway's forwarded address. If a
  browser client is shipped, set `CORS_ALLOWED_ORIGINS` to its exact HTTPS
  origin(s); leave it unset for native-only use.
- In Clerk, capture the exact `azp` from a legitimate production session for
  each shipped client. Configure the live secret and exact comma-separated
  authorized parties in Railway. Verify valid, wrong-party, expired, and
  malformed tokens. Confirm guest scans still work when AI is enabled.
- Before production sign-in/account deletion, configure `REVENUECAT_PROJECT_ID`
  and `REVENUECAT_V2_SECRET_API_KEY` in Railway with the required customer
  deletion permission. The API now fails closed on account deletion in
  production until both are present; verify deletion, retries, and a missing
  RevenueCat customer in the real sandbox.
- In OpenRouter, set and verify hard spend ceilings, reset period, alert
  thresholds, key restrictions, and emergency disable. The local readiness
  check does not probe the provider or validate the key with OpenRouter. No
  console setting was reviewed.
- Before enablement, verify `AI_ENABLED=false` and
  `PRODUCTION_AI_ENABLED=false` in production. After external checks, only the
  founder may decide to change them. Do not use this document as approval to
  enable production AI.
- In PostHog, check both mobile and API project keys/hosts, environment
  separation, retention, consent/opt-out decisions, regional processing, and
  that autocapture/session replay remain off. See
  `docs/security/ANALYTICS_PRIVACY_REVIEW_NOTES.md`; this mismatch still blocks
  release analytics until founder/counsel review and approved disclosure.
- In Sentry, check the project, event retention/access, DSN environment gate,
  and controlled source-map upload configuration. Do not place
  `SENTRY_AUTH_TOKEN` in app build variables.
