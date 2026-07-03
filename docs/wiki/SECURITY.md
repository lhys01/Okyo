# Security

## Purpose
Secret handling, safe defaults, and what must never be committed.

## Source Files Inspected
`apps/api/.env.example`, `apps/mobile/.env.example`, `apps/api/src/config/aiConfig.ts`, `apps/api/src/server.ts`, `apps/api/src/middleware/costControls.ts`, `.gitignore`, `AGENTS.md`.

## Current Behavior
- **Secrets:** the only secret is `OPENROUTER_API_KEY`, backend-only, read from env (`apps/api/.env` or repo-root `.env`). It is never sent to or stored on the mobile app; `getPublicAiConfig()` exposes only `hasOpenRouterKey: true/false`.
- **Safe defaults:** `AI_ENABLED=false`, `FABLE_ENABLED=false`, `EPICURE_ENABLED=false`, `IMAGE_GEN_ENABLED=false`. A fresh clone makes zero paid calls.
- **Input validation:** all request bodies zod-validated at the boundary; image data URLs must match a strict base64 regex; body size capped.
- **Log hygiene:** verbose scan logs are dev-only (`NODE_ENV !== 'production'`); logs include data-URL lengths/prefixes, never full payloads; IPs masked in cost logs.
- **Debug surface:** `GET /debug/ai-config` returns 404 in production and never includes the key.
- **Mobile env:** only `EXPO_PUBLIC_*` values (public by definition) — API URL and the dev-only Fable override. No keys.

## Must Never Be Committed
- `.env` files (any app level) or API keys in any file, including docs.
- User food images or personal data.
- Runtime/generated state: `.swarm/`, `ruvector.db`, `node_modules`, `__pycache__`, skill mirrors, `apps/*/dist`, logs.

## Important Constraints
- Validate required secrets at startup where a feature needs them (Epicure logs a warning and stays off rather than crashing).
- Error messages to users stay friendly and generic; detailed context goes to server logs.
- Rotate any key that ever lands in a commit — history counts as exposure.

## Known Risks / Edge Cases
- Some runtime/generated files are already tracked in git (see [KNOWN_RISKS.md](./KNOWN_RISKS.md)) — they predate the exclusion rules.
- No auth on the API; anyone on the LAN can spend the daily cap. Acceptable for local dev only.
- `x-forwarded-for` is untrusted by design in dev; revisit for deployment.

## Related Docs
[COST_CONTROLS.md](./COST_CONTROLS.md) · [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) · [KNOWN_RISKS.md](./KNOWN_RISKS.md)
