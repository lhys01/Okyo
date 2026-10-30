# Full image-asset audit

Audited 2026-09-17 from the active worktree. This document records the asset
resolution system as it existed before the category fallback repair.

## Root cause

`src/components/ResilientImage.tsx` had a global default fallback set to
`foodAssets.bowl`, whose literal source is
`assets/food/recipes/garlic-chicken-rice-bowl.png`. That 800×600 food photo has
SHA-256 `4ca04e4eb2ded13c6707dfe0d46fc5cfd43f06d5c88b7f7cd4bdb7bdd68cf5aa`.
Every `ResilientImage` instance with a missing or failed source and no explicit
fallback therefore became that rice bowl, regardless of its intended role.

The worktree also contained unresolved merge markers in `FoodImage.tsx`, which
blocked TypeScript and Metro from building a stable runtime. These are resolver
defects, not evidence of a Metro cache collision.

## Evidence

- 324 literal image `require()` references resolve to existing files.
- The food fallback, Kiko chef sticker, breakfast meal icon, and sun feature
  icon have distinct SHA-256 hashes and dimensions.
- Static local paths are literal Metro-compatible imports; no dynamic
  `require()` path was found.
- The checked Expo and Babel configuration has no custom asset resolver; no
  app-local Metro configuration overrides Expo defaults.
- The 64 converted recipe images are confined to `assets/food/recipes`; no
  non-food asset bytes were replaced by them.

## Asset inventory

| Logical asset group | Expected type | Expected file pattern | Actual resolved source | Fallback before repair | Correct before repair |
| --- | --- | --- | --- | --- | --- |
| Recipe cards, scan results, food library | Recipe/food photography | `assets/food/recipes/*` | Static `recipeAssets` or validated remote URI | Garlic chicken-and-rice photo | Yes, within food-only surfaces |
| Kiko mascot | Kiko/fox mascot artwork | `assets/kiko-static/approved/kiko-*.png` | Static Kiko registries | Garlic chicken-and-rice photo when routed through resolver | No |
| Onboarding mascot and illustration | Onboarding illustration | `assets/onboarding-v3/stickers/*`, `assets/onboarding-v3/*` | `onboardingV3Assets` literals | Garlic chicken-and-rice photo when routed through resolver | No |
| Meal choice icons | Meal icon | `assets/onboarding-v3/meal-icons/*` | `onboardingV3Assets.icon*` literals | Garlic chicken-and-rice photo when routed through resolver | No |
| Feature/priority icons | Feature icon | `assets/onboarding-v3/iconsnew/*` | `onboardingStickerIcons` literals | Garlic chicken-and-rice photo when routed through resolver | No |
| Grocery and Liked empty states | Empty-state artwork | Approved Kiko static art | Literal static imports | No centralized category fallback | Incomplete |
| Guided tour coach art | Guided-tour artwork | `assets/onboarding-v3/stickers/*` | Literal static imports | No centralized category fallback | Incomplete |
| App icon/launch art | App icon/launch artwork | `assets/app-icon/icon.png`, splash artwork | Expo config literals | No centralized category fallback | Incomplete |
| Decorative stickers | Decorative image | Onboarding sticker assets | Literal static imports | Garlic chicken-and-rice photo when routed through resolver | No |

## Repair strategy

`imageAssetFallbacks.ts` defines explicit `food`, `mascot`, `icon`,
`onboarding`, `emptyState`, `tour`, `appIcon`, and `decorative` categories with
distinct bundled fallbacks. `FoodImage` explicitly declares `food`; Kiko and
onboarding icon wrappers declare `mascot` and `icon`. A non-food category can no
longer default to a food photograph. Development-only diagnostics record source,
asset kind, component, fallback kind, and platform whenever an image fails.

## Scope and limitations

Existing direct static `<Image>` imports remain unchanged because their
literal assets exist and already resolve through Metro. The shared wrappers now
cover the dynamic/failed-image paths without changing image geometry, content
fit, copy, navigation, or layouts. Runtime route verification is recorded
separately after a successful Metro build.
