import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(sourceRoot, relativePath), 'utf8');

test('scan result action row shows only evenly sized, icon-free Cook and Customize buttons', () => {
  const source = read('components/RecipePrimaryActions.tsx');
  const result = read('screens/ResultSummaryScreen.tsx');
  const resultActionsStart = result.indexOf('<RecipePrimaryActions');
  const resultActions = result.slice(resultActionsStart, result.indexOf('/>', resultActionsStart));
  assert.match(source, /<Action label="Cook" primary onPress=\{onCook\}/);
  assert.match(source, /<Action icon=\{showIcons \? actionIcons\.customize : undefined\} label="Customize"/);
  assert.match(source, /showGroceries && onGroceries/);
  assert.match(source, /showIcons \? actionIcons\.grocery : undefined/);
  assert.match(source, /action: \{[^}]*flex: 1/);
  assert.match(source, /row: \{ flexDirection: 'row', gap: 8 \}/);
  assert.match(result, /<RecipePrimaryActions[\s\S]*?showGroceries=\{false\}[\s\S]*?showIcons=\{false\}/);
  assert.doesNotMatch(resultActions, /onGroceries/);
  assert.doesNotMatch(source, /<Play/);
});

test('saved recipe detail action row is icon-free and keeps its cooking and customization handlers', () => {
  const detail = read('screens/RecipeDetailScreen.tsx');
  const component = read('components/RecipePrimaryActions.tsx');
  const actionStart = detail.indexOf('<RecipePrimaryActions');
  const actionEnd = detail.indexOf('/>', actionStart);
  const actionProps = detail.slice(actionStart, actionEnd);

  assert.match(actionProps, /onCook=\{openCookingSteps\}/);
  assert.match(actionProps, /onCustomize=\{openRecipeEditor\}/);
  assert.match(actionProps, /showGroceries=\{false\}/);
  assert.match(actionProps, /showIcons=\{false\}/);
  assert.match(component, /showGroceries && onGroceries/);
  assert.match(component, /icon=\{showIcons \? actionIcons\.customize : undefined\}/);
  assert.match(component, /accessibilityLabel=\{primary \? 'Cook this recipe'/);
  assert.match(component, /accessibilityRole="button"/);
  assert.match(component, /minHeight: 54/);
  assert.match(component, /action: \{[^}]*flex: 1/);
  assert.doesNotMatch(actionProps, /onGroceries/);
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
  const pricing = read('utils/recipePricing.ts');
  assert.match(source, />Pricing</);
  assert.match(source, /Eating out/);
  assert.match(source, /Make at home/);
  assert.match(source, /homemadePrice/);
  assert.match(pricing, /isKnownPrice/);
  assert.match(source, /costComparisonCard/);
  assert.match(source, /costDivider/);
  assert.match(source, /<PriceColumn label="Make at home"/);
  assert.match(source, /<PriceColumn label="Eating out"/);
  assert.match(source, /calculateRecipePrices/);
  assert.match(source, /eatingOut/);
  assert.match(source, /\.\.\.recipeShadows\.card/);
  assert.match(source, /Eating out" value=\{eatingOut === null \? '—'/);
});

test('scan results expose Normal, Lighter, and Healthier alongside Customize', () => {
  const source = read('screens/ResultSummaryScreen.tsx');
  const canonical = read('state/canonicalRecipes.ts');
  for (const mode of ['Normal', 'Lighter', 'Healthier']) assert.match(canonical, new RegExp(`'${mode}'`));
  assert.doesNotMatch(canonical.slice(canonical.indexOf('export const RECIPE_PRESENTATION_MODES'), canonical.indexOf('export type RecipePresentationVariant')), /More Protein/);
  assert.match(source, /RecipeStyleSelector/);
  assert.match(source, /presentationMode: mode/);
  assert.match(source, /onCustomize=\{revealCorrectionInput\}/);
  assert.match(source, /RecipeUpdatingStatus/);
  assert.doesNotMatch(source, /<ActivityIndicator/);
  assert.match(source, /Updating lighter recipe/);
  assert.match(source, /Updating healthier recipe/);
  assert.match(source, /return 'Updating recipe'/);
});

test('scan result styles adapt the latest recipe, restore Normal in place, and guard duplicate taps', () => {
  const source = read('screens/ResultSummaryScreen.tsx');
  const chooseStyle = source.slice(source.indexOf('const choosePresentationMode'), source.indexOf('useEffect(() => {\n    const instruction'));
  const submitCorrection = source.slice(source.indexOf('const submitCorrection'), source.indexOf('const choosePresentationMode'));

  assert.match(chooseStyle, /correctionInFlightRef\.current/);
  assert.match(chooseStyle, /latestScanRecipe\?\.baseRecipe \?\? baseRecipeRef\.current/);
  assert.match(chooseStyle, /if \(mode === 'Normal'\)/);
  assert.match(chooseStyle, /correctRecipe\(selectedRecipe\.id, baseRecipe, baseScan\)/);
  assert.match(chooseStyle, /sourceRecipe: selectedRecipe/);
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
  assert.match(chooseStyle, /currentRecipe: recipe, expectedSourceRecipeId: sourceId/);
  assert.match(chooseStyle, /getRecipeCorrectionSourceId\(recipe\)/);
  assert.match(chooseStyle, /correctionInFlightRef\.current/);
  assert.match(chooseStyle, /setIsUpdatingStyle\(true\)/);
  assert.match(chooseStyle, /setRecipePresentationMode\(recipe\.id, mode\)/);
  assert.doesNotMatch(chooseStyle, /navigation\.navigate/);
});

test('recipe styles use a compact coral selector with a cancelable animated loading row', () => {
  const source = read('screens/RecipeDetailScreen.tsx');
  const updating = read('components/RecipeUpdatingStatus.tsx');
  assert.match(source, /backgroundColor: '#FCF5F0'/);
  assert.match(source, /backgroundColor: colors\.coralSoft/);
  assert.match(source, /minHeight: 40/);
  assert.match(source, /<RecipeUpdatingStatus/);
  assert.match(source, /onCancel=\{cancelStyleUpdate\}/);
  assert.match(source, /styleAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(updating, /Animated\.loop/);
  assert.match(updating, /accessibilityLabel=\{message\}/);
  assert.match(updating, /color: colors\.coralDark/);
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
