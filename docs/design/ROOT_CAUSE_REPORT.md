# Root Cause Report — Text Rendering Issues
**Date:** 2026-06-18  
**Auditor:** Hostile Staff Engineer  

---

## Root Cause 1: overflow:hidden Applied Directly to Text Nodes (HIGH)

**Files:** RecipeDetailScreen.tsx (flavorChip, guidedTimeChip, guidedChip)

**Cause:** Developers applied `overflow: 'hidden'` to `<Text>` components to achieve a pill/chip visual with `borderRadius` and `backgroundColor`. This pattern is used to clip the background fill to the rounded corner shape. However, in React Native `overflow: 'hidden'` on a Text node is unreliable across platforms — on Android at large accessibility font sizes, it can clip the rendered glyph content, not just the background.

**Correct pattern:** Pill shapes should use a `<View>` wrapper with `overflow: 'hidden'`, `borderRadius`, and `backgroundColor`. The inner `<Text>` carries only typography styles. This confines the overflow clipping to the View layer (which clips background only at the border-radius) without touching the text rendering pipeline.

---

## Root Cause 2: Fixed `height` on Navigation Bars Containing Text (HIGH)

**Files:** RecipeDetailScreen simpleTopBar (56), ResultSummaryScreen topBar (60), AnalysisLoadingScreen topBar (64), GroceryListScreen topBar (66), OnboardingUI button (58), OnboardingUI scanSecondaryAction (54)

**Cause:** Top bars and buttons were given fixed `height` values. This is correct for visual consistency at 1× font scale but breaks at large iOS Dynamic Type or Android font scale. When the system font scale exceeds 1.0×, text renders larger — the text height exceeds the fixed container height and the bottom of glyphs is clipped.

**Correct pattern:** Use `minHeight` instead of `height`. `minHeight` sets the floor and allows the container to grow at large font scales. Visually identical at 1× scale.

---

## Root Cause 3: Typography lineHeight Too Tight for Baloo2 Display Font (MEDIUM)

**File:** apps/mobile/src/theme/okyoTheme.ts

**Cause:** The `typography.display` preset uses `fontSize: 40, lineHeight: 46` — a ratio of 1.15. The safe minimum for text that will be rendered at system font scale is 1.2×. For Baloo2 (a display font with tall cap height and deep descenders), 1.15× is insufficient. At large Dynamic Type, the scaled lineHeight may not accommodate the full glyph height, clipping ascenders on capital letters.

**Affected styles:** `display` (40/46 = 1.15×), `title` (28/34 = 1.21×, borderline)

**Correct pattern:** Minimum lineHeight of `fontSize × 1.25` for display fonts. This gives comfortable headroom at normal scale and remains safe at scaled sizes.

---

## Root Cause 4: Missing Flex Protection in Text-Next-to-Icon Rows (MEDIUM)

**Files:** LibraryScreen modePill, RankingsScreen leaderInfo, DupeChallengeScreen summaryRow, ProfileScreen progressHeader

**Cause:** In React Native, a `<Text>` or `<View>` in a flex row defaults to `flexShrink: 0`. This means the text node cannot shrink below its intrinsic content size. When a flex row has multiple fixed-width or unshrinkable children alongside text, the text overflows or wraps unexpectedly because neither element has a shrink budget.

**Correct pattern:** Text containers in flex rows must have either:
- `flex: 1, minWidth: 0` (take available space, can shrink to zero)
- `flexShrink: 1, minWidth: 0` (yield space to siblings but stay anchored)

The `minWidth: 0` is critical — React Native text in a flex row can't shrink below its content width without it.

---

## Root Cause 5: Hard-Pixel Width Caps on Dynamic Text (MEDIUM/LOW)

**Files:** HomeScreen title (maxWidth:330), SavingsDashboard recentAmount (maxWidth:82), RankingsScreen rank (width:36)

**Cause:** Designers hardcoded pixel-width limits that matched 1× font scale but don't account for content growing at larger scales or on narrower devices.

**Correct pattern:** Use percentage widths, `flex: 1` with `minWidth: 0`, or `adjustsFontSizeToFit + numberOfLines` to gracefully handle text that might be wider than expected.

---

## Impact Summary

| Root Cause | Files Affected | Severity | Production Risk |
|---|---|---|---|
| overflow:hidden on Text nodes | RecipeDetailScreen | HIGH | Android font scale clip |
| Fixed height on text containers | 6 screens | HIGH | iOS Dynamic Type clip |
| lineHeight too tight for display font | okyoTheme | MEDIUM | Ascender clip at large scale |
| Missing flex protection in rows | 4 screens | MEDIUM | Overflow without shrink |
| Hard-pixel width caps | 3 screens | MEDIUM/LOW | Narrow device clip |
