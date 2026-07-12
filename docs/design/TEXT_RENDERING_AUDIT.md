# Text Rendering Audit — Okyo Mobile
**Date:** 2026-06-18
**Auditor:** Hostile Staff Engineer
**Scope:** All screens, shared components, theme system

---

## Audit Methodology

Four parallel agents read every screen and component file in the mobile app, searching for:
- `overflow: 'hidden'` on containers or Text nodes containing text children
- Fixed `height` (not `minHeight`) on containers that hold text
- Missing `flexShrink: 1` + `minWidth: 0` on text in flex rows
- `numberOfLines` truncation without `adjustsFontSizeToFit` fallback
- `lineHeight` values below the 1.2× minimum relative to `fontSize`
- Absolutely positioned text containers with hardcoded offsets
- `maxWidth` hard-pixel caps on text content

---

## HIGH Severity Findings

Issues that will definitely clip text in some real user scenario.

| # | File | Line | Style | Issue | Description |
|---|------|------|-------|-------|-------------|
| H-1 | RecipeDetailScreen.tsx | 1319 | `flavorChip` | OVERFLOW_HIDDEN_ON_TEXT | `overflow: 'hidden'` applied directly to a `<Text>` node with backgroundColor + borderRadius. On Android at large font scale this clips rendered glyphs. |
| H-2 | RecipeDetailScreen.tsx | 1511 | `guidedTimeChip` | OVERFLOW_HIDDEN_ON_TEXT | Same pattern — `overflow: 'hidden'` on a `<Text>` node for pill chip rendering. |
| H-3 | RecipeDetailScreen.tsx | 1598 | `guidedChip` | OVERFLOW_HIDDEN_ON_TEXT | Same pattern — `overflow: 'hidden'` on a `<Text>` node. |
| H-4 | OnboardingUI.tsx | 1097 | `button` | FIXED_HEIGHT_WITH_TEXT | `height: 58` (not `minHeight`). Clips `buttonText` at iOS Accessibility Extra Large+ font scale. Affects every CTA button across the entire onboarding flow. |
| H-5 | OnboardingUI.tsx | 1207 | `scanSecondaryAction` | FIXED_HEIGHT_WITH_TEXT | `height: 54` (not `minHeight`). Same clip risk on the secondary scan action button in onboarding. |

---

## MEDIUM Severity Findings

Issues that clip at larger font scale settings or with longer-than-typical content.

| # | File | Line | Style | Issue | Description |
|---|------|------|-------|-------|-------------|
| M-1 | okyoTheme.ts | 53 | `typography.display` | FONT_SCALE_RISK | `fontSize: 40, lineHeight: 46` — ratio 1.15, below safe 1.2×. Baloo2 display font has tall cap height. Clips ascenders at large Dynamic Type. |
| M-2 | okyoTheme.ts | 61 | `typography.title` | FONT_SCALE_RISK | `fontSize: 28, lineHeight: 34` — ratio 1.21. Borderline for Baloo2. |
| M-3 | RecipeDetailScreen.tsx | 1957 | `simpleTopBar` | FIXED_HEIGHT_WITH_TEXT | `height: 56` (not `minHeight`). Top bar clips "Back", "Done", "Steps" button text at large font scale. |
| M-4 | ResultSummaryScreen.tsx | 1221 | `topBar` | FIXED_HEIGHT_WITH_TEXT | `height: 60` (not `minHeight`). "Scan again" text clips inside fixed-height nav bar. |
| M-5 | AnalysisLoadingScreen.tsx | 217 | `topBar` | FIXED_HEIGHT_WITH_TEXT | `height: 64` (not `minHeight`). "Analyzing" title clips inside fixed-height bar. |
| M-6 | GroceryListScreen.tsx | 873 | `topBar` | FIXED_HEIGHT_WITH_TEXT | `height: 66` (not `minHeight`). Title and subtitle text in nav bar clips at large scale. |
| M-7 | OkyoUI.tsx | 432 | `card` | OVERFLOW_HIDDEN_WITH_TEXT | `overflow: 'hidden'` on the RestaurantPack card style propagates to all cards using it. Any text child overflowing card bounds is silently clipped. |
| M-8 | RecommendationCard.tsx | 41 | `card` | OVERFLOW_HIDDEN_WITH_TEXT | `overflow: 'hidden'` on discovery card. `title` (numberOfLines=2) and `blurb` (numberOfLines=2) can be clipped at very large font scale if card has insufficient height. |
| M-9 | LibraryScreen.tsx | 644 | `modePill` | MISSING_FLEX_SHRINK | `modePill` container in space-between row has no `flexShrink`. Inner `modePillText` has `flexShrink: 1` but the container cannot shrink past intrinsic size. |
| M-10 | ProfileScreen.tsx | 228 | `statCard` | UNSAFE_WIDTH | `width: '48%'` with `adjustsFontSizeToFit` but no `minimumFontScale`. Value text can shrink uncomfortably small on narrow devices. |
| M-11 | SavingsDashboardScreen.tsx | 810 | `recentAmount` | UNSAFE_WIDTH | `maxWidth: 82` hard pixel cap on savings amount. "$1,234.56" at large font scale truncates without ellipsis guard. |
| M-12 | RankingsScreen.tsx | 444 | `rank` | UNSAFE_WIDTH | `width: 36` fixed pixel on rank badge. "#100" overflows at any font scale. |
| M-13 | RankingsScreen.tsx | 451 | `leaderInfo` | MISSING_MIN_WIDTH_0 | `leaderName` and `leaderValue` have no `flexShrink` or `numberOfLines` in flex row. |
| M-14 | DupeChallengeScreen.tsx | 247 | `summaryRow` | MISSING_MIN_WIDTH_0 | Both `summaryLabel` and `summaryValue` have `flex: 1` but no `minWidth: 0`. Text can overflow at font scale ≥1.5×. |
| M-15 | ShareCardPreviewScreen.tsx | 1018 | `shareStat` | FIXED_HEIGHT_WITH_TEXT | `shareStatLabel` has no `numberOfLines` inside `minHeight: 74` stat container. Wrapping at large scale pushes `shareStatValue` out of view. |
| M-16 | HomeScreen.tsx | 287 | `title` | UNSAFE_WIDTH | `maxWidth: 330` hardcoded pixel cap. Clips on very narrow or small legacy devices. |

---

## LOW Severity Findings

Minor risk, unlikely to clip in practice, or protected by existing mitigations.

| # | File | Line | Style | Issue |
|---|------|------|-------|-------|
| L-1 | okyoTheme.ts | 69 | `typography.heading` | FONT_SCALE_RISK — 20/26 = 1.3×, acceptable |
| L-2 | okyoTheme.ts | 84 | `typography.caption` | FONT_SCALE_RISK — 13/18 = 1.38×, fine but borderline at overflow:hidden parents |
| L-3 | OkyoUI.tsx | 279 | `screenTitle` | FONT_SCALE_RISK — 34/40 = 1.18× below threshold |
| L-4 | OkyoUI.tsx | 343 | `badgePill` | FIXED_HEIGHT_WITH_TEXT — `paddingVertical: 7` only, no minHeight |
| L-5 | GroceryListScreen.tsx | 888 | `titleGroup` | ABSOLUTE_POSITION_TEXT — `left: 58, right: 58` hardcoded |
| L-6 | GroceryListScreen.tsx | 1100 | `controlsRow` | MISSING_FLEX_SHRINK — "Mark all"/"Share List" labels unconstrained |
| L-7 | ProfileScreen.tsx | 195 | `progressHeader` | MISSING_FLEX_SHRINK — both label and value unconstrained in space-between row |
| L-8 | SavingsDashboardScreen.tsx | 717 | `goalCopy` | ABSOLUTE_POSITION_TEXT — `marginLeft: 60` hardcoded icon offset |
| L-9 | MainTabs.tsx | 280 | `sideLabel` | FONT_SCALE_RISK — custom tab bar Text lacks `allowFontScaling={false}` |
| L-10 | KitchenLetterScreen.tsx | 150 | `perkRow` | MISSING_FLEX_SHRINK — `perkLabel` lacks `flex: 1` in row |
| L-11 | SettingsScreen.tsx | 126 | `title` | FONT_SCALE_RISK — 34/39 = 1.15× below threshold |
| L-12 | ScanScreen.tsx | 1275 | `howCaption` | FONT_SCALE_RISK — `numberOfLines={2}` with no adjustsFontSizeToFit |
| L-13 | RestaurantPackDetailScreen.tsx | 263 | `title` | FONT_SCALE_RISK — 32/37 = 1.16× below threshold |
| L-14 | RestaurantPacksScreen.tsx | 79 | `categoryName` | NUMBEROFLINES_RISK — `numberOfLines={2}` without adjustsFontSizeToFit |
| L-15 | ChallengeCompleteScreen.tsx | 115 | `scoreValue` | FONT_SCALE_RISK — `fontSize: 38` with no numberOfLines or adjustsFontSizeToFit |

---

## Not Issues (Verified Safe)

- `heroCard` overflow:hidden in HomeScreen/SavingsDashboard — no fixed height, card grows to fit
- Image containers with overflow:hidden — correct, needed for corner clipping
- Progress track bars (height:6-10) — no text children
- `modeTabSelected` fixed indicator (height:32) — single-pixel selection line, no text inside
- `numberOfLines` on intentionally truncated list items — by design
- `minHeight` on buttons — correct, allows growth
- `adjustsFontSizeToFit` + `numberOfLines={1}` combinations — properly protected
