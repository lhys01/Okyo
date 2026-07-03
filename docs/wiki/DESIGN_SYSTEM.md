# Design System

## Purpose
Documents Okyo's design tokens, components, and UX tone.

## Source Files Inspected
`apps/mobile/src/theme/okyoTheme.ts`, `apps/mobile/src/theme/recipeTheme.ts`, `apps/mobile/src/components/OkyoUI.tsx`, `apps/mobile/src/components/KikoMascot.tsx`, `apps/mobile/src/components/FoodImage.tsx`, `apps/mobile/src/components/onboarding/OnboardingUI.tsx`, `apps/mobile/assets/mascot/index.ts`.

## Current Behavior

### Tokens (`okyoTheme.ts`)
- **Colors:** warm cream background `#faf7f0`, cream panels `#f6efe2`/`#eadfcb`, coral primary `#e9552f` (dark `#c2401f`, soft `#fdeee7`), green accent `#1d7a4d` (soft `#e9f5ee`), charcoal text `#1c1813`, body `#575047`, muted `#8e867b`, border `#efe8db`, danger `#a33524`.
- **Typography:** display font `Baloo2_800ExtraBold` (rounded, friendly), body `Nunito_400Regular`/`700Bold`/`800ExtraBold`. Presets: display 40/50, title 28/36, heading 20/26, body 16/24, caption 13/18.
- **Spacing:** screen 24, section 36, card 20.
- **Radius:** hero 32, card 24, panel 20, button/pill 999 (fully rounded).
- **Shadows:** soft warm-tinted (`#4a3a28`) card and hero elevations.

### Components
- `OkyoUI.tsx` re-exports tokens and shared primitives (`ScreenScaffold` for screen chrome, cards, buttons).
- `KikoMascot` — the mascot; carries emotion/reactions across onboarding and empty states.
- `FoodImage` — food imagery with category fallbacks ([IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)).
- `onboarding/OnboardingUI.tsx` — onboarding-specific shells, stateful buttons, speech bubbles, and its own `onboardingColors` accent set.

### Visual style & UX tone
Cute, clean, warm, food-first. Rounded everything, cream surfaces, coral CTAs. Copy is friendly and casual — celebratory ("Nailed it"), never clinical or corporate. Kiko gives the app personality; food photos give it appetite appeal. Honest states: loading, empty, and error states are designed, not afterthoughts.

## Important Constraints
- Consume tokens from `okyoTheme.ts` / `OkyoUI.tsx` — no hardcoded hex values in screens.
- Match existing patterns before inventing new components.
- Keep UI mobile-first; test on the iOS Simulator.

## Known Risks / Edge Cases
- Two color sources exist (`colors` + `onboardingColors`) — check both before adding a third.
- `recipeTheme.ts` styles recipe surfaces separately; keep it aligned with core tokens.

## Related Docs
[MOBILE_APP.md](./MOBILE_APP.md) · [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md) · [ONBOARDING.md](./ONBOARDING.md) · legacy [UX_COPY.md](./UX_COPY.md)
