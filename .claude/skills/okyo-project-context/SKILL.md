---
name: Okyo Project Context
description: Use when working on Okyo product direction, UX copy, feature scope, onboarding, scan flow, saved recipes, groceries, savings, share cards, or app personality.
---

# Okyo Project Context

Use this skill to keep product work aligned with Okyo.

## Product Definition

Okyo is a mobile cooking app that helps users scan restaurant food, generate copycat-style or inspired-by recipes, estimate savings, save recipes, make grocery lists, and make cooking feel easier and more fun.

Okyo should feel cute, clean, simple, friendly, modern, food-focused, not corporate, and not overly complicated.

## Product Priorities

- Fast onboarding
- Simple scan flow
- Recipe generation
- Saved recipes
- Grocery list features
- Friendly UI copy
- Smooth mobile experience
- Viral/shareable moments when possible
- Honest AI behavior

## User Experience Rules

- Keep the first user session fast: open app, scan meal, see result.
- Build complete, mobile-friendly flows with loading, empty, and error states when relevant.
- Keep workflows simple and intuitive.
- Match the existing app style before inventing new patterns.
- Avoid complex social feeds, comments, DMs, or maps unless explicitly requested.
- Use feature flags for paid or premium features when possible.

## Marketing And Copy

Okyo copy should be:

- hook-first
- TikTok-native
- casual
- curiosity-driven
- focused on saving money, recreating restaurant food, or not knowing what to cook

## Design Taste (binding)

`PRODUCT.md` at repo root defines design principles and anti-references. Short version: scan is the hero; warm premium, Apple-quality; honest numbers (savings gated on user-entered restaurant price); Kiko the fox is the emotional layer; few patterns repeated well. Never: calorie-tracker data grids, SaaS stat walls, casino gamification, sparkle-purple AI clichés, raw text dumps.

## Onboarding Reference Assets

When working on onboarding, the material lives in three places:

- `docs/wiki/ONBOARDING.md` — current flow (redesigned June 2026: 7 steps, hero screen, Kiko reactions, trial paywall).
- `docs/design/OKYO_ONBOARDING_PHILOSOPHY.md` + `docs/design/ONBOARDING_AUDIT.md` — rationale and past audit.
- `apps/mobile/assets/BitePal iOS Onboarding/` (18 PNGs) and `docs/design/okyo_onboarding_0*.png` + `docs/design/generate_onboarding.py` — visual references and mock generator.

Monetization/paywall context: `docs/wiki/MONETIZATION.md`, `apps/mobile/src/screens/PaywallScreen.tsx`, `docs/design/ACTIVATION_STRATEGY.md`.

## Reference Files

Read these only when needed:

- `PRODUCT.md` for design principles and anti-references.
- `docs/wiki/PRD_SUMMARY.md` for product scope.
- `docs/wiki/USER_FLOWS.md` for app flows.
- `docs/wiki/UX_COPY.md` for copy direction.
- `docs/seed/OKYO_MASTER_ONE_NOTE.md` for founder-style product context.
- `docs/seed/VIRAL_HOOKS.md` for marketing hooks.

## Honesty Rules (non-negotiable)

Okyo is an AI food companion, not a calorie tracker, not a generic recipe app, not a meal planner. No fake stats, fake prices, fake savings, fake streaks, fake people, or fake social proof — ever, including in copy, mockups, and share cards. Savings shown only when the user entered a restaurant price. Real scan failures get friendly honest errors, never mock results.

## Example Final Output

> Rewrote empty-state copy for LibraryScreen ("Saved"). Old: "No data available." New: "Your saved dishes live here. Scan something delicious to start." — hook-first, warm, no developer language. Matches UX_COPY.md tone. No layout or code-path changes beyond the string. Mobile typecheck clean. Test: fresh install → Saved tab shows new copy with Kiko illustration.

## Done Checklist

- [ ] Change consistent with PRODUCT.md principles + anti-references
- [ ] No calorie-tracker, meal-planner, or social-feed scope creep
- [ ] Copy is casual, hook-first, honest — no fake numbers or urgency
- [ ] Reported: files changed, what to look at, manual test steps
