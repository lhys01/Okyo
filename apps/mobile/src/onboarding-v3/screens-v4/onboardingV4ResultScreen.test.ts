import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const screen = read('src/onboarding-v3/screens-v4/FreeRecipeResultScreen.tsx');
const flow = read('src/onboarding-v3/screens-v4/OnboardingV4.tsx');

test('V4 result renders complete content from the supplied canonical recipe', () => {
  for (const field of ['recipe.title', 'recipe.description', 'recipe.ingredients', 'recipe.steps', 'recipe.equipment', 'recipe.nutritionEstimate', 'recipe.estimatedHomemadeCost']) assert.match(screen, new RegExp(field.replace('.', '\\.')));
  assert.match(flow, /resolveV4ResultRecipe\(recipesById, state\.recipeId, latestScanSessionId\)/);
  assert.match(flow, /recipe=\{resultRecipe\}/);
});

test('result opening and reopening never invoke analysis, generation, or canonical insertion', () => {
  assert.doesNotMatch(screen, /runOnboardingAnalysis|runOnboardingRecipeGeneration|commitSuccessfulScanSession|createMockScan|generateRecipeFromAnalysis/);
  const recipeBlock = flow.slice(flow.indexOf("if (state.step === 'recipe')"));
  assert.doesNotMatch(recipeBlock, /runOnboardingV4FirstScan|runOnboardingAnalysis|runOnboardingRecipeGeneration|commitSuccessfulScanSession/);
});

test('not_sure result displays only the previously resolved transformation and performs no goal mutation', () => {
  assert.match(screen, /getV4ResolvedTransformationLabel\(preferredTransformation\)/);
  assert.match(screen, /Your priority for this recipe/);
  assert.doesNotMatch(screen, /goalChips|onGoalSelected|What matters most for this recipe\?|Prioritize /);
  assert.doesNotMatch(flow, /RESULT_GOAL_SELECTED|createV4ResultGoalUpdater|writePersonalizedProfile/);
  assert.match(flow, /preferredTransformation=\{state\.draft\.notSureAnswers\.preferredTransformation\}/);
});

test('Step 09 has no interaction that can generate a second recipe, consume another result, or return to goal selection', () => {
  const recipeBlock = flow.slice(flow.indexOf("if (state.step === 'recipe')"));
  assert.doesNotMatch(recipeBlock, /GOAL_SELECTED|primaryGoal|runOnboardingV4FirstScan|RECIPE_READY|writeFreeRecipeConsumed/);
  assert.doesNotMatch(screen, /onGoalSelected|onPress=.*Transformation|onPress=.*Goal/);
});

test('view, save, grocery, and share actions do not mutate actual savings or macro progress', () => {
  const recipeBlock = flow.slice(flow.indexOf("if (state.step === 'recipe')"), flow.indexOf('return <View style={styles.empty}', flow.indexOf("if (state.step === 'recipe')")));
  assert.doesNotMatch(screen + recipeBlock, /incrementMoneySaved|completeRecipe|completedMeals|totalMoneySaved|macroProgress/);
  assert.match(flow, /saveRecipe\(resultRecipe\.recipeId\)/);
  assert.match(flow, /addRecipeToGrocery\(resultRecipe\.recipeId\)/);
});

test('dietary groups remain separated and warning copy never promises safety', () => {
  assert.match(screen, /dietaryPreferences\.allergies/);
  assert.match(screen, /findFoodPreferenceConflicts/);
  assert.doesNotMatch(screen, /guaranteed safe|safe to (eat|cook)/i);
});

test('result mounts no paywall and calls no purchase, entitlement, RevenueCat, or notification API', () => {
  assert.doesNotMatch(screen, /Paywall|RevenueCat|Purchases|purchasePackage|restorePurchases|entitlement|Notifications|requestPermissionsAsync/);
  assert.doesNotMatch(flow.slice(flow.indexOf("if (state.step === 'recipe')")), /<Paywall|purchasePackage|restorePurchases|Notifications/);
});

test('result cost language and formula use Eating out minus make at home', () => {
  assert.match(screen, /label="Eating out"/);
  assert.match(screen, /eatingOut - homemade/);
  assert.doesNotMatch(screen, /Restaurant estimate/);
});

test('retained V3 result and main navigator do not directly import or mount the V4 result', () => {
  for (const path of ['src/onboarding-v3/screens/OnboardingRecipePreview.tsx', 'src/navigation/AppNavigator.tsx']) {
    assert.doesNotMatch(read(path), /FreeRecipeResultScreen|onboardingV4Result/);
  }
  assert.match(read('src/config/devFlags.ts'), /export const ONBOARDING_V4_ENABLED = true;/);
});

test('Step 09 result emits the selected action but never mounts the Step 10 paywall itself', () => {
  assert.match(flow, /onboardingV4MeaningfulActionSelectedEvent/);
  assert.doesNotMatch(screen, /paywall|upsell/i);
  assert.doesNotMatch(screen, /V4PaywallScreen|purchasePackage|restorePurchases/);
});
