# Backend Recipe Check API Plan

## 1. Executive summary

Okyo should add a backend-supported Recipe Check as a small, safe API layer that upgrades the current local/mobile heuristics without changing scan behavior. The first backend version should be deterministic-first, with an optional AI enhancement path added behind existing OpenRouter controls later.

Recommended endpoint:

```http
POST /v1/recipes/check
```

Recommended strategy:

1. Accept a recipe object and lightweight context.
2. Run deterministic recipe-quality heuristics on the backend.
3. Return a validated, versioned `RecipeQualityReport`.
4. Keep the mobile local report as the fallback.
5. Do not block scan generation, saved drafts, grocery, or cooking flows.

This keeps the product feeling like "Okyo turns food chaos into a good meal tonight," not a technical recipe validator.

## 2. Current backend map

The API is an Express app with routes defined inline in `apps/api/src/server.ts`.

Current relevant routes:

- `POST /v1/scans`: validates scan input, applies rate/cost gates, handles Fable opt-in, calls `createAiScan`, and returns scan/recipe/grocery/share payloads.
- `GET /v1/recipes/:recipeId`: returns mock or generated recipe data via `getRecipe`.
- `POST /v1/recipes/:recipeId/save`: saves a recipe to the in-memory library.
- `POST /v1/recipes/:recipeId/coaching`: on-demand guided-cooking enrichment via `enrichRecipeCoaching`.

Current recipe pipeline:

- `apps/api/src/services/aiService.ts`
  - `createAiScan` orchestrates vision, food gate, recipe generation, costs, grocery, share card, caching, and failure behavior.
  - `generateRecipeFromDish` calls OpenRouter recipe generation, stores generated recipes for deferred coaching, records internal recipe-quality analytics, repairs platter coverage, enforces ingredient closure, regenerates grocery coverage when needed, and logs unsafe cooking heuristics.
  - `enrichRecipeCoaching` repairs coaching metadata only when the user opens guided cooking.
  - `calculateRecipeCoachingScore` scores guided-cooking coaching completeness.
- `apps/api/src/services/openRouterProvider.ts`
  - `generateRecipeWithOpenRouter` calls the text model, performs structural validation, repairs invalid structure, detects vague recipe output, and performs one recipe-quality repair pass.
  - `validateRecipeStructure` checks step array shape, missing instruction/title, and sequential step numbers.
  - `getRecipeQualityIssues` detects internal vague-generation issues such as vague ingredient names, missing amounts, too few steps, vague steps, drink/cooking mismatch, and unlisted step ingredients.
- `apps/api/src/services/recipeIngredientValidation.ts`
  - Provides pure ingredient closure utilities: `validateIngredientClosure`, `stripUnknownStepIngredients`, and `enforceStepIngredientClosure`.
- `apps/api/src/store.ts`
  - Holds mock recipes and saved recipes.
  - Holds generated recipes in a bounded in-memory TTL store for deferred coaching.
- `apps/api/src/types.ts`
  - Defines `Recipe`, `RecipeIngredient`, `RecipeStep`, `GroceryListItem`, API envelope types, and related domain types.

Current cost/safety controls:

- `apps/api/src/config/aiConfig.ts` defines OpenRouter defaults and Fable opt-in behavior.
- `apps/api/src/config/costControlConfig.ts` defines rate/cost caps.
- `apps/api/src/middleware/costControls.ts` provides scan rate limiting, global daily AI cap, Fable cap, and cost logging.

Important current dirty worktree note:

- `apps/api/src/services/aiService.ts`, `apps/api/src/services/openRouterProvider.ts`, root package files, and docs/tooling files are currently dirty outside the mobile moat checkpoint. The next implementation prompt should reconcile or intentionally preserve those changes before editing backend files.

## 3. Current mobile Recipe Check map

Committed mobile checkpoint: `df5ebbe feat(mobile): add mock-first Okyo food moat stack`.

Relevant mobile files:

- `apps/mobile/src/utils/recipeQuality.ts`
  - `buildRecipeQualityReport(recipe)` creates the local report.
  - `createFoodIdeaRecipe(input)` builds a cautious draft recipe from pasted text/link/manual note.
  - `createSavedFoodIdea(input)` saves the idea with `extractedRecipe` and `qualityReport`.
- `apps/mobile/src/components/RecipeQualityCard.tsx`
  - Renders a friendly `Okyo Recipe Check` card with score, status, top issues, fixes, and pantry chips.
  - Defensively normalizes malformed report fields.
- `apps/mobile/src/mocks/types.ts`
  - Current local type:

```ts
export type RecipeCookabilityStatus = 'cookable' | 'needs_quick_fix' | 'too_vague_to_trust';

export type RecipeQualityReport = {
  score: number;
  confidence: number;
  cookabilityStatus: RecipeCookabilityStatus;
  missingIngredients: string[];
  missingSteps: string[];
  vagueInstructions: string[];
  timeWarnings: string[];
  equipmentWarnings: string[];
  pantryStaples: string[];
  budgetOpportunities: string[];
  speedOpportunities: string[];
  healthOpportunities: string[];
  whatCouldGoWrong: string[];
  fixesApplied: string[];
  userFacingSummary: string;
};
```

Recipe Check currently appears on:

- Food Idea flow.
- Result Summary.
- Recipe Detail.

## 4. Recommended endpoint

Recommend Option A:

```http
POST /v1/recipes/check
```

Reason:

- The backend has no persistent user database and no durable recipe table yet.
- Generated recipes may exist only in the mobile store or in a TTL in-memory backend store.
- Food Idea draft recipes are local/mobile objects and may not have backend IDs.
- A request body with the recipe object works for scan recipes, saved recipes, and food ideas.
- It avoids pretending `POST /v1/recipes/:id/check` can always resolve state server-side.

`POST /v1/recipes/:id/check` can be added later only after recipes are persisted durably.

## 5. Request/response contract

Request:

```ts
type RecipeCheckSource = 'scan' | 'foodIdea' | 'savedRecipe';

type RecipeCheckContext = {
  source: RecipeCheckSource;
  userGoal?: string;
  timePreference?: string;
  skillLevel?: 'Easy' | 'Medium' | 'Hard' | 'Beginner' | 'Confident';
  budgetPreference?: string;
  pantryNotes?: string[];
};

type RecipeCheckRequest = {
  recipe: Recipe;
  context?: RecipeCheckContext;
};
```

Response, using existing API envelope:

```ts
type RecipeCheckResponse = {
  version: 1;
  report: RecipeQualityReport;
  source: 'deterministic' | 'ai_enhanced' | 'fallback';
  checkedAt: string;
};
```

Example:

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "source": "deterministic",
    "checkedAt": "2026-07-10T10:00:00.000Z",
    "report": {
      "version": 1,
      "status": "needs_attention",
      "score": 72,
      "confidence": "medium",
      "cookabilityStatus": "needs_quick_fix",
      "summary": "This is close, but Okyo found a few details to fix before cooking.",
      "userFacingSummary": "This is close, but Okyo found a few details to fix before cooking.",
      "issues": [],
      "fixesApplied": ["Separated pantry basics from shopping items."],
      "missingIngredients": [],
      "missingSteps": ["The method needs more step-by-step detail before cooking."],
      "vagueInstructions": [],
      "timeWarnings": [],
      "equipmentWarnings": [],
      "pantryStaples": ["salt", "black pepper"],
      "budgetIdeas": ["Check pantry staples before buying duplicates."],
      "budgetOpportunities": ["Check pantry staples before buying duplicates."],
      "speedIdeas": ["Measure the sauce first so cooking moves quickly."],
      "speedOpportunities": ["Measure the sauce first so cooking moves quickly."],
      "healthIdeas": ["Add an easy vegetable if you want it more balanced."],
      "healthOpportunities": ["Add an easy vegetable if you want it more balanced."],
      "whatCouldGoWrong": ["A vague step could leave you guessing mid-cook."]
    }
  }
}
```

Validation errors should use the existing API error envelope with `validation_error`.

## 6. RecipeQualityReport type

Backend should define a versioned type that is close to mobile, but slightly more explicit for API evolution.

```ts
export type RecipeQualitySeverity = 'info' | 'warning' | 'fix';

export type RecipeQualityIssue = {
  id: string;
  label: string;
  detail: string;
  severity: RecipeQualitySeverity;
};

export type RecipeQualityStatus = 'great' | 'good' | 'needs_attention' | 'risky';
export type RecipeCookabilityStatus = 'cookable' | 'needs_quick_fix' | 'too_vague_to_trust';
export type RecipeQualityConfidence = 'low' | 'medium' | 'high';

export type RecipeQualityReport = {
  version: 1;
  status: RecipeQualityStatus;
  score: number;
  confidence: RecipeQualityConfidence;
  cookabilityStatus: RecipeCookabilityStatus;
  summary: string;
  userFacingSummary: string;
  issues: RecipeQualityIssue[];
  fixesApplied: string[];
  missingIngredients: string[];
  missingSteps: string[];
  vagueInstructions: string[];
  timeWarnings: string[];
  equipmentWarnings: string[];
  timeRealityCheck?: string;
  difficultyNote?: string;
  pantryStaples: string[];
  budgetIdeas: string[];
  speedIdeas: string[];
  healthIdeas: string[];
  budgetOpportunities: string[];
  speedOpportunities: string[];
  healthOpportunities: string[];
  whatCouldGoWrong: string[];
};
```

Compatibility note:

- Keep `userFacingSummary`, `budgetOpportunities`, `speedOpportunities`, and `healthOpportunities` for mobile compatibility.
- Add `summary`, `issues`, `status`, `confidence`, and `version` for backend maturity.
- Mobile can initially map `confidence: 'low' | 'medium' | 'high'` to a local numeric confidence if necessary, or the mobile type can be widened in a later mobile prompt.

Runtime validation plan:

- Add a Zod schema for request body and report output.
- Clamp `score` to `0..100`.
- Limit arrays to small counts, usually 3 to 6 items.
- Trim strings and cap individual issue text length.
- Drop empty strings.
- Convert malformed AI output into a deterministic fallback report.
- Never expose raw AI/provider errors in `summary` or issue details.

## 7. Deterministic heuristic plan

V1 should start deterministic-only unless the implementation prompt explicitly enables AI enhancement.

Suggested checks:

- Missing or vague ingredients:
  - Fewer than 4 valid ingredients.
  - Ingredient quantity missing from `quantity` and combined quantity/name text.
  - Standalone vague names: `protein`, `vegetables`, `sauce`, `seasoning`, `main ingredient`, `filling`.
- Missing steps:
  - Fewer than 4 plain steps or structured steps.
  - Structured steps with empty `text`.
- Vague instructions:
  - `cook until done`, `season to taste`, `mix everything`, `prepare ingredients`, `add spices`, `cook it`, `make sauce`.
- Time realism:
  - `totalTimeMinutes` suspiciously low relative to ingredient count and step count.
  - Prep/cook totals inconsistent with explicit total.
- Equipment:
  - No `equipment` when steps reference tools or when recipe has active cooking.
- Ingredient closure:
  - Reuse `validateIngredientClosure` from `recipeIngredientValidation.ts`.
  - Include unknown step ingredients as issues.
  - Include missing grocery coverage as fixes/opportunities, not fatal.
- Pantry basics:
  - Detect salt, black pepper, oils, sugar, flour, soy sauce, garlic powder, red pepper flakes.
- Budget opportunities:
  - Duplicative pantry items.
  - Expensive proteins where smaller protein portions, tofu, eggs, beans, or store-brand swaps fit.
- Speed opportunities:
  - Long total time.
  - Many ingredients.
  - Missing prep grouping.
- Health language:
  - Use soft phrasing only: `lighter`, `balanced`, `more filling`.
  - Do not add calories/macros.
- What could go wrong:
  - Vague steps.
  - Missing doneness cues.
  - Raw chicken/fish without safe doneness cue.
  - No equipment.

Score plan:

- Start at 92.
- Subtract 8-12 per serious issue.
- Subtract 4-6 per mild warning.
- Add 1-2 for useful fixes/opportunities.
- Clamp to `40..96` for normal reports, `0..100` at schema boundary.
- Status mapping:
  - `great`: score >= 90
  - `good`: score >= 78
  - `needs_attention`: score >= 60
  - `risky`: score < 60
- Cookability mapping:
  - `cookable`: score >= 82
  - `needs_quick_fix`: score >= 62
  - `too_vague_to_trust`: score < 62

## 8. AI enhancement plan

Do not make AI enhancement part of the first backend execution unless explicitly requested. The safe sequence is:

1. Ship deterministic backend Recipe Check.
2. Wire mobile to call backend with local fallback.
3. Add optional AI enhancement later if deterministic reports feel too shallow.

If/when AI-backed:

- Use the existing OpenRouter text provider path, not a new provider.
- Keep OpenRouter as default.
- Do not change Fable routing.
- Do not use Fable unless the same existing opt-in gates are intentionally added for this endpoint later.
- Prefer a cheaper text model through existing `getAiConfig().openRouterTextModel`.
- Add a dedicated provider helper such as `checkRecipeWithOpenRouter` only if needed.
- Keep prompt and validation outside `aiService.ts`.
- Validate AI output with Zod, repair/coerce lightly, and fall back to deterministic on any failure.

AI should be additive:

- Deterministic precheck always runs first.
- AI receives a compact recipe summary plus deterministic findings.
- AI may add better wording, risks, and improvement ideas.
- AI may not remove deterministic safety warnings.
- AI may not invent nutrition facts, exact costs, or official restaurant claims.

Failure behavior:

- Provider timeout, 402/429, invalid JSON, invalid schema, empty content, or network failure returns deterministic report with `source: 'fallback'` or `source: 'deterministic'`.
- Backend logs only coarse failure reason.
- Mobile never sees raw provider messages.

## 9. Failure/fallback behavior

Recipe Check must never block the main cooking flow.

Backend:

- Bad request shape: `400 validation_error`.
- Valid recipe but deterministic issues: `200 ok` with report.
- AI enhancement failure: `200 ok` with deterministic fallback report.
- Unknown recipe ID should not matter in V1 because request carries recipe object.
- Do not create fake recipe content.
- Do not alter real uploaded image failure behavior.

Mobile later:

- Keep current local `buildRecipeQualityReport` as fallback.
- If backend call fails, silently show local report.
- If backend report is malformed, local defensive rendering still protects the UI.
- Do not show "AI failed" in normal UI.
- Avoid duplicate/conflicting reports by choosing a single report source per recipe render:
  - backend report if valid and current;
  - otherwise local report.

## 10. Latency/cost plan

Latency:

- V1 deterministic endpoint should be fast and cheap.
- Do not call Recipe Check inside `POST /v1/scans` initially.
- Mobile should request it on demand or after a recipe is displayed.
- Scan latency should remain unchanged.

Cost:

- Deterministic V1 has no model cost.
- AI enhancement later should use the existing global AI cap and a dedicated Recipe Check cap only if usage grows.
- Do not add package dependencies.
- Do not increase OpenRouter max token settings globally.

Timeouts/retries:

- Deterministic V1 needs no retries.
- AI enhancement later should use a short timeout budget and no blocking retry on the UI path.
- Any AI retry must be bounded to one attempt and degrade to deterministic.

Privacy/logging:

- Do not log full recipe text if it comes from user-pasted notes.
- Log recipe ID/source, issue counts, score, source, duration, and coarse provider failure reason.
- Do not log API keys, image data, or full base64 payloads.

No fake fallback:

- Real uploaded image failures must stay honest.
- Recipe Check fallback is only a quality report for an existing recipe, never a fake recipe generator.

## 11. File-level implementation plan

Future backend files to add:

- `apps/api/src/types/recipeQuality.ts`
  - `RecipeQualityReport`, `RecipeQualityIssue`, request/response types.
  - If the repo avoids a `types/` folder, use `apps/api/src/recipeQualityTypes.ts` or extend `apps/api/src/types.ts`; a separate file is cleaner.
- `apps/api/src/utils/recipeQualityHeuristics.ts`
  - Pure deterministic checks.
  - Can reuse/import `validateIngredientClosure`.
- `apps/api/src/utils/recipeQualityValidation.ts`
  - Zod schemas, clamping, string/list sanitizers.
- `apps/api/src/services/recipeCheckService.ts`
  - `checkRecipe(input): RecipeCheckResponse`.
  - Calls deterministic heuristics now.
  - Later coordinates AI enhancement.
- Optional later: `apps/api/src/services/openRouterRecipeCheckProvider.ts`
  - AI enhancement only, not V1 deterministic.

Future backend files to edit:

- `apps/api/src/server.ts`
  - Add `recipeCheckRequestSchema`.
  - Add `app.post('/v1/recipes/check', ...)`.
  - Keep response envelope via existing `sendOk`/`sendError`.
  - Do not alter `/v1/scans`.
- `apps/api/src/types.ts`
  - Only if choosing to export quality types from the central type file.
- `apps/api/src/services/recipeIngredientValidation.ts`
  - Prefer no changes. Reuse its existing exports.
- `apps/api/src/middleware/costControls.ts`
  - No V1 deterministic changes. Later AI enhancement may add a dedicated cap.

Future tests to add:

- `apps/api/src/services/recipeCheckService.test.ts`
  - Cookable complete recipe.
  - Missing quantities.
  - Too few steps.
  - Vague instructions.
  - Ingredient closure warning.
  - Malformed minimal recipe still yields safe report.
  - Score/status clamping.

Future mobile files to edit after backend exists:

- `apps/mobile/src/api/recipeCheckClient.ts`
  - New client call using existing API base/envelope patterns.
- `apps/mobile/src/utils/recipeQuality.ts`
  - Keep local fallback.
  - Add mapper from backend report to mobile-compatible report if needed.
- `apps/mobile/src/screens/FoodIdeaScreen.tsx`
  - After local preview, optionally ask backend for checked report.
- `apps/mobile/src/screens/RecipeDetailScreen.tsx`
  - Use cached backend report when present.
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
  - Use backend report for generated scan recipes after recipe display.
- `apps/mobile/src/state/useOkyoStore.ts`
  - Optional: cache report per recipe ID/source hash.

## 12. Mobile migration plan

1. Keep current local `buildRecipeQualityReport(recipe)` unchanged as fallback.
2. Add `recipeCheckClient.ts`.
3. Add backend call only after the first local report is visible.
4. Show no blocking spinner on Result Summary or Recipe Detail.
5. Food Idea can show a small "checking..." state only if it does not slow save/open.
6. Cache backend report by recipe ID plus a simple recipe content hash.
7. If backend report is valid, use it.
8. If backend report is missing/stale/malformed, use local report.
9. Do not save duplicate reports with conflicting status; store one normalized `qualityReport` per recipe/idea.
10. Preserve local-only drafts when offline or backend unavailable.

## 13. Validation plan

For deterministic backend implementation:

```bash
cd apps/api
npm run typecheck
```

```bash
cd <repo-root>
git diff --check
```

If mobile client integration is included in a later prompt:

```bash
cd apps/mobile
npx tsc --noEmit
```

Manual API checks:

- Complete recipe returns `ok: true` with `source: deterministic`.
- Missing quantities produce `missingIngredients`.
- Short recipe produces `missingSteps`.
- Vague recipe produces `vagueInstructions`.
- Unknown step ingredients produce issue(s) from closure validation.
- Request with invalid body returns `400 validation_error`.
- No scan endpoint behavior changes.

## 14. Risks

- Dirty worktree risk: backend provider files and package files are currently dirty. Implementation should not accidentally mix those changes unless intentionally included.
- Latency risk: adding AI Recipe Check to scan response would slow the first scan loop. Keep it deferred.
- Cost risk: AI enhancement can increase OpenRouter usage. Start deterministic-only.
- Malformed AI output risk: any future model output must be strictly validated and repaired/fallbacked.
- Mobile fallback risk: backend and mobile report shapes can drift. Keep a mapper and local fallback.
- UX risk: raw issue lists can feel like a validator. Keep copy short, warm, and action-oriented.
- Safety risk: Recipe Check must not imply exact nutrition, exact costs, official restaurant recipes, or guaranteed food safety.

## 15. Exact next execution prompt outline

Title:

```text
Okyo Backend Recipe Check API — Deterministic V1 Implementation
```

Scope:

- Implement `POST /v1/recipes/check`.
- Deterministic-only; no AI call.
- Do not change `/v1/scans`, OpenRouter defaults, Fable routing, package files, or mobile UI.
- Preserve existing API envelope.
- Add backend quality types, validation, heuristics, and service.
- Add focused API tests if the current test setup supports them without package changes.
- Run API typecheck and `git diff --check`.

Implementation steps:

1. Re-check dirty worktree and avoid unrelated changes.
2. Add backend quality types/schema.
3. Add deterministic heuristics using existing `Recipe` shape and `validateIngredientClosure`.
4. Add `recipeCheckService`.
5. Add route in `server.ts`.
6. Validate malformed/minimal inputs.
7. Run `apps/api npm run typecheck`.
8. Run root `git diff --check`.
9. Report endpoint contract and curl examples.
