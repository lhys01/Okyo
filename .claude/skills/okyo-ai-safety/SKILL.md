---
name: okyo-ai-safety
description: Protect honesty, privacy, and failure behavior when changing food scans, image upload, recipe generation, confidence, costs, fallbacks, or result states.
---

# Okyo AI safety

Read `AGENTS.md`, `docs/AI_AND_RECIPE_QUALITY.md`, and the specific scan stage involved.

## Non-negotiable behavior

- Never turn a real scan failure into a demo recipe.
- Keep clear-food, uncertain-food, partial-food, non-food, too-unclear, timeout, provider, and persistence outcomes distinct.
- Prefer an editable uncertain result over a confident false rejection when food evidence exists.
- Describe recipes as inspired-by or copycat-style, never official.
- Present food identity, cost, savings, and recipe content as estimates.
- Show users a friendly retry path without provider internals.

## Privacy

- Keep image input transient on the API.
- Copy a photo locally only when the user saves the recipe.
- Never log keys, tokens, full base64 images, raw provider responses, or persistent dish-level analytics from normal traffic.

## Debugging order

1. Inspect the API outcome and scan contract.
2. Inspect mobile decision logic in `scanDecision.ts`.
3. Inspect the latest-scan session write in `useOkyoStore.ts`.
4. Inspect navigation session IDs.
5. Inspect Result Summary rendering and retry behavior.
6. Change prompts or models only when evidence points to the provider layer.

Run both app typechecks and the relevant scan/API tests. Manually test a clear food photo, uncertain food, non-food, unavailable provider, and retry.
