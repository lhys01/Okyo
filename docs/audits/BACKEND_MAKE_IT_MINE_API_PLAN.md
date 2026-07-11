# Backend Make It Mine API Plan

## 1. Executive summary

Okyo should add a backend Make It Mine endpoint as an on-demand recipe adaptation planner:

`POST /v1/recipes/adapt`

V1 should return a structured adaptation plan only, not a full adapted recipe preview. This matches the current mobile Make It Mine behavior, keeps the feature deterministic, avoids accidental recipe fabrication, and preserves the scan path. A full adapted recipe preview should wait until Okyo has AI output validation, ingredient closure checks, grocery coherence checks, and Recipe Check validation wired into the adaptation pipeline.

The endpoint should follow the Recipe Check pattern already in the API: a typed request, strict Zod validation at the route boundary, a separate deterministic service, versioned response types, and no dependency on model routing or scan latency.

## 2. Current repo findings

- `apps/api/src/server.ts` defines API routes inline. `POST /v1/recipes/check` is currently placed before the dynamic `GET /v1/recipes/:recipeId` route, validates with Zod, calls `buildRecipeQualityReport`, and returns `{ ok: true, report }`.
- `apps/api/src/types/recipeQuality.ts` keeps Recipe Check request and response contracts outside the main `types.ts` file.
- `apps/api/src/services/recipeCheckService.ts` is a deterministic service that inspects recipe shape, ingredients, steps, timing, equipment, pantry staples, budget opportunities, speed opportunities, and soft health opportunities.
- `apps/api/src/types.ts` contains the central `Recipe` type. Recipes include ingredients, steps, structured steps, substitutions, pantry notes, equipment, grocery items, savings, and cooking metadata.
- `apps/api/src/store.ts` confirms the backend is still mock and in-memory. Generated recipes use a one-day TTL store for deferred coaching, and saved recipes are local in-memory data. There is no durable user account, database-backed pantry, or persistent taste profile confirmed in the repo.
- `apps/api/src/services/aiService.ts` is already large and owns scan orchestration, recipe generation, coaching enrichment, and provider error handling. The Make It Mine API should not grow this file.
- `apps/api/src/services/openRouterProvider.ts` owns OpenRouter JSON calls, model failover for recipe generation, schema validation, timeouts, and provider errors. V1 adaptation should not change provider configuration or model routing.
- `apps/mobile/src/utils/makeItMine.ts` already implements local deterministic adaptation options. Current goals are `faster`, `cheaper`, `beginner`, `pantry`, `healthier`, `lighter`, `higher_protein`, `less_spicy`, `more_spicy`, `more_flavor`, and `leftovers`.
- `apps/mobile/src/screens/RecipeDetailScreen.tsx` renders Make It Mine as a chip-based preview. It shows a selected option with helper copy, preview title, promise, confidence, changes, and tradeoff. The original recipe stays saved as-is.

## 3. Recommended endpoint

Recommended endpoint:

```http
POST /v1/recipes/adapt
```

Route placement:

- Add it in `apps/api/src/server.ts` near `POST /v1/recipes/check`.
- Place it before `GET /v1/recipes/:recipeId` so `adapt` is not interpreted as a recipe id.
- Keep it on demand. Do not call it from `POST /v1/scans`.

V1 response strategy:

- Return a structured adaptation plan only.
- Do not return a fully rewritten `Recipe` in deterministic V1.
- Include an explicit `mode: "plan"` and `source: "deterministic"` so mobile can distinguish it from future AI previews.

Reasoning:

- The mobile feature is already a preview planner, not a recipe mutation engine.
- A full adapted recipe requires consistent ingredients, steps, grocery items, equipment, costs, safety cues, and cooking guidance.
- Deterministic full recipe mutation would be brittle and could quietly break cooking correctness.
- AI full previews should only ship after malformed output handling and Recipe Check validation are part of the adaptation flow.

## 4. Request/response contract

Proposed request type:

```ts
export type RecipeAdaptationGoal =
  | 'faster'
  | 'cheaper'
  | 'beginner'
  | 'pantry'
  | 'healthier'
  | 'lighter'
  | 'higher_protein'
  | 'less_spicy'
  | 'more_spicy'
  | 'more_flavor'
  | 'leftovers';

export type RecipeAdaptationSource = 'scan' | 'foodIdea' | 'savedRecipe' | 'manual';

export type RecipeAdaptationRequest = {
  recipe: Recipe;
  goals: RecipeAdaptationGoal[];
  context?: {
    source?: RecipeAdaptationSource;
    skillLevel?: string;
    timePreference?: string;
    budgetPreference?: string;
    availableIngredients?: string[];
    dislikes?: string[];
    equipment?: string[];
    servings?: number;
    userGoal?: string;
    mealRoutinePreference?: string;
    qualityReport?: RecipeQualityReport;
  };
};
```

Proposed response type:

```ts
export type RecipeAdaptationChangeType =
  | 'ingredient'
  | 'step'
  | 'shopping'
  | 'timing'
  | 'equipment'
  | 'flavor'
  | 'leftovers'
  | 'safety';

export type RecipeAdaptationChange = {
  id: string;
  type: RecipeAdaptationChangeType;
  label: string;
  detail: string;
  priority: 'primary' | 'optional';
  goal: RecipeAdaptationGoal;
};

export type RecipeAdaptationPlan = {
  version: 1;
  mode: 'plan';
  source: 'deterministic';
  summary: string;
  goals: RecipeAdaptationGoal[];
  confidence: 'low' | 'medium' | 'high';
  changes: RecipeAdaptationChange[];
  tradeoffs: string[];
  warnings: string[];
  groceryNotes: string[];
  cookingNotes: string[];
  nextBestAction: 'cook' | 'shop' | 'check_recipe' | 'clarify_recipe';
};

export type RecipeAdaptationResponse = {
  ok: true;
  adaptation: RecipeAdaptationPlan;
};
```

Route validation notes:

- Use Zod in `server.ts`, matching the current Recipe Check style.
- Require a recipe with at least a title, ingredients, steps, or structured steps.
- Require `goals` as a non-empty array with a small max, such as 1 to 4 goals.
- Accept only known goal enum values.
- Keep optional context strings bounded.
- Keep context arrays bounded, for example max 30 items and max 80 to 120 characters per item.
- Use `.strict()` on the top-level request and context object.
- Use a passthrough recipe schema, as Recipe Check does, because mobile and generated recipe objects may carry extra UI fields.

Example V1 request:

```json
{
  "recipe": {
    "id": "recipe-123",
    "title": "Spicy Chicken Rice Bowl",
    "ingredients": [
      { "name": "chicken", "quantity": "1 lb" },
      { "name": "rice", "quantity": "2 cups" }
    ],
    "steps": ["Cook chicken.", "Serve over rice."]
  },
  "goals": ["faster", "cheaper"],
  "context": {
    "source": "savedRecipe",
    "skillLevel": "beginner",
    "timePreference": "under30",
    "budgetPreference": "low",
    "availableIngredients": ["rice", "eggs", "spinach"],
    "dislikes": ["mushrooms"]
  }
}
```

Example V1 response:

```json
{
  "ok": true,
  "adaptation": {
    "version": 1,
    "mode": "plan",
    "source": "deterministic",
    "summary": "Okyo can make this faster and cheaper without changing the core bowl.",
    "goals": ["faster", "cheaper"],
    "confidence": "medium",
    "changes": [
      {
        "id": "faster-parallel-prep",
        "type": "timing",
        "label": "Prep while the pan heats",
        "detail": "Start rice first, then prep sauce and toppings while the chicken pan warms.",
        "priority": "primary",
        "goal": "faster"
      }
    ],
    "tradeoffs": ["A few garnishes may become optional, but the core flavor stays."],
    "warnings": ["The original method is short, so keep doneness cues visible while cooking."],
    "groceryNotes": ["Check pantry staples before buying duplicates."],
    "cookingNotes": ["Do not remove food safety or doneness checks when speeding this up."],
    "nextBestAction": "check_recipe"
  }
}
```

## 5. Adaptation type design

Create a new API type file instead of expanding `types.ts`:

`apps/api/src/types/recipeAdaptation.ts`

Keep the type shape close to mobile's current `RecipeAdaptationOption`, but make it more backend-friendly:

- `goals` identifies what the user asked for.
- `changes` is the main portable object mobile can render.
- `tradeoffs` explains what may change.
- `warnings` keeps safety, vague recipe, dislike, equipment, and confidence caveats visible.
- `groceryNotes` bridges to Smart Grocery without requiring a new grocery model.
- `cookingNotes` bridges to Cook Coach without changing guided cooking.
- `nextBestAction` gives mobile a simple CTA hint.
- `mode` and `source` leave room for future `mode: "preview"` and `source: "ai"` without breaking V1.

Do not put nutrition facts, calories, macros, diet compliance scores, or medical claims in the contract. Keep wording in the "lighter", "more balanced", and "more filling" lane already used by mobile.

## 6. Deterministic V1 plan

Add a new service:

`apps/api/src/services/recipeAdaptationService.ts`

Export:

```ts
export function buildRecipeAdaptationPlan(
  recipe: Recipe,
  goals: RecipeAdaptationGoal[],
  context?: RecipeAdaptationRequest['context'],
): RecipeAdaptationPlan
```

Deterministic inputs:

- Recipe title, description, ingredients, pantry flags, steps, structured steps, substitutions, equipment, total time, difficulty, servings, estimated homemade cost, and optional Recipe Quality report.
- Context source, skill level, time preference, budget preference, available ingredients, dislikes, equipment, user goal, and meal routine preference.

Goal behavior:

- `faster`: suggest parallel prep, ready grains, pre-cut produce, combining low-risk prep steps, and simplifying garnishes. Never remove doneness checks, rest time for meat, or food safety notes.
- `cheaper`: suggest pantry-first shopping, frozen or seasonal produce, stretching protein with rice/noodles/beans/veg, and swapping specialty ingredients for practical alternatives.
- `beginner`: move prep before heat, simplify pan/equipment juggling, add checkable cues, and use quality report warnings to explain what needs clarity.
- `pantry`: compare `availableIngredients` against recipe ingredients when provided. Otherwise use pantry staples from ingredient names and pantry flags. Do not claim real pantry sync.
- `healthier`: use soft language around balanced and filling meals. Suggest extra veg, acid, herbs, filling bases, and less reliance on heavy sauces. Do not count calories or macros.
- `lighter`: make rich or creamy components feel brighter with yogurt, citrus, broth, herbs, crunchy sides, or extra veg.
- `higher_protein`: suggest eggs, tofu, beans, lentils, yogurt, chicken, fish, or keeping existing protein central. Phrase as "more filling" rather than macro tracking.
- `less_spicy`: halve chili/hot sauce, move heat to the table, balance with dairy/citrus/sweetness, and warn that heat can build.
- `more_spicy`: add heat gradually with chili crisp, hot sauce, jalapeno, crushed red pepper, or blooming spices. Keep spice optional when cooking for multiple people.
- `more_flavor`: suggest browning harder, finishing with acid/herbs/crunch, tasting before serving, and small salt adjustments.
- `leftovers`: suggest storing sauce and crisp toppings separately, doubling bases or proteins, and refreshing with herbs/citrus later.

Conflict handling:

- If both `less_spicy` and `more_spicy` are requested, keep both but add a warning and prefer "spice on the side".
- If `faster` and `beginner` conflict, prefer beginner safety and explain the time tradeoff.
- If dislikes match ingredients, create a warning plus an optional swap note.
- If available ingredients match recipe ingredients, surface pantry/grocery notes without pretending quantities are known.
- If recipe quality is risky or recipe details are too sparse, set `confidence: "low"` and `nextBestAction: "check_recipe"` or `clarify_recipe`.

The service should be pure and deterministic. It should not call OpenRouter, Fable, Recipe Check, store, or scan services in V1.

## 7. Future AI enhancement plan

After deterministic V1 is proven on mobile, add optional AI enhancement as a separate path:

- Keep `buildRecipeAdaptationPlan` as the fallback and baseline.
- Add a separate service/provider file for AI adaptation, not `aiService.ts`.
- Proposed future file: `apps/api/src/services/recipeAdaptationAiService.ts`.
- If provider-specific code is needed, add a focused OpenRouter helper instead of modifying scan or recipe generation logic broadly.
- Preserve current OpenRouter default behavior.
- Do not add Fable routing unless a future prompt explicitly asks for it and preserves both Fable gates.
- Do not change provider defaults, package files, or model config for the first AI version.

Future AI can return either:

- an improved structured plan, or
- `mode: "preview"` with a constrained adapted recipe preview.

Before returning an AI recipe preview:

- Validate JSON with Zod.
- Coerce and bound every user-facing string/array.
- Run ingredient closure validation.
- Run the deterministic Recipe Check service against the adapted preview.
- Reject or downgrade to deterministic plan if steps, ingredients, equipment, or grocery output are malformed.
- Keep the original recipe untouched unless the user explicitly saves a new adapted copy later.

Malformed AI handling:

- Invalid JSON, schema mismatch, unsafe substitutions, missing steps, missing ingredients, or low-confidence recipe check should not surface raw model output.
- Return the deterministic plan with a warning such as "Okyo kept this as a plan because the preview needed more checking."
- Do not show provider names, stack traces, or raw validation errors to mobile users.

## 8. Failure/fallback behavior

Expected API failures:

- `400 bad_request`: malformed body, unknown goals, empty goals, context arrays too large, or recipe without title/ingredients/steps.
- `413 payload_too_large`: rely on Express body limit for extreme payloads.
- `500 internal_error`: unexpected server issue.

Expected deterministic fallback behavior:

- Valid but sparse recipe: return `ok: true` with low confidence, warnings, and `nextBestAction: "clarify_recipe"` or `check_recipe`.
- Unsupported or conflicting user context: ignore the unsafe part, add a warning, and keep the rest of the plan.
- Disliked ingredient found: add a warning and optional swap guidance.
- No pantry data: use only generic pantry notes and never claim synced pantry knowledge.

Mobile fallback:

- Mobile should keep using local `deriveAdaptationOptions` immediately.
- Backend adaptation should enhance or replace the selected preview only after a successful response.
- If the endpoint fails or times out, mobile should keep the local preview and avoid blocking grocery, save, or cooking actions.

## 9. Mobile migration path

Phase 1:

- Add an API client for `POST /v1/recipes/adapt`.
- Reuse existing mobile goal ids from `apps/mobile/src/utils/makeItMine.ts`.
- Keep local Make It Mine as the first render and offline fallback.
- Request backend adaptation only when the user selects a chip or opens the Make It Mine area.
- Render backend `changes`, `tradeoffs`, `warnings`, and `confidence` in the existing preview card shape.

Phase 2:

- Send Recipe Check report when available so backend can lower confidence or recommend `check_recipe`.
- Pass available local preferences only: onboarding goal, meal routine preference, selected goal, and user-provided pantry/dislike context if Okyo later collects it.
- Do not assume user accounts or durable pantry sync.

Phase 3:

- If a future `mode: "preview"` response ships, show it as "Preview adapted recipe" and keep the original recipe saved as-is.
- Add an explicit "Save adapted copy" action only after the backend can return a coherent adapted recipe object.

## 10. Latency/cost/safety notes

V1:

- No AI calls.
- No provider cost.
- No scan latency impact.
- Service should finish in a few milliseconds for normal recipe payloads.
- Keep endpoint on demand and avoid calling it during scan creation.

Future AI:

- Use short timeouts and bounded retries.
- Consider caching by recipe id or a hash of normalized recipe plus goals plus context.
- Cap goal count and context size to control prompt size.
- Never include image data or base64 in adaptation requests.
- Preserve fail-closed scan behavior.
- Do not run adaptation automatically after every scan unless product data proves it is worth the cost.

Safety:

- Do not make medical, calorie, macro, or guaranteed nutrition claims.
- Do not remove food safety cues.
- Prefer "use a thermometer" or "cook until doneWhen cue" when adapting raw meat, fish, poultry, or eggs.
- Always frame changes as suggestions unless/until Okyo returns a validated full recipe copy.

## 11. Files to add/edit in implementation

Backend files to add:

- `apps/api/src/types/recipeAdaptation.ts`
- `apps/api/src/services/recipeAdaptationService.ts`

Backend files to edit:

- `apps/api/src/server.ts`
  - Import the new service and response type.
  - Add Zod schemas for adaptation request validation.
  - Add `POST /v1/recipes/adapt` before `GET /v1/recipes/:recipeId`.

Optional backend files if tests exist or are added later:

- `apps/api/src/services/recipeAdaptationService.test.ts`

Future AI files, not V1:

- `apps/api/src/services/recipeAdaptationAiService.ts`
- Optional narrow provider helper if needed for adaptation-only OpenRouter calls.

Mobile files for a later migration:

- `apps/mobile/src/api/recipeAdaptationClient.ts`
- `apps/mobile/src/utils/makeItMine.ts`
- `apps/mobile/src/screens/RecipeDetailScreen.tsx`

Do not edit these for the backend V1 endpoint unless the implementation prompt explicitly includes mobile integration.

## 12. Validation plan

Backend implementation validation:

```bash
cd apps/api
npm run typecheck
```

Repository whitespace validation:

```bash
cd <repo-root>
git diff --check
```

Manual API smoke tests:

- Valid recipe plus `["faster", "cheaper"]` returns `ok: true`, `mode: "plan"`, and deterministic changes.
- Recipe with only a title returns a low-confidence plan with clarify/check warnings.
- Empty goals returns `400`.
- Unknown goal returns `400`.
- Missing recipe signal returns `400`.
- Conflicting spice goals returns `ok: true` with a warning.
- Disliked ingredient present returns `ok: true` with a warning and optional swap guidance.
- Existing `POST /v1/recipes/check` behavior remains unchanged.
- `POST /v1/scans` behavior and fail-closed image handling remain unchanged.

Mobile validation after integration:

```bash
cd apps/mobile
npx tsc --noEmit
```

Manual mobile QA after integration:

- Make It Mine still renders instantly from local options.
- Backend success enhances the preview without layout jumps.
- Backend failure leaves the local preview visible.
- Grocery and Cook Tonight actions still work from Recipe Detail.
- No calorie or macro language appears.

## 13. Exact next execution prompt outline

Use this as the next implementation prompt:

```md
Role: You are Codex working in the Okyo repo root.

Implement deterministic backend Make It Mine V1 only.

Add:
- POST /v1/recipes/adapt
- apps/api/src/types/recipeAdaptation.ts
- apps/api/src/services/recipeAdaptationService.ts

Requirements:
- Return structured adaptation plan only, not a full adapted recipe.
- Match the existing Recipe Check route/service/type pattern.
- Validate request with Zod in apps/api/src/server.ts.
- Place the route before /v1/recipes/:recipeId.
- Support goals: faster, cheaper, beginner, pantry, healthier, lighter, higher_protein, less_spicy, more_spicy, more_flavor, leftovers.
- Keep service deterministic and pure.
- Do not call OpenRouter, Fable, aiService, scan services, or store.
- Do not change provider/model config.
- Do not add dependencies or edit package files.
- Do not modify mobile files.
- Keep nutrition wording soft and avoid calories/macros.
- Preserve existing /v1/scans and /v1/recipes/check behavior.

Validation:
- cd apps/api && npm run typecheck
- git diff --check

Stop after implementation and validation. Do not commit.
```
