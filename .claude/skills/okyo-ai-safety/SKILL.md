---
name: Okyo AI Safety
description: Use when touching scan recognition, image upload, AI provider code, OpenRouter, recipe generation, costs, nutrition, fallback behavior, or result confidence.
---

# Okyo AI Safety

Use this skill whenever a task touches AI, image upload, scan results, recipes, nutrition, cost, or confidence.

## Hard Rules

- Never pretend a failed AI result is real.
- Never show the default mock pasta result for a real uploaded image failure.
- Keep mock/demo fallback behavior for demo/mock mode only.
- If OpenRouter fails on an uploaded image, show a clear friendly failure state.
- If the image is non-food or unclear, say so clearly.
- If the model is unsure but the image may be food, prefer an unclear-food-photo state over a definite not-food state.
- Recipes are copycat-style or inspired-by, never official restaurant recipes.
- Do not show technical AI/provider errors to normal users.
- Development debug metadata is okay when hidden behind dev-only UI.

## Privacy And Data

- Never expose API keys, secrets, or private data.
- Never hardcode sensitive values.
- Never commit `.env` files.
- Never log API keys or full base64 image payloads.
- Do not store user food images unless the user saves a recipe or explicitly opts in.

## Output Honesty

- Treat AI outputs as uncertain.
- Always include confidence and editable or retry-friendly behavior when relevant.
- Never present AI-generated food identification, nutrition, cost, or recipe data as exact.
- Cost and savings estimates should read as estimates, not facts.

## Debugging Scan Issues

When fixing scan handoff or result state bugs:

1. Check the API response first.
2. Check mobile scan decision logic.
3. Check Zustand state writes.
4. Check navigation params.
5. Check ResultSummary rendering source.
6. Do not change prompts or provider behavior unless the task explicitly asks.

## Reference Files

Read these only when needed:

- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/utils/scanDecision.ts`
- `apps/mobile/src/api/client.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `docs/wiki/AI_PIPELINE.md`
