# Okyo Stability Audit

Date: 2026-06-10

## 1. Current Architecture Summary

Okyo is currently a React Native + Expo mobile app with a local TypeScript/Express API.

Mobile app:
- Lives in `apps/mobile`.
- Uses Expo SDK 55, React Native, TypeScript, React Navigation, Zustand, and AsyncStorage persistence.
- `App.tsx` mounts a single `NavigationContainer` and `AppNavigator`.
- `AppNavigator` switches between onboarding and the main app based on `hasCompletedOnboarding`.
- `MainTabs` owns the bottom tab shell: Scan, Library, Savings, Rankings, Restaurant Packs, and Settings.
- The scan/result/recipe flow is stack-based: `ScanScreen -> AnalysisLoadingScreen -> ResultSummaryScreen -> RecipeDetailScreen`.

API:
- Lives in `apps/api`.
- Uses Express, TypeScript, Zod validation, and in-memory mock data.
- `POST /v1/scans` validates a scan request, calls `createAiScan`, then returns an `ApiResponse`.
- No database, auth, payments, permanent image storage, or production persistence exists.

AI/OpenRouter layer:
- `aiConfig.ts` reads `.env` and controls whether OpenRouter can be used.
- `openRouterProvider.ts` handles OpenRouter calls, JSON extraction, schema validation, timeout/error reasons, and prompt rules.
- `aiService.ts` owns the scan decision tree: demo mock, AI unavailable, image not provider-visible, vision analysis, recipe generation, cost estimates, success, partial, rejected, and failed states.
- Real uploaded image failures are designed to fail honestly instead of silently showing the default pasta mock.

State management:
- `useOkyoStore.ts` is a single Zustand store persisted under `okyo-local-state`.
- It stores onboarding state, latest scan result, latest scan recipes, latest scan status, latest scan failure, latest scan recipe, selected scan image, AI debug metadata, selected mode, saved recipes, XP, badges, challenges, savings, and rankings.
- Latest scan fields are persisted, not ephemeral.

Mock/demo data:
- API mock data lives in `apps/api/src/mockData.ts`.
- Mobile mock data lives in `apps/mobile/src/mocks`.
- The default demo scan is Spicy Vodka Rigatoni.
- The app has explicit demo scan behavior through `source: "mock"` or placeholder image metadata.

Scan flow:
- `ScanScreen` creates image metadata, strips unsafe preview data for mobile state, sets local latest scan state to pending, navigates to `AnalysisLoadingScreen`, and calls `createMockScan`.
- On API success, `ScanScreen` writes `latestScanStatus`, `latestScanResult`, `latestScanRecipes`, and `latestScanRecipe`.
- On uploaded-image API failure, it writes an honest failed state instead of demo data.
- On demo/mock API failure, it falls back to the local demo result.

Result/recipe flow:
- `AnalysisLoadingScreen` navigates to `ResultSummaryScreen` when `latestScanStatus` is no longer pending, or after a 5.2 second waiting timeout.
- `ResultSummaryScreen` does not receive a `scanId` or result param. It reads everything from Zustand.
- `RecipeDetailScreen`, `GroceryListScreen`, and `ShareCardPreviewScreen` also read scan/recipe context from Zustand and route params.

## 2. Current Truth Of The App

What works:
- The mobile app has a complete mock MVP shell: onboarding, scan, loading, result, recipe detail, grocery list, saved library, savings, share preview, challenges, rankings, packs, and settings.
- The API can receive image metadata/data URLs and return typed scan results.
- The API has a meaningful OpenRouter path with guarded success/partial/rejected/failed behavior.
- The scan pipeline can now reach API success with `status: success`, `scanState: clear_food`, `foodDetected: true`, a dish name, and 3 recipes.
- TypeScript checks and API build pass.

What is fake/demo/mock:
- The default Spicy Vodka Rigatoni result is still seeded mock/demo data.
- Savings, prices, recipes, grocery lists, XP, rankings, packs, and saved data are local or in-memory estimates.
- No production database, accounts, payment, analytics backend, image storage, or production AI workflow exists.
- "Mock API" naming still exists in the mobile client even when the API may use OpenRouter.

What is unstable:
- The scan handoff relies on several separate Zustand setter calls instead of one atomic scan-session update.
- `ResultSummaryScreen` has no route context. It can only infer the current scan from global store state.
- `AnalysisLoadingScreen` can navigate to the result screen after 5.2 seconds even if the scan is still pending.
- Multiple scan requests are not guarded by a request/session id, so old async responses can still write latest scan state.
- The result route decision log can say `result_missing_recipe_path` even when the app has no scan context at all, because missing recipe is checked before missing scan.
- Dev scan logs are noisy and duplicated between API client, scan screen, result screen, API server, and AI service.

What is risky:
- The app has one global `latestScan*` area doing too many jobs: active scan, latest result, selected saved recipe, recipe detail context, grocery context, and share context.
- Source files are already dirty in the working tree. Do not do a rewrite until those changes are stabilized or intentionally accepted.
- A Swift rewrite would copy unclear product/state bugs into a second codebase before the current contract is locked.

What should not be touched yet:
- Do not rewrite the app.
- Do not start a Swift/SwiftUI migration.
- Do not redesign UI.
- Do not change package files just to add tooling.
- Do not expand product scope.
- Do not change API contracts until the scan handoff is fixed and contract tests prove what is needed.

## 3. Exact Likely Reason Scan Still Feels Broken

The likely bug is mobile state/navigation, not image upload.

The important evidence:
- `ScanScreen` starts a scan by clearing recipes, setting status to `pending`, and navigating to loading. See `apps/mobile/src/screens/ScanScreen.tsx:61`.
- On success, `ScanScreen` should write `latestScanStatus`, `latestScanResult`, `latestScanRecipes`, and `latestScanRecipe`. See `apps/mobile/src/screens/ScanScreen.tsx:90`.
- `ResultSummaryScreen` reads only global store state. It does not receive a `scanId`, result object, or recipes through route params. See `apps/mobile/src/screens/ResultSummaryScreen.tsx:51`.
- `ResultSummaryScreen` chooses `result_missing_recipe_path` when `selectedRecipe` is missing. It checks this before missing scan, so logs can mislabel an empty scan context as a missing recipe. See `apps/mobile/src/screens/ResultSummaryScreen.tsx:351` and `apps/mobile/src/screens/ResultSummaryScreen.tsx:897`.
- The state you reported later, `latestScanRecipesLength: 0` and `latestScanStatus: null`, is not the API success state. It is an initial/reset state.

Most likely sequence:
1. API returns a valid success with 3 recipes.
2. Mobile either briefly writes success or is expected to write success.
3. Later, `ResultSummaryScreen` mounts or re-renders with an empty/global reset state: recipes `[]`, status `null`, and no selected recipe.
4. Because result screen has no route-bound scan context, it has no way to recover the successful response.
5. The log says `result_missing_recipe_path`, but the real problem may be "missing active scan snapshot."

Specific code risks found:
- State is reset after success by user-facing paths: `goToScan` and `goBackToScanTab` clear latest scan fields in `ResultSummaryScreen`.
- `AnalysisLoadingScreen` also clears latest scan fields when the user presses back.
- `SettingsScreen` can clear local scan data through `clearSavedData`.
- `LibraryScreen` and `SavingsDashboardScreen` intentionally replace latest scan context with saved-recipe context.
- There is no cleanup `useEffect` on blur/unmount that clears latest scan state.
- `ResultSummaryScreen` is not in the tab navigator, so tabs are not directly rendering it with no context.
- The loading screen can navigate to result while pending after 5.2 seconds. That should show the pending state, but it makes early/empty result rendering possible.
- There is no scan request id. If a user starts another scan or double taps, async responses can overwrite each other.

The most direct fix is to create an atomic "scan session" in the store and route by scan session id. A success write should set status, scan, recipes, selected recipe, image, AI debug metadata, and request id together. `ResultSummaryScreen` should only render a result for the active completed session, not whatever happens to be in loose `latestScan*` fields.

## 4. Product Recommendation

Should you buy Claude Code and rewrite?
- No. Not for a rewrite right now. The current issue is narrow enough to fix in React Native.

Should you rewrite in Swift now?
- No. A Swift rewrite would not fix the unknown state handoff. It would recreate it in a new stack, slower.

Should you stay in React Native and stabilize first?
- Yes. Be blunt about it: Okyo is not too broken for React Native. It is too unstable for a rewrite. Stabilize the scan contract, state handoff, and result route first.

## 5. Stabilization-First Plan: Safest Next 5 Codex Tasks

### Task 1: Fix Scan Success State Persistence And Result Routing

Goal:
- Make a successful API scan stay successful from API response to result screen.
- Replace loose multi-setter handoff with one atomic scan-session write.
- Add a request/session id so stale async responses cannot overwrite the active scan.
- Make `ResultSummaryScreen` render from the active scan session or show a true missing-scan state.

Files likely touched:
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/utils/scanDecision.ts`

What not to touch:
- API behavior.
- UI redesign.
- Package files.
- Demo/mock data content.

Checks to run:
- `cd apps/mobile && npx tsc --noEmit`
- `git diff --check -- apps/mobile/src`

Manual test:
- Reset saved data.
- Upload a real food photo.
- Confirm API logs success with recipes.
- Confirm result shows dish and recipe, not missing recipe.
- Tap View Recipe, Groceries, Share, Save.
- Start two scans quickly and confirm only the latest scan wins.

Risk level:
- Medium. It touches the central scan state, but the blast radius is contained.

### Task 2: Lock The API/Mobile Scan Contract With Focused Tests

Goal:
- Freeze the request/response expectations for success, partial, rejected, failed, and demo scans.
- Add focused tests around `scanDecision` and API scan output mapping.
- Ensure real uploaded failures never show mock Spicy Vodka.

Files likely touched:
- `apps/mobile/src/utils/scanDecision.ts`
- `apps/api/src/services/aiService.scan.test.ts`
- Possibly a small mobile pure test file if an existing no-package test path is available.
- `docs/wiki/API_SPEC.md` or this audit doc if documentation needs syncing.

What not to touch:
- Package files unless explicitly approved.
- Navigation/UI.
- Provider prompts unless a contract test proves they are wrong.

Checks to run:
- `cd apps/api && npm run typecheck`
- `cd apps/api && npm run build`
- `cd apps/mobile && npx tsc --noEmit`
- `git diff --check -- apps/api/src apps/mobile/src`

Manual test:
- Demo scan.
- Real uploaded food photo.
- Real uploaded non-food photo.
- Real uploaded too-large or image-processing-failed case.

Risk level:
- Low to medium.

### Task 3: Gate Noisy Scan Debug Logs

Goal:
- Keep useful dev diagnostics but reduce duplicate/noisy logs.
- Put scan request/response summaries behind one debug utility or one dev flag.
- Never log full base64 payloads or sensitive image data.

Files likely touched:
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/api/src/server.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`

What not to touch:
- Scan logic.
- API response shape.
- Package files.

Checks to run:
- `cd apps/api && npm run typecheck`
- `cd apps/mobile && npx tsc --noEmit`
- `git diff --check -- apps/api/src apps/mobile/src`

Manual test:
- Run one demo scan and one uploaded scan.
- Confirm logs still show status, scanState, recipes length, and route decision.
- Confirm logs do not spam duplicate route/failure lines.

Risk level:
- Low.

### Task 4: Make Real Scan Results Honest, Editable, And Retry-Friendly

Goal:
- Tighten real-scan UX after the state handoff is stable.
- Preserve honest uncertain/partial states.
- Keep editable dish name UI, but do not imply edits regenerate recipes until the API supports it.
- Make savings clearly estimated and user-entered for real scans.

Files likely touched:
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/screens/RecipeDetailScreen.tsx`
- `apps/mobile/src/screens/GroceryListScreen.tsx`
- `docs/wiki/UX_COPY.md`

What not to touch:
- AI prompts.
- API contract.
- Mock data.
- UI redesign.

Checks to run:
- `cd apps/mobile && npx tsc --noEmit`
- `git diff --check -- apps/mobile/src`

Manual test:
- Clear food scan.
- Uncertain food scan.
- Partial recipe generation path.
- Non-food rejection.
- Confirm no mock pasta appears for real failures.

Risk level:
- Medium.

### Task 5: Clean Mobile Navigation/Tab Polish After Scan Stability

Goal:
- Only after scan state is stable, clean floating tab spacing and back behavior so the core loop feels less fragile.
- Ensure result, recipe, grocery, share, and tab transitions do not accidentally clear active scan context.

Files likely touched:
- `apps/mobile/src/navigation/MainTabs.tsx`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- Possibly `apps/mobile/src/components/ScreenScaffold.tsx`

What not to touch:
- Product features.
- API.
- AI service.
- Package files.

Checks to run:
- `cd apps/mobile && npx tsc --noEmit`
- `git diff --check -- apps/mobile/src`

Manual test:
- Onboarding to Scan.
- Scan to Loading to Result.
- Result to Recipe to Grocery to Share.
- Switch tabs and return.
- Back buttons from each screen.

Risk level:
- Low to medium.

## 6. Contract Lock: Scan API Contract

Endpoint:
- `POST /v1/scans`

Envelope:
- Success: `{ ok: true, data: CreateScanResult }`
- Failure: `{ ok: false, error: { code, message, details? } }`

Request shape:
```ts
type CreateScanRequest = {
  source?: 'camera' | 'photos' | 'mock';
  mode?: 'Restaurant Copy' | 'Budget' | 'Healthy';
  image?: {
    uri?: string;
    dataUrl?: string;
    fileName?: string;
    mimeType?: 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/webp';
    width?: number;
    height?: number;
    sizeBytes?: number;
    dataUrlSizeBytes?: number;
    source?: 'camera' | 'photos' | 'mock';
    placeholder?: boolean;
    conversionError?: string;
  };
};
```

Request notes:
- `source` defaults to `mock`.
- `mode` defaults to `Restaurant Copy`.
- Server accepts data URL aliases through normalization.
- JSON body limit is 16 MB.
- Image data URLs are capped at 12,000,000 chars and must be base64 image data.

Success response shape:
```ts
type CreateScanSuccess = {
  status: 'success';
  scan: ScanResult;
  recipe?: Recipe;
  recipes?: Recipe[];
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  note: string;
  aiSource: 'openrouter_ai' | 'mock_ai' | 'fallback_ai';
  aiProvider?: 'openrouter';
  visionModel?: string;
  recipeModel?: string;
  fallbackReason?: string;
  confidence?: number;
  scanState?: ScanState;
  uploadedImage?: boolean;
  image?: SafeScanImageMetadata;
  source: 'camera' | 'photos' | 'mock';
};
```

Partial response shape:
```ts
type CreateScanPartial = {
  status: 'partial';
  scan: ScanResult;
  recipe?: Recipe;
  recipes?: Recipe[];
  note: string;
  partialReason: string;
  aiSource: 'openrouter_ai' | 'mock_ai' | 'fallback_ai';
  aiProvider?: 'openrouter';
  visionModel?: string;
  recipeModel?: string;
  fallbackReason?: string;
  confidence?: number;
  scanState?: ScanState;
  uploadedImage?: boolean;
  image?: SafeScanImageMetadata;
  source: 'camera' | 'photos' | 'mock';
};
```

Rejected/failed response shape:
```ts
type CreateScanRejectedOrFailed = {
  status: 'rejected' | 'failed';
  scanId: string;
  note: string;
  rejectionType: 'not_food' | 'unclear_image' | 'ai_failed';
  rejectionReason: string;
  aiSource: 'openrouter_ai' | 'mock_ai' | 'fallback_ai';
  aiProvider?: 'openrouter';
  visionModel?: string;
  recipeModel?: string;
  fallbackReason?: string;
  confidence?: number;
  scanState?: ScanState;
  uploadedImage?: boolean;
  image?: SafeScanImageMetadata;
  source: 'camera' | 'photos' | 'mock';
};
```

Statuses:
- `success`: scan and recipe result are usable.
- `partial`: scan-style result exists, but a complete recipe may be missing.
- `rejected`: image is not food or too unclear.
- `failed`: AI/provider/image processing path failed.
- `pending`: mobile-only local state, not an API status.

Scan states:
- `clear_food`: food and dish are clear.
- `food_present_uncertain_dish`: food is visible but dish/cuisine is uncertain.
- `partial_food`: food is visible but partial, low quality, or ambiguous.
- `not_food`: clearly no food.
- `too_unclear`: too blurry/dark/blocked to identify food safely.

Food evidence fields:
- Current public scan result evidence: `scan.scanState`, `scan.dishName`, `scan.bestGuessDishName`, `scan.bestGuessNote`, `scan.possibleDishNames`, `scan.confidence`, `scan.restaurantStyle`, `scan.matchScore`.
- Internal AI evidence: visible ingredients/components exist in `aiService` analysis but are not consistently returned in `CreateScanResult`.
- Mobile also treats returned recipes as food evidence.

Recipe fields:
- `id`, `scanResultId`, `title`, `mode`, `description`, prep/cook/total/active time, servings, skill/difficulty, estimated homemade cost, estimated savings, ingredients, ingredient groups, steps, structured steps, substitutions, pantry note, confidence note, equipment, grocery items, spice pairings, cooking terms, storage, and mistake warnings.

Rejection/error fields:
- API envelope validation errors use `ok: false`.
- Scan-level AI failures use `ok: true` with `status: failed` or `status: rejected`.
- User-facing fields are `rejectionType`, `rejectionReason`, `note`, and optional `fallbackReason`.
- Normal users should not see provider internals.

Demo vs real scan rules:
- Demo scan is `source: "mock"` or placeholder image metadata.
- Demo scan may return the Spicy Vodka Rigatoni mock.
- Real uploaded image is `source: "camera"` or `source: "photos"` with non-placeholder image metadata.
- Real uploaded image with AI disabled must fail honestly.
- Real uploaded image without provider-visible image data must fail honestly.
- Real uploaded OpenRouter failure may produce failed, rejected, partial, or starter-fallback success depending on where it failed.
- Real uploaded image failure must not show default mock pasta as if analyzed.

## 7. Rewrite Decision

### Option A: Stabilize Current React Native App

Difficulty:
- Low to medium.

Timeline:
- 1 to 2 focused days for the scan handoff.
- About 1 week to lock the contract, logs, and core manual QA path.

Risk:
- Lowest.

What breaks:
- Some existing loose latest-scan assumptions may need to be made explicit.
- Saved recipe context and active scan context may need separation.

When it makes sense:
- Now.
- This is the fastest way to prove the product loop: upload photo -> result -> recipe -> grocery/share/save.

### Option B: Start SwiftUI Rewrite With Same API

Difficulty:
- Medium to high.

Timeline:
- Multiple weeks before it reaches current feature parity.

Risk:
- High right now because the scan/session contract is not locked.

What breaks:
- Expo/mobile screens, existing navigation, local state behavior, saved recipes, debug flow, and all current UI implementation work.

When it makes sense:
- Later, after scan success is stable and the API/mobile contract is documented and tested.
- It may make sense if the product becomes iOS-only and native camera/share/performance needs dominate.

### Option C: Rewrite Everything Including Backend

Difficulty:
- Very high.

Timeline:
- Several weeks to months.

Risk:
- Highest.

What breaks:
- Everything: API, mobile, AI prompts, mocks, saved local flows, docs, QA assumptions, and debugging context.

When it makes sense:
- Not now.
- Only after product-market clarity and after the scan contract is stable enough to preserve.

## 8. Final Recommendation

Stay in React Native and stabilize first.

Do not buy Claude Code for a rewrite and do not start SwiftUI yet. The current app has enough real structure to repair. The broken feeling is coming from scan-session state and navigation, not from React Native as a stack. The next best spend of time is one focused Codex task: make the scan success handoff atomic, route result screens by scan session, and prevent stale/empty store state from masquerading as a missing recipe.

## Files Read

Requested files read:
- `AGENTS.md`
- `README.md`
- `docs/wiki/BUILD_FROM_ZERO.md`
- `docs/wiki/AI_PIPELINE.md`
- `docs/wiki/FAKE_V1_STATUS.md`
- `docs/wiki/KNOWN_ISSUES.md`
- `docs/wiki/UX_COPY.md`
- `docs/seed/OKYO_MASTER_ONE_NOTE.md`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/navigation/MainTabs.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/api/config.ts`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/api/types.ts`
- `apps/mobile/src/utils/scanDecision.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/screens/RecipeDetailScreen.tsx`
- `apps/mobile/src/screens/GroceryListScreen.tsx`
- `apps/mobile/src/screens/ShareCardPreviewScreen.tsx`
- `apps/mobile/src/screens/LibraryScreen.tsx`
- `apps/mobile/src/screens/SavingsDashboardScreen.tsx`
- `apps/mobile/src/screens/SettingsScreen.tsx`
- `apps/mobile/src/screens/WelcomeScreen.tsx`
- `apps/mobile/App.tsx`
- `apps/mobile/src/components/OkyoUI.tsx`
- `apps/api/src/server.ts`
- `apps/api/src/types.ts`
- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/src/services/aiService.scan.test.ts`
- `apps/api/src/mockData.ts`

Searches run:
- `clearLatestScan`
- `resetScan`
- `setLatestScanStatus(null)`
- `latestScanStatus: null`
- `latestScanRecipes: []`
- `setLatestScanRecipe(null)`
- `setLatestScanResult(null)`
- `selectedScanImage null`
- `result_missing_recipe_path`
- `fallbackReason`
- `openrouter_output_truncated`
- `mock fallback`
- `demo scan`
- `Spicy Vodka`
- `defaultScanResult`
- `partial`
- `food_present_uncertain_dish`
- `partial_food`
- `not_food`
- `too_unclear`

## Checks Run

All requested checks passed:
- `cd apps/api && npm run typecheck`
- `cd apps/api && npm run build`
- `cd apps/mobile && npx tsc --noEmit`
- `git diff --check -- apps/api/src apps/mobile/src`

No check failures were found.

## Source Changes In This Pass

No source code was edited in this audit pass.

Created:
- `docs/wiki/OKYO_STABILITY_AUDIT.md`

No commit was made.
No `git add` was run.
