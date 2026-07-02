# Screen-by-Screen Audit — Okyo Mobile Card Removal

**Date:** 2026-06-18  
**Auditor:** Hostile Review  

---

## Core Content Screens (Should be Cardless)

### HomeScreen ✓ PASS
- **Hero section:** borderRadius + overflow (image clip only), no bg shadow
- **Timeline:** flat content, no card bg/shadow
- **Empty state:** flat, no white panel
- **Discover prompt:** flat, intentional orange icon bg
- **Verdict:** All content sits directly on cream background

### LibraryScreen ⚠ NEEDS REVIEW
- **Hero card:** flat content container ✓
- **Search box:** white bg KEPT (text input affordance) ✓, shadow REMOVED ✓
- **Filter chips:** cream bg ✓
- **Recipe cards:** flat grid cards ✓
- **Verdict:** PASS with note: searchBox is functional input, not content card

### RecipeDetailScreen (main) ✓ PASS
- **Overview panel:** flat content, no white bg/shadow ✓
- **Quick stats:** cream pills, no card wrapper ✓
- **Ingredient groups:** flat, no card bg ✓
- **Info panel:** flat content ✓
- **Savings card:** green accent (GROUP B) ✓
- **Verdict:** All content flat

### RecipeDetailScreen (guided cooking) ⚠ POTENTIAL ISSUE
- **Guided header:** no white bg/shadow ✓
- **Guided step card:** no white bg/shadow, flat flex container ✓
- **Guided nav buttons:** cream bg (changed from white) ✓
- **Tip panel:** cream bg (changed from white) ✓
- **Completion card:** no white bg/shadow ✓
- **Steps section:** flat cards ✓
- **Issue card:** no white bg/shadow ✓
- **Verdict:** PASS (all content flat or intentional)

### ResultSummaryScreen ⚠ COMPLEX SCREEN — DETAILED AUDIT
- **Confirm card:** flat, no white bg ✓
- **Food image card:** cream bg (image container, not card), no shadow ✓
- **Scan again button:** white bg KEPT (nav overlay, tiny button) ✓
- **Settings button:** white bg KEPT (nav overlay, tiny button) ✓
- **Inspired pill:** white bg KEPT (label overlay on image) ✓
- **Dish name input:** white bg KEPT (text input) ✓
- **Price input:** white bg KEPT (number input) ✓
- **Mode tab selected:** white bg KEPT (selected indicator pill) ✓
- **Standalone scan preview:** cream bg (image container), no shadow ✓
- **Failure/error cards:** flat, no white bg/shadow ✓
- **Verdict:** PASS (all remaining white is functional: inputs, nav, overlays)

### GroceryListScreen ✓ PASS
- **Saved recipe card section:** flat content ✓
- **Category cards:** no white bg/shadow, overflow:hidden kept for section clip ✓
- **Tab buttons:** cream bg (changed from white) ✓
- **Empty tab card:** no white bg/shadow ✓
- **All set card:** flat, no white bg/shadow ✓
- **Issue card:** no white bg/shadow ✓
- **Back button:** white bg KEPT (nav affordance) ✓
- **Verdict:** All content flat

### SavingsDashboardScreen ✓ PASS
- **Biggest card section:** flat content, no white bg ✓
- **Period tabs:** cream bg (changed from white) ✓
- **Period empty card:** flat content ✓
- **Stat tiles:** no white bg/shadow ✓
- **Goal cards:** cream accent (GROUP B) ✓
- **Recent transactions:** flat, no white bg ✓
- **Empty card:** no white bg/shadow ✓
- **Verdict:** All content flat, period tabs properly changed to cream

### ProfileScreen ✓ PASS
- **Header card:** flat, no white bg/shadow ✓
- **Progress card:** flat content ✓
- **Stat cards:** no white bg/shadow, flat grid ✓
- **Menu section:** flat, no white bg/shadow ✓
- **Verdict:** All content flat

### RankingsScreen ✓ PASS
- **XP card:** flat (spreads from modified sharedStyles.card) ✓
- **Badge grid:** flat cards, no white bg ✓
- **Leaderboard section:** flat content ✓
- **Verdict:** All content flat

### GoalScreen ✓ PASS
- **Goal buttons:** cream bg explicitly set ✓
- **Verdict:** All buttons have proper affordance bg, no shadows

### SettingsScreen ✓ PASS
- **Sections:** flat content (spreads from modified sharedStyles.card) ✓
- **Menu rows:** flat, no white bg/shadow ✓
- **Verdict:** All content flat

### RestaurantPackDetailScreen ✓ PASS
- **Summary card:** flat (spreads from modified sharedStyles.card) ✓
- **Dish cards:** flat content ✓
- **Verdict:** All content flat

### KitchenLetterScreen ⚠ **VIOLATION FOUND**
- **Hero card:** cream bg, flat ✓
- **Perks section:** flat, no white bg/shadow ✓
- **Close button:** WHITE BG KEPT ✓ + **SHADOW STILL PRESENT** ✗
  - Line 119: `...shadows.card` still applied
  - This is inconsistent with design goal: "No unnecessary shadows remain"
  - Other nav buttons (GroceryScreen backButton) don't have shadows
- **Verdict:** VIOLATION — closeButton has unnecessary shadow spread

### DupeChallengeScreen ✓ PASS
- **Summary card:** flat (spreads from modified sharedStyles.card) ✓
- **Rating card:** flat (spreads from modified sharedStyles.card) ✓
- **Verdict:** All content flat

---

## Skipped Screens (Correct per user instruction)

### ScanScreen — Explicitly Untouched
- Status: Modified in PRE-EXISTING commit (commit a5d565f)
- Not touched in this session ✓

### WelcomeScreen — Explicitly Untouched
- Status: Modified in PRE-EXISTING commit (commit a5d565f)
- Not touched in this session ✓

### PaywallScreen — Explicitly Skipped
- Pricing tier cards are standard UX
- RevenueCat integration untouched ✓

### ShareCardPreviewScreen — Intentional Export Card
- IS a visual card by design ✓
- Modified in PRE-EXISTING commit (image logic), not this session ✓

### OnboardingUI — Explicitly Skipped
- Onboarding color system intact ✓

---

## Component Audit

### OkyoUI.tsx

**sharedStyles.card** (line 248-251):
- ✓ backgroundColor removed
- ✓ Shadows removed
- ✓ borderRadius + padding retained
- Result: Spreads safely to 11 screens (GoalScreen, ScreenScaffold, SettingsScreen, RankingsScreen×3, DupeChallengeScreen×2, RestaurantPackDetailScreen×2)

**sharedStyles.secondaryButton** (line 324-329):
- ✓ backgroundColor: colors.card → colors.cream
- ✓ Shadows removed
- Result: All secondary buttons now cream with no shadow

**sharedStyles.statCard** (line 376-381):
- ✓ backgroundColor removed
- ✓ Shadows removed
- Result: Stat cards now flat

### RecommendationCard.tsx (line 41-46)
- ✓ backgroundColor removed
- ✓ Shadows removed
- ✓ borderRadius + overflow:hidden kept (image clipping)
- Result: Discovery cards flat with image clips intact

### ScreenScaffold.tsx (line 54)
- Spreads from sharedStyles.card (now safe)
- Adds custom padding override ✓
- Result: Flat content wrapper

### MainTabs.tsx
- Navigation bar shadows INTENTIONAL (GROUP B) ✓
- Tab chrome shadows kept
- Hidden tab bar on RecipeStepsScreen (pre-existing feature)

### FoodImage.tsx
- fallbackIcon has white bg + border (GROUP B, button-like) ✓
- No shadows

---

## Summary by Category

| Category | Count | Status |
|---|---|---|
| Screens fully cardless | 12 | ✓ PASS |
| Screens with intentional white (inputs, overlays, nav) | 2 | ⚠ PASS WITH NOTES |
| Screens with violations | 1 | ✗ VIOLATION |
| Screens skipped (correct) | 5 | ✓ CORRECT |

**Violations Found:** 1
- KitchenLetterScreen.tsx closeButton has unnecessary shadow spread

**Verdict:** ACCEPTED WITH 1 VIOLATION — closeButton shadow must be removed
