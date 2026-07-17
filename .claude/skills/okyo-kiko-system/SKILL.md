---
name: Okyo Kiko System
description: Use when adding or changing Kiko mascot poses, animations, reward moments, mascot copy, emotional beats, or any screen where Kiko appears.
---

# Okyo Kiko System

## When to use this

Any task that touches Kiko: new poses, animation work, celebration/reward moments, mascot copy, onboarding emotion, or deciding whether Kiko belongs on a screen.

## Goal

Kiko is a core product feature, not decoration. Kiko carries the app's emotional layer — delight comes from the mascot, motion, and copy, not from noisy gamification (PRODUCT.md, binding).

## Personality

Cute, warm, confident. Encouraging, never clinical, never corporate, never a salesman.

- Celebrates real user wins ("Nailed it") — never fake ones.
- Reacts to what the user actually did (scanned, cooked, saved), not to fabricated stats.
- Copy is casual, hook-first, celebratory. Short sentences.
- Kiko is honest: when a scan fails, Kiko is friendly about a *real* failure — never pretends it worked.

## Implementation map

- `apps/mobile/src/components/KikoMascot.tsx` (~206 lines) — the ONLY mascot component.
  - `pose` prop maps to static PNGs via `mascotAssets` (`apps/mobile/assets/mascot/index.ts`, 14 poses, camelCase keys: default, happy, scanning, thinking, celebrating, success, cooking, groceryList, pointing, recipe, recipeCard, sideProfile, wave, waveAlt).
  - Unknown pose strings fall back safely to `default` (`getSafePose`) — never crash on a bad pose name.
  - `animated` prop: `true` (auto-picks motion from pose) or explicit motion `'idle' | 'thinking' | 'celebrate' | 'success'`.
  - Motion is subtle by design: translateY ≤ 8px, scale ≤ 1.035, always `useNativeDriver: true`.
  - **Reduce Motion is binding**: component checks `AccessibilityInfo.isReduceMotionEnabled` and renders static. Never bypass this.
- `apps/mobile/assets/animations/` — GIF/MP4 pack (scanning, cooking-stir, cooking-sauté, cutting, grocery-bag, success-celebration) + `animation_manifest.json`. Made on branch `kiko-animation-pack-v2`; mostly not yet wired into screens — check usage before assuming.
- Kiko appears today on ~13 screens + onboarding: Welcome, Scan, AnalysisLoading, ResultSummary (via handoff), RecipeDetail (tip block), GroceryList, Library, Profile, KitchenLetter, SavingsDashboard, Paywall, Home, ShareCardPreview, OnboardingUI.

## Reward-moment map (where Kiko earns his keep)

| Moment | Pose/motion | Rule |
|---|---|---|
| Scan in progress | `scanning` / thinking motion | keeps waiting warm, sets expectation |
| Result success | `celebrating` / celebrate | one burst, not a loop |
| Recipe saved / grocery done | `happy` / success | quiet, quick |
| Challenge completed | `celebrating` | biggest celebration in the app |
| Scan failure | `thinking` or `default` | sympathetic, invites retry, never blames |
| Onboarding | `wave` / `pointing` | guide, not tour bus |
| Paywall | `default` / calm | **Kiko never pressures a purchase** |

## Things Kiko must never become

- **Clippy** — never interrupts a task, never blocks UI, never modal-spams.
- **A guilt engine** — no sad Kiko for broken streaks, skipped days, or low cooking ratings. Encourage, don't shame.
- **A casino host** — no coin rain, spin wheels, countdown pressure (PRODUCT.md anti-references).
- **A liar** — never celebrates fake data, mock results, or unearned rewards.
- **A salesman** — never the face of urgency pricing or dark-pattern upsells.
- **Wallpaper** — if a screen doesn't have an emotional beat, Kiko doesn't need to be on it.

## Adding a new pose or animation

1. Follow the design-first asset workflow (CLAUDE.md): generate art with Draw Things or ComfyUI, matching the existing mascot style (see `apps/mobile/assets/mascot/README.md`).
2. Add the PNG to `apps/mobile/assets/mascot/`, register it in `index.ts` — `KikoMascotPose` is derived from `mascotAssets` keys, so the type updates automatically.
3. Keep transparent backgrounds; source cuts live in `kiko_transparent_backgrounds_careful/`.
4. Never improvise Kiko with gradients, emoji, or placeholder blobs.

## Verification

- `cd apps/mobile && npx tsc --noEmit`
- Test with iOS Reduce Motion ON (Settings → Accessibility) — mascot must render static.
- Check the moment in the simulator: a celebration should feel like a wink, not a slot machine.
