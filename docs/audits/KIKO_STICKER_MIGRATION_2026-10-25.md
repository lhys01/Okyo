# Approved Kiko sticker migration — 2026-10-25

Implemented in the user-selected checkout, `/Users/rober/Desktop/Okyo-1`.

The user approved all 21 generated redraws and explicitly selected the second welcome composition, reattaching the happy waving fox with carrot at top-left and mushroom at top-right. The installed welcome PNG is pixel-identical to that attachment. The generated exports are retained exactly, without rescaling, recoloring, or regenerating the approved art.

## Changes

- Replaced 22 active sticker PNG files with the approved family. Shared file paths update their existing onboarding, Home, recipe, grocery, sign-in, fallback, and mascot consumers.
- Added `apps/mobile/assets/onboarding-v3/stickers/fox-dumbbell-curl.png` and updated the Hit My Macros goal card in `PersonalizedOnboardingScreen.tsx` to use it. The shared fitness/flex source also uses the approved dumbbell curl.
- The same soup redraw replaces the duplicated active soup and neutral companion sources.
- Updated the transparent pose registry's provenance comment and review package approval status.
- Original carrot, drink, and questioning references retain their pre-install hashes. Official green app icon and green launch artwork also retain their pre-install hashes. Inactive historical PNGs are retained.

## Installed mapping

| Approved redraw | Active destination |
| --- | --- |
| 01-welcome-floating-food | `apps/mobile/assets/onboarding-v3/welcome.png` |
| 02-paw-raised | `apps/mobile/assets/kiko-transparent/kiko-paw-raised-sticker.png` |
| 03-surprised | `apps/mobile/assets/kiko-transparent/kiko-sitting-front-sticker.png` |
| 04-yawning | `apps/mobile/assets/kiko-transparent/kiko-thoughtful-sticker.png` |
| 05-drowsy | `apps/mobile/assets/kiko-transparent/kiko-curious-sticker.png` |
| 06-macros-dumbbell-curl | `apps/mobile/assets/onboarding-v3/stickers/fox-dumbbell-curl.png` |
| 06-macros-dumbbell-curl | `apps/mobile/assets/kiko-static/approved/kiko-flex-sticker.png` |
| 07-balanced-meal | `apps/mobile/assets/kiko-transparent/kiko-holding-bowl-sticker.png` |
| 08-celebrating | `apps/mobile/assets/kiko-transparent/kiko-cheer-sticker.png` |
| 09-seated-three-quarter | `apps/mobile/assets/kiko-transparent/kiko-sitting-side-sticker.png` |
| 10-standing-ready | `apps/mobile/assets/kiko-transparent/kiko-standing-ready-sticker.png` |
| 11-paper-grocery-bag | `apps/mobile/assets/kiko-static/approved/kiko-grocery-bag-sticker.png` |
| 12-grocery-checklist | `apps/mobile/assets/kiko-static/approved/kiko-grocery-list-sticker.png` |
| 13-reusable-grocery-tote | `apps/mobile/assets/kiko-static/approved/kiko-grocery-tote-sticker.png` |
| 14-warm-soup | `apps/mobile/assets/kiko-static/approved/kiko-soup-sticker.png` |
| 14-warm-soup | `apps/mobile/assets/kiko-static/approved/kiko-neutral-transparent-sticker.png` |
| 15-produce-crate | `apps/mobile/assets/kiko-static/approved/kiko-produce-crate-sticker.png` |
| 16-ramen | `apps/mobile/assets/kiko-static/approved/kiko-ramen-sticker.png` |
| 17-recipe-card | `apps/mobile/assets/kiko-static/approved/kiko-recipe-sticker.png` |
| 18-savings | `apps/mobile/assets/kiko-static/approved/kiko-savings-sticker.png` |
| 19-shopping-cart | `apps/mobile/assets/kiko-static/approved/kiko-shopping-cart-sticker.png` |
| 20-thinking-about-food | `apps/mobile/assets/kiko-static/approved/kiko-thinking-sticker.png` |
| 21-vegetable-hug | `apps/mobile/assets/kiko-static/approved/kiko-vegetables-sticker.png` |

## Validation

- `npm run typecheck`: pass.
- `npm run validate-assets`: pass; 341 static image references and 433 image files.
- `npm run icons:check`: pass; native/icon derivatives remain current.
- All 23 installed PNG destinations decode as RGBA with transparent pixels and match their approved source bytes (21 unique redraws).
- `git diff --check` for edited application text: pass.
- Expo iOS production export completed (4362 modules, 245 asset files). For device review, rebundled the existing compiled native Release simulator app, sealed it with an ad hoc code signature, verified the signature, and installed it on the task-owned iPhone 17 Pro simulator `06D47E3D-7416-4A9A-B101-16E6C741A420`. No native code changed and no full native recompilation was necessary.
- Simulator visual checks passed for the selected floating-food introduction, raised-paw fox naming screen, and Hit My Macros dumbbell goal card. All fit their existing contain-based layouts without clipping. Back navigation was exercised through the existing screens. Other QA simulators were left untouched.
- Existing onboarding visual/branch tests: 20 passed, 4 failed. Running the same tests against a separate fixture using the pre-install application source reproduces the identical four failures: Savings route progress, Macros completion, opening hero artwork source assertion, and MCQ scroll-shell assertion. These failures predate this image migration; unrelated behavior and tests were not changed.

## Evidence and rollback

Approved source package: `output/kiko-sticker-review-2026-10-25/`, including full generation provenance in `manifest.json` and individual final PNGs.

Local evidence: `apps/mobile/.artifacts/kiko-sticker-install-2026-10-25/` contains before hashes, backups of overwritten PNGs and edited application text, installed-image validation, baseline test comparison and logs, signed simulator artifact, and screenshots:

- `fox-introduction.png`
- `fox-naming.png`
- `goal-cards.png`

## Manual review

Open the updated app and review the virtual-assistant introduction, fox naming, Hit My Macros option, savings reactions, sleepy/yawning branch art, and shared Home/recipe/grocery companions. Restart the development server or rebuild an installed app if it still displays an older cached bundle. No commit, push, or release distribution was performed.
