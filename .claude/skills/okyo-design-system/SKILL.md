---
name: okyo-design-system
description: Apply Okyo's warm premium visual language when changing mobile UI, components, typography, spacing, materials, accessibility, onboarding, or screen polish.
---

# Okyo design system

Read `PRODUCT.md`, `docs/DESIGN_SYSTEM.md`, and the target screen before editing.

## Use existing sources

- Take exact tokens from `apps/mobile/src/theme/okyoTheme.ts`.
- Use `recipeTheme.ts` only for recipe-specific extensions.
- Reuse `OkyoUI.tsx`, `ScreenScaffold.tsx`, and current screen patterns.
- Keep Kiko in `KikoMascot.tsx`; never improvise mascot art.
- Do not create a second token source or re-export tokens from `OkyoUI.tsx`.

## Design in this order

1. Name the screen's emotional job.
2. Remove claims or data the product cannot support.
3. Choose one dominant action.
4. Keep secondary information quiet.
5. Apply canvas → card/panel → floating glass deliberately.
6. Replace hardcoded visual values with tokens.

Keep scan prominent, numbers honest, Kiko purposeful, and content food-focused. Avoid calorie dashboards, SaaS stat walls, casino rewards, generic AI gradients, and raw model output.

## Validate resilience

- Use 44 pt touch targets and WCAG AA contrast.
- Respect Reduce Motion.
- Use flexible text containers and `minHeight`; avoid clipping AI/user text.
- Test 200% text, long recipe content, a small phone, and keyboard overlap.
- Run the mobile typecheck and an Expo export after material changes.
