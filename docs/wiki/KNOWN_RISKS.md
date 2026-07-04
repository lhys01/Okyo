# Known Risks

## Purpose
List real known risks from current code and docs so future agents know where to be careful.

## Source Files Inspected
- `README.md`
- `.gitignore`
- `apps/api/src/**`
- `apps/mobile/src/**`
- `apps/api/.env.example`
- `apps/mobile/.env.example`
- `docs/audits/*`
- `docs/generated/*`
- `package.json`, `apps/api/package.json`, `apps/mobile/package.json`

## Current Behavior
Known risks:
- Generated/runtime files have been present in prior checkpoints; avoid committing `.swarm/`, `ruvector.db`, `node_modules/`, generated native folders, logs, `apps/api/data/`, and generated skill mirrors.
- Mobile/API dependencies are not installed in this workspace; validation requires install first.
- Fable is expensive and creates cost exposure if enabled without caps and private header discipline.
- Silent model fallback risk exists if future edits bypass `getRecipeModelChain` or Fable guards.
- Image ownership/licensing must be tracked for bundled and remote food images.
- Generated and media asset footprint is large, especially `apps/mobile/assets` and `docs/generated`.
- In-memory stores and caps are not production-grade.
- Some older docs describe stale mock fallback behavior.

## Important Constraints
- Keep Fable fail-closed.
- Keep real uploaded scan failures honest.
- Rotate keys if there is any suspicion of exposure.
- Do not present estimates as exact.

## Known Risks or Edge Cases
This file is itself the risk register. Update it whenever behavior changes or a risk is retired.

## Related Docs
- [SECURITY.md](./SECURITY.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)
