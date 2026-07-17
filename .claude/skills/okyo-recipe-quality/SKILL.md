---
name: okyo-recipe-quality
description: Improve or verify recipe prompts, ingredient closure, step coherence, platter coverage, Recipe Check, Make It Mine, coaching, or model-quality evaluation.
---

# Okyo recipe quality

Read `docs/AI_AND_RECIPE_QUALITY.md` and trace the affected stage before editing.

## Fix the correct layer

- Put provider instructions and response parsing in `openRouterProvider.ts`.
- Put normalization, generation orchestration, and final gates in `aiService.ts` without growing it unnecessarily.
- Put ingredient closure in `recipeIngredientValidation.ts`.
- Put deterministic Recipe Check and adaptation behavior in their dedicated services.
- Use mobile filtering only as a display safety net, not to hide a bad API contract.

Require dish coherence, ingredient closure, ordered actionable steps, sensory doneness cues, and component coverage. Prefer general validation rules over dish-specific patches. Treat every recipe as uncertain and editable.

## Verify changes

1. Run API typecheck, tests, and build.
2. Add or update a focused deterministic test.
3. Use `quality-stress-test.ts --limit 1 --concurrency 1` only with explicit approval for paid provider calls.
4. Manually compare the affected recipe across Recipe Check, Make It Mine, groceries, and guided cooking.

Do not claim quality improvement from prompt inspection alone. Report the sample, model, cost-bearing calls, and any categories not tested.
