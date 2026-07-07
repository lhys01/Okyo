---
name: Okyo Design System
description: Use when polishing UI, redesigning screens, fixing ugly or data-heavy layouts, adding new visual components, or making Okyo feel more premium, warm, and iOS-native.
---

# Okyo Design System

## When to use this

Any task that changes how a screen or component looks: polish passes, redesigns, new cards, fixing "hackathon UI", spacing/typography work.

## Goal

Ship UI that reads as warm-premium Apple quality using ONLY existing tokens, so every screen shares one card language, one button hierarchy, one glass vocabulary.

## Okyo product context

Okyo is an AI food companion, not a calorie tracker, not a generic recipe app, and not a meal planner. It should feel helpful, premium, magical, emotionally rewarding, and easy. Kiko the fox mascot carries the emotion; delight comes from mascot, motion, and copy — not noisy gamification.

## Files to inspect first

- `apps/mobile/src/theme/okyoTheme.ts` — the ONLY source of design tokens (colors, spacing, radius, typography, shadows, surfaces, layout). Read the header comment; it is binding.
- `apps/mobile/src/components/OkyoUI.tsx` — shared components. Must NOT re-export theme tokens (past crash came from dual-source pattern).
- `apps/mobile/src/components/ScreenScaffold.tsx` — screen wrapper.
- `PRODUCT.md` — design principles + anti-references (binding).
- `apps/mobile/src/theme/recipeTheme.ts` — recipe-specific theming.
- The target screen(s) in `apps/mobile/src/screens/` (21 screens).
- `docs/wiki/DESIGN_SYSTEM.md` and `docs/OKYO_UI_REDESIGN_V2.md` for background.

## Safe commands

- Typecheck mobile: `cd apps/mobile && npx tsc --noEmit`
- Run app: `cd apps/mobile && npm run sim` (Expo, port 8082, clears cache)
- Diff check: `git diff --stat apps/mobile/src`

## Exact workflow

0. For redesigns of existing screens, check `docs/design/` prior audits first (`SCREEN_BY_SCREEN_AUDIT.md`, `DESIGN_VIOLATIONS.md`, `CARD_INVENTORY.md`) — the screen may already have documented violations and an agreed direction.
1. Read `PRODUCT.md` anti-references and `okyoTheme.ts` in full.
2. Read the target screen. List every hardcoded hex, number padding, or ad-hoc shadow you find.
3. Replace ad-hoc values with tokens: `colors.*`, `spacing.*`, `radius.*`, `typography.*` (spread presets: `{ ...typography.title }`), `shadows.*`, `surfaces.card`/`panel`/`tint`, `layout.scrollClearance` (140, keeps content clear of floating tab bar), `layout.screenGutter`.
4. Respect the three-layer material language: **canvas** (warm ivory bg) → **card** (soft white + hairline border + soft shadow) → **glass** (translucent + blur, floating chrome ONLY: tab bar, floating headers, sheets). Scrolling content never blurs.
5. Fonts: display = Baloo2_800ExtraBold, body = Nunito. No new fonts.
6. Numbers shown to users are estimates — present warmly, never as spreadsheet cells or false precision. Savings display must be gated on `userRestaurantPrice` (user-entered, in `useOkyoStore.ts`).
7. Typecheck. Report per screen what changed.

## Quality bar

- Zero new inline hex values or magic paddings; everything traces to `okyoTheme.ts`.
- Hierarchy from weight and color, not uppercase tracking (old eyebrow style was removed deliberately).
- WCAG AA: body text ≥4.5:1 (use `colors.muted` for readable captions, `mutedSoft` only decorative), touch targets ≥44pt, Reduce Motion respected for celebration animation.
- Screen looks like the other polished screens (HomeScreen, ResultSummaryScreen are good references).

## Bad patterns to avoid

- New hex values, one-off shadows, or padding constants outside the theme.
- Re-exporting tokens from `OkyoUI.tsx` (caused a runtime crash before; single-source rule is in the theme header).
- Anti-references from PRODUCT.md: MyFitnessPal data grids, crypto/SaaS hero-metric dashboards, gradient stat walls, casino gamification (spin wheels, coin rain, countdowns), sparkle-purple "AI magic" clichés, raw text dumps / developer labels.
- Fake metrics or decorative progress bars (rarity, streak strength bars were deliberately deleted from Share Card July 2026 — do not reintroduce).
- Blur/glass on scrolling content.
- Big rewrites of screens that only needed token substitution.

## Example final output

> Polished `GroceryListScreen.tsx`. Replaced 6 inline hex values with `colors.cream`/`colors.border`, converted row cards to `surfaces.panel` + `shadows.soft`, switched section headers to `typography.heading`, bottom padding now `layout.scrollClearance`. No layout restructure. Mobile typecheck clean. Test: open Saved → grocery list, verify rows read as soft panels and tab bar never covers last row.

## Done checklist

- [ ] No new hardcoded colors/spacing/shadows
- [ ] Three-layer material language respected (no blur on content)
- [ ] No PRODUCT.md anti-reference introduced
- [ ] `npx tsc --noEmit` clean in `apps/mobile`
- [ ] Reported files changed + what to look at in simulator
