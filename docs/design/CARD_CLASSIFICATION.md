# Card Classification — Okyo Mobile

Every card from the inventory classified into GROUP A (remove), GROUP B (keep), or GROUP C (review).

## Classification Logic

- **GROUP A — Remove**: Content cards, section wrappers, empty states, loading states. White bg + shadow creates an unnecessary floating panel. Should be flat on cream background.
- **GROUP B — Keep**: Buttons with visible bg (tap targets need affordance), image containers needing overflow:hidden clip, intentional visual cards (ShareCard), navigation elements (tab bars, back buttons), branded accent blocks (green savings, coral CTA).
- **GROUP C — Review**: Elements where the white bg serves a real UX purpose that isn't immediately obvious. Decide case-by-case.

---

## GROUP A — Remove (flatten to background)

| File | Style | Action |
|---|---|---|
| OkyoUI.tsx | `sharedStyles.card` | Remove `backgroundColor` + shadow. Keep radius + padding. |
| OkyoUI.tsx | `sharedStyles.secondaryButton` | Change bg to cream. Remove shadow. |
| OkyoUI.tsx | `sharedStyles.statCard` | Remove bg + shadow. |
| RecommendationCard.tsx | `card` | Remove bg + shadow. Keep radius + overflow for image clip. |
| RecipeDetailScreen.tsx | `guidedHeader` | Remove bg + border + shadow. |
| RecipeDetailScreen.tsx | `guidedStepCard` | Remove bg + border + shadow. Keep flex:1 + marginTop. |
| RecipeDetailScreen.tsx | `tipPanel` | Change bg to recipeColors.background. Remove shadow. |
| RecipeDetailScreen.tsx | `completionCard` | Remove bg + border + shadow. |
| RecipeDetailScreen.tsx | `stepsHeroCard` | Remove bg + shadow. |
| RecipeDetailScreen.tsx | `stepCard` | Remove bg + shadow. |
| RecipeDetailScreen.tsx | `stepCardActive` | Remove near-white bg. |
| RecipeDetailScreen.tsx | `issueCard` (guided) | Remove bg + shadow. |
| GroceryListScreen.tsx | `categoryCard` | Remove bg + shadow. Keep radius + overflow for section grouping. |
| GroceryListScreen.tsx | `emptyTabCard` | Remove bg + shadow. |
| GroceryListScreen.tsx | `allSetCard` | Remove borderRadius (cream bg stays as subtle accent). |
| GroceryListScreen.tsx | `issueCard` | Remove bg + shadow. |
| SavingsDashboardScreen.tsx | `emptyCard` | Remove bg + border. |
| KitchenLetterScreen.tsx | `perks` | Remove bg + shadow. |
| GoalScreen.tsx | `goalButton` | Add explicit cream bg (was white from sharedStyles.card spread). |
| ScreenScaffold.tsx | `heroCard` | Automatically flattened when sharedStyles.card loses bg. |
| SettingsScreen.tsx | `section` | Automatically flattened when sharedStyles.card loses bg. |
| RankingsScreen.tsx | `xpCard` | Automatically flattened when sharedStyles.card loses bg. |
| RankingsScreen.tsx | `section` | Automatically flattened when sharedStyles.card loses bg. |
| RankingsScreen.tsx | `leaderboardSection` | Automatically flattened when sharedStyles.card loses bg. |
| DupeChallengeScreen.tsx | `summaryCard` | Automatically flattened when sharedStyles.card loses bg. |
| DupeChallengeScreen.tsx | `ratingCard` | Automatically flattened when sharedStyles.card loses bg. |
| RestaurantPackDetailScreen.tsx | `summaryCard` | Automatically flattened when sharedStyles.card loses bg. |
| RestaurantPackDetailScreen.tsx | `dishCard` | Automatically flattened when sharedStyles.card loses bg. |

## GROUP B — Keep (intentional)

| File | Style | Reason |
|---|---|---|
| ShareCardPreviewScreen.tsx | All | IS a literal export card — must stay as card |
| MainTabs.tsx | Tab bar shadows | Navigation chrome — standard UX |
| OkyoUI.tsx | `primaryButton` | Coral CTA — branded, intentional shadow |
| RecipeDetailScreen.tsx | `guidedNavButtonPrimary` | Orange primary CTA in guided mode |
| RecipeDetailScreen.tsx | `savingsCard` | Green bg accent — intentional brand color |
| RecipeDetailScreen.tsx | `guidedCueBlock` | Green bg — semantic cooking cue |
| RecipeDetailScreen.tsx | `guidedSafetyBlock` | Yellow bg — safety warning |
| RecipeDetailScreen.tsx | `stepTipCard` | Warm yellow bg — cooking tip accent |
| RecipeDetailScreen.tsx | `cookingNotesCard` | Cream bg — subtle grouping, not a card |
| GroceryListScreen.tsx | `backButton` | Nav button — needs visible tap target |
| GroceryListScreen.tsx | `tabButtonSelected` | Coral bg selected state — brand color |
| GroceryListScreen.tsx | `primaryAction` | Coral CTA — branded |
| KitchenLetterScreen.tsx | `heroCard` | Cream bg — decorative hero, not a floating card |
| KitchenLetterScreen.tsx | `closeButton` | Nav button — needs visible tap target |
| PaywallScreen.tsx | All | Pricing cards are standard UX; RevenueCat untouched |
| ScanScreen.tsx | All | Scan pipeline — do not touch |
| WelcomeScreen.tsx | All | Onboarding — do not touch |

## GROUP B — Button colors (change white → cream)

| File | Style | Action |
|---|---|---|
| RecipeDetailScreen.tsx | `guidedNavButton` | White → cream bg. Keep border. |
| RecipeDetailScreen.tsx | `secondaryAction` | White → cream bg. Keep border. |
| GroceryListScreen.tsx | `tabButton` | White → cream bg. Keep radius. |

## GROUP C — Already Done (previous session)

RecipeDetailScreen main panel styles, ResultSummaryScreen, LibraryScreen, HomeScreen, GroceryListScreen (first 3 items), ProfileScreen, SavingsDashboardScreen (first 4), AnalysisLoadingScreen — all flattened in prior session.
