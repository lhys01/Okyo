# Post-Removal Audit — Okyo Mobile Card Removal

## Search Queries Run

1. `backgroundColor: '#FFF'` / `backgroundColor: '#fff'` — all near-white values
2. `backgroundColor: colors.card` / `backgroundColor: recipeColors.card`
3. `...shadows.card` / `...shadows.hero` / `...recipeShadows.card` / `...recipeShadows.hero`
4. `shadowOpacity` / `elevation:`

## Remaining Group B Items (Intentional, Not Removed)

| File | Line | Style | Reason Kept |
|---|---|---|---|
| RecipeDetailScreen.tsx | 1047 | `circleBackButton.backgroundColor` | Circular nav button overlaid on food photo — needs white for image contrast |
| RecipeDetailScreen.tsx | 1058 | `circleSaveButton.backgroundColor` | Circular save button overlaid on food photo — same |
| RecipeDetailScreen.tsx | 1069 | `inspiredPill.backgroundColor` | Pill overlaid on food photo — needs bg for legibility |
| LibraryScreen.tsx | 581 | `searchBox.backgroundColor` | Text input — white bg provides functional input affordance (shadow removed) |
| ResultSummaryScreen.tsx | 1231 | `scanAgainButton.backgroundColor` | Circular nav button in top bar |
| ResultSummaryScreen.tsx | 1268 | `settingsButton.backgroundColor` | Circular nav button in top bar |
| ResultSummaryScreen.tsx | 1434 | `dishNameInput.backgroundColor` | Text input — functional |
| ResultSummaryScreen.tsx | 1569 | `priceInput.backgroundColor` | Number input — functional |
| ResultSummaryScreen.tsx | 1659 | `modeTabSelected.backgroundColor` | Selected tab pill indicator — visual selection state |
| GroceryListScreen.tsx | 881 | `backButton.backgroundColor` | Nav back button |
| KitchenLetterScreen.tsx | 114-119 | `closeButton` | Circular nav close button + shadow |
| MainTabs.tsx | 250,317,320 | Tab bar shadows | Navigation chrome — GROUP B |
| OkyoUI.tsx | 313 | `primaryButton.elevation` | Coral CTA button — intentional brand shadow |
| ResultSummaryScreen.tsx | 1904 | `resultPrimaryButton.elevation` | Orange CTA button — intentional |
| RecipeDetailScreen.tsx | 1409 | `primaryAction.elevation` | Orange CTA button — intentional |
| GroceryListScreen.tsx | 1255 | `primaryAction.elevation` | Coral CTA button — intentional |

## Screens Skipped (by user instruction)

- `ScanScreen.tsx` — scan pipeline
- `WelcomeScreen.tsx` / `OnboardingUI.tsx` — onboarding
- `ShareCardPreviewScreen.tsx` — export card by design
- `PaywallScreen.tsx` — pricing tier cards

## Result

All GROUP A cards have been removed. All remaining `colors.card`, `recipeColors.card`, and shadow usages are GROUP B (functional buttons, inputs, or intentional brand elements).

**PASS** — no unnecessary white cards or shadows remain.
