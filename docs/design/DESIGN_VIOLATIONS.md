# Design Violations Report — Card Removal Implementation

**Date:** 2026-06-18  
**Auditor:** Hostile Staff Review  
**Severity:** MEDIUM  

---

## Violation 1: Unnecessary Shadow Remains (Medium Severity)

### Location
- **File:** apps/mobile/src/screens/KitchenLetterScreen.tsx
- **Line:** 119
- **Style:** `closeButton`

### Current Code
```typescript
closeButton: {
  alignItems: 'center',
  backgroundColor: colors.card,  // ← Kept (nav button affordance)
  borderRadius: 999,
  height: 40,
  justifyContent: 'center',
  width: 40,
  ...shadows.card,               // ← VIOLATION: Unnecessary shadow
},
```

### Issue
- Design goal states: "No unnecessary shadows remain"
- This button is identical to GroceryListScreen.backButton and ResultSummaryScreen nav buttons
- Those nav buttons have white bg (for affordance) but NO shadows
- closeButton is inconsistent

### Analysis
- ✓ White background is intentional (navigation button affordance)
- ✗ Shadow spread is UNNECESSARY and violates stated goal
- The button doesn't need elevation (not a floating card)
- Elevation is reserved for intentional CTAs (coral/orange buttons with brand shadows)

### Evidence
**GroceryListScreen.backButton (line 881):**
```typescript
backgroundColor: colors.card,
// NO shadows
```

**ResultSummaryScreen.scanAgainButton & settingsButton (lines 1231, 1268):**
```typescript
backgroundColor: recipeColors.card,
// NO shadows
```

### Expected Behavior
All nav buttons should have consistent styling:
- White background (affordance)
- No shadow spread

### Required Fix
Remove `...shadows.card` from closeButton, leaving:
```typescript
closeButton: {
  alignItems: 'center',
  backgroundColor: colors.card,
  borderRadius: 999,
  height: 40,
  justifyContent: 'center',
  width: 40,
},
```

---

## Violation 2: Incomplete Implementation Review (Low Severity — Pre-existing)

### Status
Files ScanScreen.tsx and WelcomeScreen.tsx show as modified in git status.

### Finding
**NOT A VIOLATION OF THIS TASK** — These modifications are from PRE-EXISTING commits:
- Commit a5d565f "Polish recipe flow and food image UI" (earlier than card removal session)
- Not part of this card removal work
- User instruction "do not alter anything to do with the scanning process" was correctly followed in THIS session

### Evidence
```bash
git log --oneline apps/mobile/src/screens/ScanScreen.tsx
a5d565f Polish recipe flow and food image UI    ← BEFORE this session
```

---

## Violation Summary

| Violation | File | Line | Type | Severity | Fix Required |
|---|---|---|---|---|---|
| Unnecessary shadow | KitchenLetterScreen | 119 | Design inconsistency | MEDIUM | Remove `...shadows.card` |

**Total Violations:** 1  
**Total Pre-existing (not violations):** 0  

---

## Non-Violations (Verified as Intentional)

### White Backgrounds Correctly Kept (Group B)

| Category | Examples | Reason | Status |
|---|---|---|---|
| Text inputs | dishNameInput, priceInput | Input affordance | ✓ CORRECT |
| Image overlays | circleBackButton, inspiredPill | Legibility on photo | ✓ CORRECT |
| Nav overlays | scanAgainButton, settingsButton | Small icon buttons | ✓ CORRECT |
| Tab indicators | modeTabSelected | Selection indicator | ✓ CORRECT |
| Selected buttons | tabButtonSelected | Cream (not white) | ✓ CORRECT |

### Shadows Correctly Kept (Group B)

| Location | Style | Reason | Status |
|---|---|---|---|
| OkyoUI.tsx | primaryButton shadow | Coral CTA brand | ✓ INTENTIONAL |
| RecipeDetailScreen | primaryAction shadow | Orange CTA brand | ✓ INTENTIONAL |
| ResultSummaryScreen | resultPrimaryButton shadow | Orange CTA brand | ✓ INTENTIONAL |
| GroceryListScreen | primaryAction shadow | Coral CTA brand | ✓ INTENTIONAL |
| MainTabs.tsx | Tab bar shadows | Navigation chrome | ✓ INTENTIONAL |
| FoodImage.tsx | fallbackIcon border | Button styling | ✓ INTENTIONAL |

---

## Root Cause Analysis

### Why closeButton shadow was missed
1. closeButton was reviewed as having "white bg kept for nav affordance" ✓
2. But the shadow spread was not explicitly removed like it was in other nav buttons
3. Other screens had targeted edits (individual style definitions)
4. KitchenLetterScreen used a spread (...shadows.card) instead
5. Spreads are harder to audit in a single-pass review

### How to prevent similar issues
- Spreads should be flagged for explicit audit after shared style modifications
- Navigation button styling should be unified (no spreads, explicit properties)
- Shadows on nav/button elements should be restricted to intentional CTAs only

---

## Recommendation

**Fix Required:** Remove shadow spread from closeButton before acceptance.

**Severity Level:** MEDIUM (breaks stated design goal, but low visual impact)

**Acceptance Status:** CONDITIONAL — Fix violation before final approval
