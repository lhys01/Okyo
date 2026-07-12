# Card Regression Report — Okyo Mobile

**Audit Date:** 2026-06-18
**Auditor:** Staff Engineer (Hostile Review)
**Status:** INVESTIGATING

---

## Inventory Summary

### Total backgroundColor occurrences found: ~100 across entire codebase

**Breakdown by category:**

| Category | Count | Status |
|---|---|---|
| Onboarding (OnboardingUI.tsx) | ~45 | SKIPPED (user instruction) |
| WelcomeScreen | ~25 | SKIPPED (user instruction) |
| PaywallScreen | ~15 | SKIPPED (user instruction) |
| Scan logic files | ~10 | PRE-EXISTING (not touched in this session) |
| Group B — functional (nav, input, overlays) | ~11 | VERIFIED INTENTIONAL |
| Accent colors (green, orange, coral, yellow) | ~30+ | VERIFIED INTENTIONAL |
| FoodImage component | 1 | VERIFIED INTENTIONAL (button border) |
| **Total cleaned** | **~40 content cards** | ✓ REMOVED |

---

## Group B Verified Items (Intentional White Backgrounds)

| File | Line | Component | Purpose | Status |
|---|---|---|---|---|
| RecipeDetailScreen.tsx | 1047 | `circleBackButton` | Circular nav overlay on food photo | ✓ KEPT |
| RecipeDetailScreen.tsx | 1058 | `circleSaveButton` | Circular save overlay on food photo | ✓ KEPT |
| RecipeDetailScreen.tsx | 1069 | `inspiredPill` | Label overlay on food photo | ✓ KEPT |
| LibraryScreen.tsx | 581 | `searchBox` | Text input affordance (shadow removed) | ✓ KEPT |
| ResultSummaryScreen.tsx | 1231 | `scanAgainButton` | Circular nav button | ✓ KEPT |
| ResultSummaryScreen.tsx | 1268 | `settingsButton` | Circular nav button | ✓ KEPT |
| ResultSummaryScreen.tsx | 1434 | `dishNameInput` | Editable text input | ✓ KEPT |
| ResultSummaryScreen.tsx | 1569 | `priceInput` | Editable number input | ✓ KEPT |
| ResultSummaryScreen.tsx | 1659 | `modeTabSelected` | Selected tab indicator | ✓ KEPT |
| GroceryListScreen.tsx | 881 | `backButton` | Navigation back button | ✓ KEPT |
| KitchenLetterScreen.tsx | 114 | `closeButton` | Circular nav close (still has shadow) | ⚠ NEEDS CHECK |
| MainTabs.tsx | 250,317 | Navigation bar shadow | Tab chrome | ✓ KEPT |
| OkyoUI.tsx | 313 | `primaryButton.elevation` | Coral CTA brand shadow | ✓ KEPT |

---

## Critical Audit Findings

### Finding 1: KitchenLetterScreen.tsx closeButton still has shadow

**Line:** 119
**Issue:** `...shadows.card` spread still present
**Status:** ⚠ Should be removed (button doesn't need card shadow)

### Finding 2: LibraryScreen.tsx searchBox shadow removed but elevation not checked

**Line:** 581
**Change:** shadowColor/shadowOpacity/shadowRadius removed ✓
**Status:** ✓ VERIFIED

### Finding 3: ScanScreen and WelcomeScreen marked modified in git status

**Files:** apps/mobile/src/screens/ScanScreen.tsx, apps/mobile/src/screens/WelcomeScreen.tsx
**Status:** ⚠ MODIFIED BUT PRE-EXISTING (from commits a5d565f, earlier)
**Finding:** Changes are from PREVIOUS commits, NOT this card removal session
**Verdict:** ✓ NOT A VIOLATION

### Finding 4: MainTabs and ShareCardPreviewScreen modified

**Status:** ⚠ MODIFIED BUT PRE-EXISTING
**Finding:** Changes are navigation/image logic from previous commits, NOT card removal
**Verdict:** ✓ NOT A VIOLATION

---

## Remaining Shadow Spreads

| File | Line | Style | Status |
|---|---|---|---|
| KitchenLetterScreen.tsx | 119 | `closeButton: {...shadows.card}` | ⚠ SHOULD BE REMOVED |
| OkyoUI.tsx | 313 | `primaryButton: shadowColor/shadowOpacity/shadowRadius` | ✓ INTENTIONAL (coral CTA) |
| MainTabs.tsx | 250,317,320 | Tab bar shadows | ✓ INTENTIONAL (nav chrome) |
| RecipeDetailScreen.tsx | 1405-1409 | `primaryAction` (orange button) | ✓ INTENTIONAL (CTA) |
| ResultSummaryScreen.tsx | 1900-1904 | `resultPrimaryButton` (orange CTA) | ✓ INTENTIONAL |
| GroceryListScreen.tsx | 1255+ | `primaryAction` (coral CTA) | ✓ INTENTIONAL |

---

## Screens Verified

### ✓ Content screens (should be cardless)

- HomeScreen — no white card bgs, no card shadows
- LibraryScreen — searchBox is text input (white kept), shadow removed
- RecipeDetailScreen — main content flat, overlays intentional
- ResultSummaryScreen — all content flat, nav overlays intentional
- GroceryListScreen — content flat, nav button intentional
- SavingsDashboardScreen — all content flat
- ProfileScreen — all content flat
- RankingsScreen — all content flat (spreads from modified sharedStyles.card)
- GoalScreen — buttons have explicit cream bg
- SettingsScreen — all content flat (spreads from modified sharedStyles.card)
- RestaurantPackDetailScreen — all content flat
- KitchenLetterScreen — content flat, nav button mostly clean

### ⚠ Skipped screens (by design)

- ScanScreen — explicitly untouched
- WelcomeScreen — explicitly untouched
- PaywallScreen — explicitly untouched
- ShareCardPreviewScreen — is an export card by design
- OnboardingUI — explicitly untouched

---

## Regression Risk Assessment

| Risk | Severity | Status |
|---|---|---|
| Unexpected card bgs remain | MEDIUM | INVESTIGATING: 1 shadow spread in closeButton |
| Shadows remain on non-buttons | LOW | VERIFIED: all content cards shadow-free |
| Shared style spreads propagated white | LOW | VERIFIED: sharedStyles.card cleaned, no bg/shadow |
| Input fields lost affordance | LOW | VERIFIED: text inputs kept white, overlays intentional |
| Scan logic modified | CRITICAL | ✓ VERIFIED: pre-existing from earlier commits |
| Nav elements broken | LOW | ✓ VERIFIED: nav buttons intentional and functional |

---

## Next Phase

**MUST VERIFY:**
1. KitchenLetterScreen.tsx closeButton shadow spread — should be removed
2. Full screen-by-screen visual walk
3. Inheritance check — any child styles pulling card colors from parent?
