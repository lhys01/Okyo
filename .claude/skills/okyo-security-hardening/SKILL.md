---
name: okyo-security-hardening
description: Review or change authentication, authorization, Supabase/RLS, API endpoints, cost limits, secrets, uploads, privacy, release configuration, or production exposure.
---

# Okyo security hardening

Prioritize cost abuse, secret leakage, image privacy, user ownership, and untrusted model output.

## Current boundaries

- `mountV1Authentication` protects the complete `/v1` surface.
- Supabase JWT verification supplies the user ID; generated recipes are queried with that owner.
- Persistent global/per-user provider quotas live in Supabase, with an additional in-process scan throttle.
- Scan uploads accept bounded image metadata and supported image MIME types.
- Production mobile API configuration requires HTTPS.
- Fable has two gates, a hard cap, and fail-closed behavior.

## Endpoint checklist

1. Validate the complete body, parameters, IDs, and collection sizes.
2. Require authentication unless a route is deliberately public.
3. Enforce ownership in the repository query, not after fetching.
4. Apply provider quota/rate control before spend.
5. Return stable friendly errors without internal details.
6. Test missing, malformed, expired, wrong-user, oversized, and duplicate requests.

Never expose service-role keys to mobile, log secrets/full images, or trust client premium/XP state. Keep `/debug/ai-config` unavailable in production. Treat open CORS as a standing hardening item; add an allowlist only with known production origins so native clients are not accidentally blocked.

Before release, run auth/persistence tests, both typechecks, secret-pattern checks, Expo dependency checks, a release export, and physical-device permission tests.
