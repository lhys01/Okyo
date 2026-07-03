# Fable Routing (Opt-In Only)

## Purpose
Documents the Fable 5 opt-in path: Phase 1 (API) and Phase 2 (mobile dev override). Fable is expensive (~60-80× gpt-4o-mini) — every guard here exists to prevent cost surprises.

## Source Files Inspected
`apps/api/src/server.ts:116-143`, `apps/api/src/config/aiConfig.ts`, `apps/api/src/config/costControlConfig.ts`, `apps/api/src/middleware/costControls.ts:74-106`, `apps/api/src/services/openRouterProvider.ts:540-552`, `apps/mobile/src/api/config.ts`, `apps/mobile/src/api/client.ts:36-46`, `docs/audits/FABLE5_PROVIDER_DESIGN.md`.

## Current Behavior

### Phase 1 — API (server-side gates)
Fable rides the existing OpenRouter provider — it is a **model selection**, not a second provider integration.

Two gates, both required:
1. **Env:** `FABLE_ENABLED=true` (default false)
2. **Request header:** `x-okyo-model: fable` on `POST /v1/scans`

Outcomes:
- Header present, `FABLE_ENABLED` false → **403** `fable_not_enabled` (fail closed, no silent downgrade).
- Header present, enabled, daily cap reached → **429** `fable_daily_cap_exceeded`.
- Header present, enabled, under cap → request is Fable-active: vision + text models swap to `FABLE_MODEL` (default `anthropic/claude-fable-5`).
- No header → normal OpenRouter path, completely unaffected.

Config/caps:
- `FABLE_MODEL` — model id, default `anthropic/claude-fable-5`.
- `FABLE_DAILY_REQUEST_CAP` — separate in-memory counter, midnight-UTC reset, **hard-clamped to 10 in code** (`costControlConfig.ts`); env can lower it, never raise it.
- Every decision logs `[fable_route]` (requested/enabled/active/model/failClosed) and `[fable_cap]`.

**Fail-closed model chain:** `getRecipeModelChain()` returns `[fableModel]` only when Fable is active — no Gemini fallback, no paid fallback, no cross-model downgrade. If Fable fails, the scan fails visibly.

### Phase 2 — Mobile dev-only override
- `EXPO_PUBLIC_OKYO_DEV_AI_MODEL=fable` in `apps/mobile/.env` sends the header — but only in `__DEV__` builds, only for the exact value `fable`, and only on `/v1/scans`. Any other value logs a warning and is ignored.
- Production builds can never send the header (`OKYO_DEV_MODEL_OVERRIDE` is `undefined` outside `__DEV__`).
- **No public UI toggle exists, and none should be added.**

## Important Constraints
- Both gates required together — neither alone activates Fable.
- No silent fallback ever: a failed Fable request must surface as a failure.
- Hard cap of 10/day must stay code-enforced, not env-only.
- Default OpenRouter path must remain byte-for-byte unaffected when Fable is off.

## Validation Checklist
1. `FABLE_ENABLED` unset + header → expect 403 `fable_not_enabled`.
2. `FABLE_ENABLED=true` + header → scan runs, `[fable_route]` logs `active: true`, model is `FABLE_MODEL`.
3. 11th Fable request in a day → expect 429 `fable_daily_cap_exceeded`.
4. Force a Fable failure (bad model id) → scan errors; verify **no** `recipe_model_fallback` log and no Gemini call.
5. No header → `[fable_route]` logs `requested: false`, default models used.
6. Production mobile build → no `x-okyo-model` header on scan requests.

## Known Risks / Edge Cases
- Cap counter is in-memory — restarts reset it (bounded by the cap being tiny).
- Future edits to `getRecipeModelChain()` could accidentally re-enable fallback for Fable — guard the `isFableActive` early return.

## Related Docs
[AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md) · [COST_CONTROLS.md](./COST_CONTROLS.md) · [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md) · `docs/audits/FABLE5_PROVIDER_DESIGN.md`
