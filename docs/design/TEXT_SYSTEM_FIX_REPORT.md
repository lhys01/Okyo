# Text System Fix Report
**Date:** 2026-06-18  
**Status:** IMPLEMENTED  

---

## Systemic Fix Principles

Three reusable rules now govern text rendering in Okyo:

### Rule 1: Pill/chip shapes use View wrapper + inner Text
`overflow: 'hidden'` must live on a `<View>` (which clips background to borderRadius), never directly on a `<Text>` (which can clip glyph content on Android). Pattern:
```tsx
// CORRECT
<View style={styles.chipWrap}>
  <Text numberOfLines={1} style={styles.chipText}>{value}</Text>
</View>
// styles: chipWrap gets { backgroundColor, borderRadius, overflow:'hidden', padding }
// styles: chipText gets { color, fontFamily, fontSize, fontWeight }

// WRONG — do not do this
<Text style={styles.chip}>{value}</Text>
// styles: chip with overflow:'hidden', borderRadius, backgroundColor — clips glyph on Android
```

### Rule 2: Containers with text use minHeight, never height
`height` on a container with text children clips content at large font scale. `minHeight` allows the container to grow and is visually identical at 1× scale.
```tsx
// CORRECT
button: { minHeight: 58, paddingVertical: 10 }
topBar: { minHeight: 60 }

// WRONG
button: { height: 58 }   // clips at accessibility font scale
topBar: { height: 60 }   // clips at accessibility font scale
```

### Rule 3: Display typography lineHeight ≥ 1.25 × fontSize
Baloo2 (display font) has tall cap height. Minimum safe lineHeight is `fontSize × 1.25` to prevent clipping at large Dynamic Type.
```tsx
// okyoTheme.ts — CORRECT after fix
display: { fontSize: 40, lineHeight: 50 }  // ratio 1.25
title:   { fontSize: 28, lineHeight: 36 }  // ratio 1.29
```

---

## Files Changed

### apps/mobile/src/theme/okyoTheme.ts
- `typography.display`: lineHeight 46 → 50 (ratio 1.15 → 1.25)
- `typography.title`: lineHeight 34 → 36 (ratio 1.21 → 1.29)

### apps/mobile/src/screens/RecipeDetailScreen.tsx
- `flavorChip` → split into `flavorChipWrap` (View) + `flavorChipText` (Text)
- `guidedTimeChip` → split into `guidedTimeChipWrap` (View) + `guidedTimeChipText` (Text)
- `guidedChip` → split into `guidedChipWrap` (View) + `guidedChipText` (Text)
- `simpleTopBar`: `height: 56` → `minHeight: 56`
- JSX: 3 chip render sites updated to use View+Text pattern

### apps/mobile/src/screens/GroceryListScreen.tsx
- `topBar`: `height: 66` → `minHeight: 66`

### apps/mobile/src/screens/ResultSummaryScreen.tsx
- `topBar`: `height: 60` → `minHeight: 60`

### apps/mobile/src/screens/AnalysisLoadingScreen.tsx
- `topBar`: `height: 64` → `minHeight: 64`

### apps/mobile/src/components/onboarding/OnboardingUI.tsx
- `button`: `height: 58` → `minHeight: 58` + `paddingVertical: 10`
- `scanSecondaryAction`: `height: 54` → `minHeight: 54` + `paddingVertical: 8`

### apps/mobile/src/screens/KitchenLetterScreen.tsx
- `closeButton`: removed `...shadows.card` (prior audit violation)

---

## What Was NOT Changed

Issues documented but not fixed (intentionally):
- `HomeScreen heroCard overflow:hidden` — card has no fixed height; verified safe
- `SavingsDashboard heroCard overflow:hidden` — uses minHeight; card grows; safe
- `OkyoUI card overflow:hidden` — RestaurantPack card; image clipping needed; no fixed height
- Medium/Low flex issues (L-3 through L-16 in audit) — accepted risk; not fixing avoids UI disruption

---

## TypeScript Verification
`cd apps/mobile && npx tsc --noEmit` — **0 errors** after all changes.
