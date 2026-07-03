# Testing And Validation

## Purpose
Validation commands and manual smoke tests to run before calling work done.

## Source Files Inspected
`apps/api/package.json`, `apps/mobile/package.json`, `apps/api/src/server.ts`, `apps/api/src/services/*.test.ts`, `docs/wiki/AI_SCAN_TESTING_CHECKLIST.md`.

## Automated Validation
```bash
cd apps/api && npm run typecheck      # must pass
cd apps/mobile && npx tsc --noEmit    # must pass
```
`*.test.ts` files exist under `apps/api/src/services/` but **no test runner (jest/vitest) is configured** — they don't run in CI or via npm scripts. Typecheck is the only automated gate today.

## Manual Smoke Tests

### Normal scan
1. API + mobile running ([LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)), `AI_ENABLED=true` + key set.
2. Upload a clear food photo → expect result screen with dish name, confidence, costs, recipe.
3. Upload a non-food photo → expect friendly rejection (HTTP 422 `no_food_detected` / `unclear_food`), never mock pasta.

### Fable gates (curl, replace IMG with a small base64 data URL)
```bash
# 1. Disabled + header → expect 403 fable_not_enabled
curl -s -X POST localhost:8081/v1/scans -H 'Content-Type: application/json' \
  -H 'x-okyo-model: fable' -d '{"mode":"Restaurant Copy","image":{"dataUrl":"IMG"}}'

# 2. FABLE_ENABLED=true in apps/api/.env, restart, same request → scan runs;
#    server logs [fable_route] { active: true, model: FABLE_MODEL }

# 3. Repeat until cap (≤10) → expect 429 fable_daily_cap_exceeded

# 4. Fable failure must NOT fall back: set FABLE_MODEL to a bogus id, scan with header
#    → scan errors; grep logs: no recipe_model_fallback line, no Gemini call
```

### Prod-safety check
Production/release mobile build must send **no** `x-okyo-model` header — `OKYO_DEV_MODEL_OVERRIDE` is `undefined` outside `__DEV__` (`apps/mobile/src/api/config.ts`). Verify via API request logs.

### Cost controls
- 11th scan in 60 s from one IP → 429 `rate_limit_exceeded`.
- Oversized image (>10 MB) → 413.

## Important Constraints
- Fix implementation, not tests/validation, when smoke tests fail.
- A 422 rejection for junk images is **correct behavior** — don't "fix" it.

## Known Risks / Edge Cases
- Scan cache (24 h) can mask prompt changes — use a fresh image per validation round.
- In-memory caps reset on API restart, so cap tests must run within one server lifetime.

## Related Docs
[FABLE_ROUTING.md](./FABLE_ROUTING.md) · [COST_CONTROLS.md](./COST_CONTROLS.md) · legacy [AI_SCAN_TESTING_CHECKLIST.md](./AI_SCAN_TESTING_CHECKLIST.md), [BETA_TESTING_CHECKLIST.md](./BETA_TESTING_CHECKLIST.md)
