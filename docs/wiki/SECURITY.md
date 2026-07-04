# Security

## Purpose
Explain secret handling, env vars, API keys, what must never be committed, and safe defaults.

## Source Files Inspected
- `.gitignore`
- `apps/api/.gitignore`
- `apps/mobile/.gitignore`
- `apps/api/.env.example`
- `apps/mobile/.env.example`
- `apps/api/src/server.ts`
- `apps/api/src/config/aiConfig.ts`
- `apps/mobile/src/api/config.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/utils/scanImageStorage.ts`

## Current Behavior
The API loads env from repo root `.env` and `apps/api/.env`. Secrets such as `OPENROUTER_API_KEY` are backend-only and must not be placed in mobile code. Public mobile env vars use the Expo `EXPO_PUBLIC_` prefix and are safe only for non-secret config.

The API strips raw image `dataUrl` from scan responses and returns `hasDataUrl` instead. Dev logs print data URL lengths and short prefixes, not full payloads. Production skips verbose scan request logs.

User scan images are copied locally on device for continuity and attached to saved recipes only when the user saves a recipe.

## Important Constraints
- Never commit `.env`, `.env.*`, API keys, private data, logs containing secrets, or full base64 image payloads.
- Never put OpenRouter keys in mobile env or source.
- Do not expose provider technical errors to normal users.
- Do not broaden image retention without explicit user opt-in.

## Known Risks or Edge Cases
- Dev-only logs still need care when debugging image payloads.
- `EXPO_PUBLIC_OKYO_API_URL` is public by design; do not place secrets behind that prefix.
- Local `.env` files exist in workspaces and should not be inspected or committed.
- Generated/runtime files in previous checkpoints are a known hygiene risk.

## Related Docs
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [KNOWN_RISKS.md](./KNOWN_RISKS.md)
