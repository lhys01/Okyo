# Okyo Documentation Wiki

This wiki is the source of truth for how Okyo works today. `CLAUDE.md` at the repo root is a short routing file; everything deep lives here. Docs describe the **current repo**, not future features.

## Reading Order For New Contributors

1. [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md) — what Okyo is and is not
2. [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md) — repo layout and how systems connect
3. [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) — run it
4. [SCAN_FLOW.md](./SCAN_FLOW.md) — the core loop
5. [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) — rules before you edit anything

## Core Docs

| Area | Doc |
|---|---|
| Product identity | [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md) |
| Repo architecture | [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md) |
| Mobile app (Expo/RN) | [MOBILE_APP.md](./MOBILE_APP.md) |
| API backend | [API_BACKEND.md](./API_BACKEND.md) |
| Default AI routing | [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md) |
| Fable opt-in routing | [FABLE_ROUTING.md](./FABLE_ROUTING.md) |
| Scan journey end-to-end | [SCAN_FLOW.md](./SCAN_FLOW.md) |
| Recipe generation pipeline | [RECIPE_GENERATION.md](./RECIPE_GENERATION.md) |
| Onboarding system | [ONBOARDING.md](./ONBOARDING.md) |
| Design tokens & UX tone | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Images & assets | [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md) |
| State management | [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) |
| Navigation | [NAVIGATION.md](./NAVIGATION.md) |
| Cost controls & caps | [COST_CONTROLS.md](./COST_CONTROLS.md) |
| Secrets & security | [SECURITY.md](./SECURITY.md) |
| Environment variables | [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) |
| Local dev commands | [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) |
| Validation & smoke tests | [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md) |
| Mock/seed data | [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md) |
| Known risks | [KNOWN_RISKS.md](./KNOWN_RISKS.md) |
| Contributor rules | [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) |

## Legacy Docs (kept, still useful)

Older wiki files from earlier build phases. Prefer the core docs above when they conflict; these hold historical detail and QA checklists.

- [PRD_SUMMARY.md](./PRD_SUMMARY.md), [USER_FLOWS.md](./USER_FLOWS.md), [UX_COPY.md](./UX_COPY.md), [MONETIZATION.md](./MONETIZATION.md)
- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md), [API_SPEC.md](./API_SPEC.md), [DATA_MODEL.md](./DATA_MODEL.md), [AI_PIPELINE.md](./AI_PIPELINE.md), [COST_ENGINE.md](./COST_ENGINE.md)
- [SECURITY_AND_COST_CONTROLS.md](./SECURITY_AND_COST_CONTROLS.md), [KNOWN_ISSUES.md](./KNOWN_ISSUES.md), [FAKE_V1_STATUS.md](./FAKE_V1_STATUS.md)
- [BETA_TESTING_CHECKLIST.md](./BETA_TESTING_CHECKLIST.md), [AI_SCAN_TESTING_CHECKLIST.md](./AI_SCAN_TESTING_CHECKLIST.md), [ANALYTICS_EVENTS.md](./ANALYTICS_EVENTS.md)
- [BUILD_FROM_ZERO.md](./BUILD_FROM_ZERO.md), [BUILD_FROM_ZERO_CLAUDE.md](./BUILD_FROM_ZERO_CLAUDE.md), [V1_BUILD_TASKS.md](./V1_BUILD_TASKS.md)
- [START_HERE.md](./START_HERE.md), [START_HERE_CLAUDE.md](./START_HERE_CLAUDE.md), [FEATURE_RANKINGS_GALLERY_PACKS.md](./FEATURE_RANKINGS_GALLERY_PACKS.md), [OKYO_STABILITY_AUDIT.md](./OKYO_STABILITY_AUDIT.md)

Audit reports (Fable design doc, regression reports, production decisions) live in `docs/audits/`. Seed/product-vision material lives in `docs/seed/`.
