# Design System

## Purpose
Document Okyo colors, typography, spacing, components, visual style, mascot/food image usage, and UX tone.

## Source Files Inspected
- `apps/mobile/src/theme/okyoTheme.ts`
- `apps/mobile/src/theme/recipeTheme.ts`
- `apps/mobile/src/components/OkyoUI.tsx`
- `apps/mobile/src/components/ScreenScaffold.tsx`
- `apps/mobile/src/components/KikoMascot.tsx`
- `apps/mobile/src/components/FoodImage.tsx`
- `apps/mobile/src/components/onboarding/OnboardingUI.tsx`
- `apps/mobile/src/navigation/MainTabs.tsx`

## Current Behavior
Okyo’s base palette is warm cream, white cards, coral, green, charcoal, muted brown-gray, and soft borders. The main tokens live in `okyoTheme.ts`: `colors`, `spacing`, `radius`, `fontSizes`, `fontFamilies`, `typography`, and `shadows`.

Typography uses Baloo 2 for display and Nunito for body/bold text. Components include screen containers, primary/secondary buttons, badge pills, stat cards, empty states, section headers, mode tabs, recipe/pack cards, Kiko mascot, food image wrappers, and onboarding-specific shells/buttons/cards.

The bottom tab bar uses a floating blurred pill and icon buttons, with a prominent camera/scan action. Icons come from `iconoir-react-native`.

UX tone is friendly, simple, and food-first. Copy should say what the user can do now, avoid technical provider language, and make uncertainty understandable.

## Important Constraints
- Keep UI mobile-friendly and avoid corporate SaaS tone.
- Use Kiko and food imagery to support the task, not as clutter.
- Hide dev/provider metadata from normal users.
- Do not make claims that AI food ID, nutrition, or cost data are exact.

## Known Risks or Edge Cases
- Some generated/design docs include more aspirational screens than current implementation.
- Large text and buttons must be tested on small screens because copy is casual and often longer.
- The palette is intentionally warm; avoid drifting into one-note beige by using coral/green/charcoal contrast.

## Related Docs
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [ONBOARDING.md](./ONBOARDING.md)
- [MOBILE_APP.md](./MOBILE_APP.md)
