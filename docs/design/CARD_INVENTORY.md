# Card Inventory — Okyo Mobile

Every style object that creates a card-like visual (white background, shadow, elevation, or rounded-rect wrapper) found in the mobile app.

## Shared Primitives

| Location | Style | Description |
|---|---|---|
| OkyoUI.tsx:248 | `sharedStyles.card` | White bg + shadow + borderRadius + padding. Spread into 7+ screens. |
| OkyoUI.tsx:324 | `sharedStyles.secondaryButton` | White bg + card shadow. Button that floats. |
| OkyoUI.tsx:380 | `sharedStyles.statCard` | White bg + card shadow + fixed width. |
| okyoTheme.ts | `shadows.card` | Shadow spread: color #4a3a28, h6, opacity 0.06, radius 14, elevation 2. |
| okyoTheme.ts | `shadows.hero` | Larger shadow variant for hero cards. |
| recipeTheme.ts | `recipeShadows.card` | Recipe-context shadow spread. |
| recipeTheme.ts | `recipeShadows.hero` | Recipe hero shadow variant. |

## Components

| Location | Style | Description |
|---|---|---|
| RecommendationCard.tsx:41 | `card` | White bg + shadow + radius + overflow:hidden. Grid card for discovery. |
| ScreenScaffold.tsx:53 | `heroCard` | Uses `...sharedStyles.card` + padding 20. Top-of-screen wrapper. |

## Screen Styles

### RecipeDetailScreen.tsx (main)
| Style | Description |
|---|---|
| `overviewPanel` | Was white card + shadow (already removed) |
| `quickStatsRow` | Was cream bg + radius (already removed) |
| `ingredientGroupCard` | Was cream bg + radius (already removed) |
| `infoCard` | Was cream bg + radius + padding (already removed) |
| `savingsCard` | Green accent — kept |
| `flavorChip` | Changed to cream (already done) |
| `secondaryIconAction` | Changed to cream (already done) |

### RecipeDetailScreen.tsx (guided cooking + steps)
| Style | Line | Description |
|---|---|---|
| `guidedHeader` | 1447 | White bg + border + radius 24 + shadow |
| `guidedStepCard` | 1495 | White bg + border + radius 28 + shadow + flex:1 |
| `guidedNavButton` | 1647 | White bg + border. Secondary nav button. |
| `tipPanel` | 1691 | White bg + large shadow. Bottom sheet modal. |
| `completionCard` | 1746 | White bg + border + radius 32 + hero shadow |
| `stepsHeroCard` | 1797 | White bg + shadow. Steps view header. |
| `stepCard` | 1860 | White bg + shadow. Individual step row. |
| `stepCardActive` | 1871 | Near-white #fffdf8 bg overlay on active step. |
| `issueCard` | 2025 | White bg + shadow. Error/issue state. |
| `secondaryAction` | 2058 | White bg + border. Secondary action button. |

### ResultSummaryScreen.tsx (all already removed)
| Style | Status |
|---|---|
| `confirmCard` | Done |
| `savingsHero` | Done |
| `summaryCard` | Done |
| `matchCard` | Done |
| `failureCard` | Done |
| `starterCard` | Done |
| `loadingMiniCard` | Done |
| `actionButton` | Done |

### LibraryScreen.tsx (all already removed)
| Style | Status |
|---|---|
| `heroCard` | Done |
| `heroStats` | Done |
| `filterChip` | Done |
| `recipeCard` | Done |
| `noMatchesCard` | Done |
| `emptyCard` | Done |

### HomeScreen.tsx (all already removed)
| Style | Status |
|---|---|
| `heroCard` | Done |
| `timelineItem` | Done |
| `emptyRecent` | Done |
| `discoverPromptCard` | Done |

### GroceryListScreen.tsx
| Style | Line | Description |
|---|---|---|
| `savedRecipeCard` | ~930 | Already removed (white bg + shadow) |
| `savedEmptyCard` | ~955 | Already removed |
| `recipeSummaryRow` | ~970 | Already removed |
| `backButton` | 881 | Nav button — GROUP B (keep) |
| `tabButton` | 1078 | White bg tab. Unselected state. |
| `categoryCard` | 1133 | White bg + shadow. Ingredient category wrapper. |
| `emptyTabCard` | 1205 | White bg + shadow. Empty state for each tab. |
| `allSetCard` | 1233 | Cream bg + radius 24. All-done celebration. |
| `issueCard` | 1278 | White bg + shadow. Error/issue state. |

### ProfileScreen.tsx (all already removed)
| Style | Status |
|---|---|
| `headerCard` | Done |
| `progressCard` | Done |
| `statCard` | Done |
| `menu` | Done |

### SavingsDashboardScreen.tsx
| Style | Line | Description |
|---|---|---|
| `biggestCard` | ~720 | Already removed |
| `periodEmptyCard` | ~757 | Already removed |
| `statTile` | ~776 | Already removed |
| `recentCard` | ~787 | Already removed |
| `emptyCard` | 818 | White bg + border. Empty state. |

### AnalysisLoadingScreen.tsx
| Style | Status |
|---|---|
| `progressCard` | Done |

### KitchenLetterScreen.tsx
| Style | Line | Description |
|---|---|---|
| `closeButton` | 112 | White bg + shadow. Nav close button — GROUP B |
| `perks` | 145 | White bg + shadow. Perks list wrapper. |

### GoalScreen.tsx
| Style | Line | Description |
|---|---|---|
| `goalButton` | 52 | `...sharedStyles.card` — will flatten via sharedStyles.card change |

### SettingsScreen.tsx
| Style | Line | Description |
|---|---|---|
| `section` | 138 | `...sharedStyles.card` — will flatten via sharedStyles.card change |

### RankingsScreen.tsx
| Style | Line | Description |
|---|---|---|
| `xpCard` | 303 | `...sharedStyles.card` — will flatten via sharedStyles.card change |
| `section` | 388 | `...sharedStyles.card` — will flatten via sharedStyles.card change |
| `leaderboardSection` | 428 | `...sharedStyles.card` — will flatten via sharedStyles.card change |

### DupeChallengeScreen.tsx
| Style | Line | Description |
|---|---|---|
| `summaryCard` | 237 | `...sharedStyles.card` — will flatten via sharedStyles.card change |
| `ratingCard` | 288 | `...sharedStyles.card` — will flatten via sharedStyles.card change |

### RestaurantPackDetailScreen.tsx
| Style | Line | Description |
|---|---|---|
| `summaryCard` | 286 | `...sharedStyles.card` — will flatten via sharedStyles.card change |
| `dishCard` | 318 | `...sharedStyles.card` — will flatten via sharedStyles.card change |

## Intentionally Skipped Screens

| Screen | Reason |
|---|---|
| ScanScreen.tsx | User: do not alter anything to do with the scanning process |
| WelcomeScreen.tsx | User: do not touch onboarding logic |
| OnboardingUI.tsx | Onboarding — skip entirely |
| ShareCardPreviewScreen.tsx | IS a literal visual card for export — intentional |
| PaywallScreen.tsx | Pricing tier cards are standard UX; RevenueCat not to be touched |
| MainTabs.tsx | Navigation chrome — GROUP B |
