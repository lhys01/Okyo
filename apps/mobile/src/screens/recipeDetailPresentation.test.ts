import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(sourceRoot, relativePath), 'utf8');

test('recipe detail actions are text-first and use the intended three labels', () => {
  const source = read('components/RecipePrimaryActions.tsx');
  assert.match(source, /<Action label="Cook" primary onPress=\{onCook\}/);
  assert.match(source, /<Action label="Customize" tone="customize" onPress=\{onCustomize\}/);
  assert.match(source, /<Action label="Groceries" tone="groceries" onPress=\{onGroceries\}/);
  assert.doesNotMatch(source, /actionIcons|<Play/);
});

test('secondary recipe actions use a single colored surface without an outer border', () => {
  const source = read('components/RecipePrimaryActions.tsx');
  assert.match(source, /customize: \{ backgroundColor: colors\.coralSoft/);
  assert.match(source, /groceries: \{ backgroundColor: '#FFF9EA'/);
  assert.doesNotMatch(source, /customize: \{[^}]*border/);
  assert.doesNotMatch(source, /groceries: \{[^}]*border/);
  assert.match(source, /customize: \{ backgroundColor: colors\.coralSoft, \.\.\.recipeShadows\.card \}/);
  assert.match(source, /groceries: \{ backgroundColor: '#FFF9EA', \.\.\.recipeShadows\.card \}/);
});

test('nutrition uses four independent floating metric bubbles', () => {
  const source = read('components/RecipeNutritionCards.tsx');
  for (const label of ['Calories', 'Protein', 'Carbs', 'Fat']) assert.match(source, new RegExp(`label: '${label}'`));
  assert.match(source, /gap: 8/);
  assert.match(source, /\.\.\.recipeShadows\.card/);
  assert.doesNotMatch(source, /macroCardWithDivider/);
});

test('pricing uses real restaurant and homemade estimates in one comparable two-column card', () => {
  const source = read('components/RecipeAssistantOverview.tsx');
  assert.match(source, />Pricing</);
  assert.match(source, /Restaurant estimate/);
  assert.match(source, /Make at home/);
  assert.match(source, /homemadePrice/);
  assert.match(source, /isKnownPrice/);
  assert.match(source, /costComparisonCard/);
  assert.match(source, /costDivider/);
  assert.match(source, /<PriceColumn label="Make at home"/);
  assert.match(source, /<PriceColumn label="Restaurant estimate"/);
  assert.match(source, /recipe\.estimatedHomemadeCost \+ recipe\.estimatedSavings/);
  assert.match(source, /scaledRestaurantEstimate/);
  assert.match(source, /\.\.\.recipeShadows\.card/);
  assert.match(source, /Restaurant estimate" value=\{scaledRestaurantEstimate === null \? '—'/);
});

test('scan results keep all four in-place recipe styles alongside Customize', () => {
  const source = read('screens/ResultSummaryScreen.tsx');
  for (const mode of ['Normal', 'Lighter', 'Healthier', 'More Protein']) assert.match(source, new RegExp(`'${mode}'`));
  assert.match(source, /RecipeStyleSelector/);
  assert.match(source, /presentationMode: mode/);
  assert.match(source, /onCustomize=\{revealCorrectionInput\}/);
  assert.match(source, /ActivityIndicator/);
});

test('scan result styles adapt from the base recipe, restore Normal in place, and guard duplicate taps', () => {
  const source = read('screens/ResultSummaryScreen.tsx');
  const chooseStyle = source.slice(source.indexOf('const choosePresentationMode'), source.indexOf('useEffect(() => {\n    const instruction'));
  const submitCorrection = source.slice(source.indexOf('const submitCorrection'), source.indexOf('const choosePresentationMode'));

  assert.match(chooseStyle, /correctionInFlightRef\.current/);
  assert.match(chooseStyle, /latestScanRecipe\?\.baseRecipe \?\? baseRecipeRef\.current/);
  assert.match(chooseStyle, /if \(mode === 'Normal'\)/);
  assert.match(chooseStyle, /correctRecipe\(selectedRecipe\.id, baseRecipe, baseScan\)/);
  assert.match(chooseStyle, /sourceRecipe: baseRecipe \?\? selectedRecipe/);
  assert.doesNotMatch(chooseStyle, /navigation\.(navigate|push|replace)/);
  assert.match(submitCorrection, /sourceRecipe\?: Recipe/);
  assert.match(submitCorrection, /getRecipeCorrectionSourceId\(override\?\.sourceRecipe \?\? selectedRecipe\)/);
  assert.match(source, /onCustomize=\{revealCorrectionInput\}/);
});

test('ingredient grocery selection is persisted and can toggle in both directions', () => {
  const ingredients = read('components/RecipeIngredientsAssistant.tsx');
  const store = read('state/useOkyoStore.ts');
  assert.match(ingredients, /Remove \$\{ingredient\.name\} from groceries/);
  assert.doesNotMatch(ingredients, /disabled=\{isAdded\}/);
  assert.match(ingredients, /backgroundColor: 'transparent'/);
  assert.match(store, /toggleIngredientInGrocery/);
  assert.match(store, /toggleGroceryIngredientSelection/);
});

test('quick recipe styles update in place instead of opening the free-form customize route', () => {
  const source = read('screens/RecipeDetailScreen.tsx');
  const chooseStyle = source.slice(source.indexOf('const choosePresentationMode'), source.indexOf('const toggleSelectedRecipeLike'));
  assert.match(chooseStyle, /correctScanRecipe/);
  assert.match(chooseStyle, /setIsUpdatingStyle\(true\)/);
  assert.match(chooseStyle, /setRecipePresentationMode\(recipe\.id, mode\)/);
  assert.doesNotMatch(chooseStyle, /navigation\.navigate/);
});

test('recipe styles use a compact coral segmented selector with in-place loading feedback', () => {
  const source = read('screens/RecipeDetailScreen.tsx');
  assert.match(source, /backgroundColor: '#FCF5F0'/);
  assert.match(source, /backgroundColor: colors\.coralSoft/);
  assert.match(source, /minHeight: 40/);
  assert.match(source, /ActivityIndicator color=\{colors\.coralDark\}/);
  assert.match(source, /accessibilityRole="progressbar"/);
  assert.match(source, /useReduceMotion/);
  assert.doesNotMatch(source, /Quick adaptations update this recipe in place\./);
  assert.doesNotMatch(source, /modeDisclosure:/);
});

test('feedback Saved toast is transient, floating, and removed after its exit animation', () => {
  const source = read('screens/RecipeDetailScreen.tsx');
  assert.match(source, /const \[feedbackToastVisible, setFeedbackToastVisible\]/);
  assert.match(source, /feedbackToastVisible \? \(/);
  assert.match(source, /Animated\.delay\(1200\)/);
  assert.match(source, /setFeedbackToastVisible\(false\)/);
  assert.match(source, /position: 'absolute'/);
  assert.match(source, /feedbackToastY\.interpolate/);
});
