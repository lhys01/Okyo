# Okyo design system

This is the current design reference. `PRODUCT.md` defines the binding product taste and anti-references; code tokens remain the source of truth for exact values.

## Sources of truth

- `apps/mobile/src/theme/okyoTheme.ts`: colors, spacing, radii, typography, surfaces, shadows, and layout constants.
- `apps/mobile/src/theme/recipeTheme.ts`: recipe-specific extensions.
- `apps/mobile/src/components/OkyoUI.tsx`: shared controls and feedback components.
- `apps/mobile/src/components/KikoMascot.tsx`: the only Kiko rendering component.

Do not create a second token source or re-export theme tokens from `OkyoUI.tsx`. Prefer existing components and tokens before adding screen-local variants.

## Visual language

- Canvas: warm ivory background.
- Content: soft white cards or quiet panels with hairline borders and restrained shadows.
- Glass: floating chrome such as tab bars, headers, and sheets only. Do not place blur behind long scrolling content.
- Display type: Baloo 2. Body type: Nunito.
- Kiko carries emotion at real moments—waiting, uncertainty, success, cooking, and empty states—not as wallpaper.

The scan action should dominate the first session. A screen should have one emotional job and one primary action. Savings and cost values are estimates and remain subordinate to the food outcome.

## Accessibility and resilient text

- Minimum touch target: 44 pt.
- Body contrast: at least 4.5:1; large text: at least 3:1.
- Respect Reduce Motion for mascot and reward animation.
- Do not block font scaling except where the floating tab bar requires a fixed treatment.
- Use `minHeight`, flexible rows, and `flexShrink` for text containers. Avoid fixed heights around user/model text.
- Never apply `overflow: hidden` directly to text to solve layout problems.
- Keep display line heights generous enough for Baloo 2; test long AI content and 200% text.

These text rules preserve the useful conclusions from the prior rendering audits without retaining point-in-time reports that described deleted screens.

## Onboarding

Current onboarding is deliberately short: Kiko-led hero → real scan → honest loading → first result. The activation moment is the first successful result, not a questionnaire or simulated plan-building step.

Future personalization should be requested after value is demonstrated or collected progressively. A real paywall must never precede the first result.

## Assets

- Approved Kiko poses live under `apps/mobile/assets/mascot/` and are registered through its index.
- Per-step Kiko recipe art is runtime-mapped and must be inventory-tested.
- `apps/mobile/assets/food/recipes/` is a retained, non-bundled source pool for a possible curated discovery experience.
- Generated mockups and screenshots are references only when explicitly curated. Do not commit runtime outputs or duplicate asset cuts.

When adding original artwork, document provenance and intended use. Do not replace approved artwork with emoji, ad-hoc gradients, or nested-view illustrations.
