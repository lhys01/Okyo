# Okyo Wiki

## Purpose
This wiki is the routing layer for current Okyo behavior. It keeps `CLAUDE.md` short while giving contributors a code-accurate map of the mobile app, API, AI routing, scan flow, onboarding, design system, state, data, security, and validation.

## Source Files Inspected
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`
- `apps/api/src/**`
- `apps/mobile/src/**`
- `apps/api/.env.example`
- `apps/mobile/.env.example`
- `package.json`, `apps/api/package.json`, `apps/mobile/package.json`

## Current Behavior
Okyo is an Expo React Native app backed by a small Express API. The current product centers on scanning a food photo, sending provider-visible image data to the API, getting an OpenRouter-backed food analysis and generated inspired-by recipe, then showing a result with confidence, estimated cost, grocery list, save/share actions, and retry-friendly failure states.

Primary docs:
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)
- [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md)
- [MOBILE_APP.md](./MOBILE_APP.md)
- [API_BACKEND.md](./API_BACKEND.md)
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [RECIPE_GENERATION.md](./RECIPE_GENERATION.md)
- [ONBOARDING.md](./ONBOARDING.md)
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [FABLE_ROUTING.md](./FABLE_ROUTING.md)

Operations docs:
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)
- [SECURITY.md](./SECURITY.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
- [KNOWN_RISKS.md](./KNOWN_RISKS.md)
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)

App area docs:
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
- [NAVIGATION.md](./NAVIGATION.md)
- [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md)

## Important Constraints
- Keep default AI routing on OpenRouter / `openai/gpt-4o-mini` unless a task explicitly changes it.
- Keep Fable private, opt-in, capped, and fail-closed.
- Do not edit or commit secrets, local env files, runtime logs, generated native folders, generated screen batches, `.swarm/`, `ruvector.db`, or dependency folders.
- Treat food identification, recipe, nutrition, and cost information as estimates.

## Known Risks or Edge Cases
- Some older docs describe broader mock fallback behavior. The new wiki reflects inspected current code.
- `node_modules` are not installed in this workspace, so validation commands require install first.
- Several generated asset folders are large and should not receive casual churn.

## Related Docs
- [CLAUDE.md](../../CLAUDE.md)
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)
- [KNOWN_RISKS.md](./KNOWN_RISKS.md)
