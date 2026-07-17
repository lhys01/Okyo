---
name: Okyo Security Hardening
description: Use when touching auth, API endpoints, rate limits, secrets, RLS, data storage/privacy, or preparing any beta/TestFlight/production deploy.
---

# Okyo Security Hardening

## When to use this

Auth changes, new endpoints, deploy prep, secret handling, Supabase/RLS work, or any "is this safe to expose" question.

## Threat model (ranked)

1. **Cost abuse** — the API fronts paid AI calls. An open endpoint is a free gpt-4o-mini (or worse, Fable) proxy for the internet. This is the #1 threat.
2. **Secret leakage** — OpenRouter/Supabase keys in commits, logs, or client bundles.
3. **User privacy** — food images are personal data. Rule: never store a user's food image server-side unless they save a recipe or explicitly opt in. Never log full base64 payloads.
4. **Prompt injection via images/dish names** — model output is untrusted input; Zod-validate everything before it touches state.

## Current state (July 12, 2026 — verify against HEAD, don't trust)

- **Supabase auth plumbing landed — coverage incomplete**: anonymous mobile auth (`apps/mobile/src/auth/` — sessionService, supabaseClient), Express JWT verification (`apps/api/src/middleware/supabaseAuth.ts`, `apps/api/src/auth/verifier.ts` using `jose`).
- Tests exist and are wired: `npm run test:auth` in BOTH `apps/api` and `apps/mobile` (node:test).
- **Supabase migrations** (`supabase/migrations/`): cohort schema with RLS enabled on all 5 tables, owner-only row policies, write-only backend tables, per-user + global daily scan caps via advisory locks on UTC date, auto-RLS-enable migration. Reviewed and approved for the development project (July 12 audit). Schema deliberately stores no images, prompts, base64, JWTs, or raw provider responses.
- Cost controls (`apps/api/src/middleware/costControls.ts` + `costControlConfig.ts`): per-IP scan rate limit, global daily AI cap, 10MB image limit, Fable 10/day hard clamp.

## Known gaps before public beta (re-verify each)

- **CORS is wide open**: `app.use(cors())` with no origin allowlist in `server.ts`.
- **Endpoint auth coverage**: JWT middleware exists — confirm which of the ~15 `/v1/*` routes actually require it. History: the coaching endpoint shipped ungated (Phase 1 critical finding); recipes/library/xp/rankings routes were unauthenticated as of the July 12 launch audit.
- **In-memory caps/state**: rate limits, daily caps, saved library, coaching store all reset on API restart. Migrate enforcement to the Supabase counters before public traffic.
- **iOS permission strings**: `app.json` has no `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` — App Store rejection + runtime crash risk on camera/photo access.
- **Committed runtime files**: `ruvector.db`, `.swarm/*`, skill mirrors are tracked (KNOWN_RISKS #1). Clean up as its own commit; never bundle with feature work.
- **No CI** — typecheck both apps manually before every commit.

## Hard rules

- Never hardcode secrets; never commit `.env`. Keys live in env vars; validate presence at startup.
- Never log API keys or full image payloads.
- Client-side flags are not security: `isPremium`, scan counts, and caps must be enforced server-side (client values are display-only).
- New endpoint checklist: Zod-validate input → require auth (or document why not) → rate limit if it can trigger spend → error messages leak nothing internal.
- If a secret may have leaked: rotate immediately, then audit history.

## Deploy gate (run before any TestFlight/beta build)

1. `cd apps/api && npm run typecheck && npm run test:auth`
2. `cd apps/mobile && npx tsc --noEmit && npm run test:auth`
3. Confirm `EXPO_PUBLIC_OKYO_API_URL` is a valid HTTPS URL — production build **throws by design** without it (`apps/mobile/src/api/config.ts`, fail-closed).
4. Confirm `FABLE_ENABLED` is unset/false on any public endpoint.
5. Grep the bundle/env for keys; confirm `.env` untracked.
6. Check permission strings in `app.json`.

## Prior art (read before re-auditing)

- `docs/wiki/SECURITY.md`, `docs/wiki/COST_CONTROLS.md`, `docs/wiki/KNOWN_RISKS.md`
- `docs/audits/TOP_10_RISKS.md`, `docs/audits/FINAL_PRODUCTION_DECISION.md` (the hardcoded-IP saga — now fixed fail-closed)
- Security Hardening Phase 1 audit (July 2026): coaching endpoint gap, tracked runtime DBs, unbounded stores.
