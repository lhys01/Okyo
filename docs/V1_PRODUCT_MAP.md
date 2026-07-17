# Okyo V1 product map

This map records the repository state inspected before the focused V1 rebuild and the resulting ownership boundary.

## Before the rebuild

| System | Before | Decision | V1 outcome |
| --- | --- | --- | --- |
| Primary navigation | Home, center Scan action, Saved, Profile, plus hidden Grocery/Recipe routes inside the tab navigator | Rebuild | Exactly Home, Grocery, Saved, Settings; scan and recipe work live in the root stack |
| Home | Command-center recommendations mixed real recipes with generated/static suggestions | Rebuild | Scan actions first, one real latest/saved recommendation, at most three additional saved recipes, bounded real scan history |
| Scan | Camera/library, explicit development mock path, robust failure routing | Keep and harden | Home launches camera/library intents; duplicate requests are blocked; real failures remain failures |
| Written ideas | Local regex extraction produced a fabricated draft recipe | Remove and rebuild | Authenticated provider-backed `/v1/ideas/recipe`; no local recipe fabrication |
| Recipe/result | High-quality generation, validation, adaptations, recipe check, and image honesty; cost/savings presentation | Keep core, remove breadth | Recipe detail, optional labeled nutrition estimate, allergen warning, pre-cook checkpoint; cost/savings removed end to end |
| Guided cooking | Structured steps, Kiko step art, coaching, timers | Keep and harden | Persisted progress, previous/next, completion, useful timers that use deadlines across backgrounding |
| Sharing | Scan-result card, legacy achievement-oriented names, no explicit finished-photo picker | Rebuild | One branded original/finished-meal card, optional finished photo, duplicate-tap guard, temporary-file cleanup |
| Grocery | Per-recipe smart list with non-persisted checks | Rebuild | Persisted multi-recipe consolidated list with conservative normalization and source traceability |
| Saved | Real saved recipes mixed with weak category filters | Rebuild | Real recipes only, search, reliable difficulty filter, four required sorts, unsave, grocery selection |
| Settings/Profile | Profile destination and mostly development/reset controls | Rebuild/remove | Settings tab contains device settings, accessibility guidance, configured legal/support links, version, and real local-data deletion; Profile removed |
| Onboarding | Separate welcome route and persisted completion flag | Remove | Fresh launch enters Home directly |
| Gamification | XP, daily check-in, event ledgers, reward/badge component variants and analytics | Remove | State, persistence, UI, event fields, and component branches removed |
| Savings/cost | Provider fields, API normalization, recipe/scan fields, mobile state, analytics, and UI | Remove | Removed from provider contracts, API/mobile types, persistence validation, store, analytics, screens, and tests |
| Saved food ideas | Separate persisted local object plus fabricated extracted recipe | Remove with migration | Legacy extracted recipes migrate into Saved; the obsolete container is dropped |
| API | Health/debug, scans, recipe check/adapt/coaching | Infrastructure required by retained flows | Retained and added provider-backed written-idea generation; no social/commerce/gamification endpoints existed |
| Authentication | Anonymous Supabase session and authenticated `/v1` boundary | Infrastructure required | Retained for scan/idea capacity, user-scoped persistence, and coaching |
| Feature flags | AI/provider controls, private two-gate Fable, development result QA | Infrastructure required | Retained; QA mock remains development-only and Fable remains fail-closed |
| Analytics | Scan/result/save/grocery/share/settings plus retired onboarding/reward properties | Rebuild | Retained flow events only; onboarding and savings properties removed |
| Assets | Kiko mascot/step art, backgrounds, scan samples for explicit development QA, retired static recipe photos, protected untracked Kiko source assets | Keep useful art; remove dead art; protect source | Active Kiko step art, mascot poses, and backgrounds stay; the unreferenced static recipe-photo library, unused mascot poses, and template assets are removed; protected `kiko-static` remains untracked |

## Final route map

The four tab routes are `HomeScreen`, `GroceryListScreen`, `LibraryScreen` (title “Saved”), and `SettingsScreen`, in that order. Internal root-stack routes are `ScanScreen`, `FoodIdeaScreen`, `AnalysisLoadingScreen`, `ResultSummaryScreen`, `RecipeDetailScreen`, `RecipeStepsScreen`, and `ShareCardPreviewScreen`. There are no configured deep links or notification destinations.

## Durable state

V1 persists scan context/history, selected recipe mode, saved recipes and saved photo references, grocery recipe/item state, and cooking progress. Migration version 3 bounds recent scans to 12, validates grocery/cooking values, converts legacy saved-food-idea recipes into normal saved recipes, and ignores retired onboarding, gamification, premium, and savings fields.

## Retained non-product infrastructure

OpenRouter generation and validation, Supabase authentication/persistence, quota/rate limiting, scan timing telemetry, recipe coaching/check/adaptation, image preparation/storage, Kiko art mapping, and development-only result QA remain because they directly support reliable scan-to-cook behavior or safe local development.
