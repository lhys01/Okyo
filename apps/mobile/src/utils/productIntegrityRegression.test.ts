import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string) {
  return readFileSync(path.join(srcDir, relativePath), 'utf8');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test('ResultSummary ingredient rows use collision-safe deterministic keys', () => {
  const resultSource = read('screens/ResultSummaryScreen.tsx');

  assert.match(resultSource, /key=\{getIngredientRowKey\(ingredient, index\)\}/);
  assert.match(resultSource, /function getIngredientRowKey\([\s\S]{0,500}index/);
  assert.doesNotMatch(resultSource, /key=\{`\$\{ingredient\.quantity\}-\$\{ingredient\.name\}`\}/);
});

test('Home sections and curated idea grid stays in the required order', () => {
  const home = read('screens/HomeScreen.tsx');
  const recommendations = read('data/recommendedRecipes.ts');
  const recommendationCard = read('components/RecommendationCard.tsx');
  const scanEntry = read('components/okyo/ScanFab.tsx');

  assert.ok(home.indexOf('<WeekStrip') < home.indexOf('<MetricCarousel'));
  assert.ok(home.indexOf('<MetricCarousel') < home.indexOf('Recent dishes'));
  assert.ok(home.indexOf('Recent dishes') < home.indexOf('Today’s ideas'));
  assert.match(home, /HOME_IDEA_RECIPE_IDS/);
  assert.match(home, /getHourlyIdeas\(/);
  assert.match(home, /scheduleHourlyRefresh/);
  // Home surfaces exactly two ideas and rotates the pair every hour.
  assert.match(home, /HOME_IDEA_COUNT = 2/);
  assert.match(home, /setIdeaHour\(new Date\(\)\.getHours\(\)\)/);
  assert.match(home, /<RecommendationCard[\s\S]*compact/);
  assert.match(home, /styles\.ideasGrid/);
  // Two ideas render as a single row rather than a stacked 2x2 grid.
  assert.match(home, /mealIdeas\.map\(/);
  assert.doesNotMatch(home, /mealIdeas\.slice\(2, 4\)/);
  assert.match(home, /styles\.ideasRow/);
  assert.doesNotMatch(home, /ideasGrid:[\s\S]{0,180}flexWrap/);
  assert.doesNotMatch(home, /latestScanRecipe|savedRecipeIds|mockRecipes/);
  assert.match(recommendations, /return source\.slice\(0, limit\)/);
  assert.match(recommendationCard, /compactCard:[\s\S]*flex: 1,[\s\S]*height: 222,[\s\S]*minWidth: 0/);
  // Taller photography: the image must dominate the card.
  assert.match(recommendationCard, /compactArt:[\s\S]*height: 138/);
  assert.match(recommendationCard, /numberOfLines=\{2\} style=\{styles\.title\}/);
  assert.match(recommendationCard, /numberOfLines=\{1\}[\s\S]*style=\{styles\.meta\}/);
  assert.ok(scanEntry.indexOf('label="Take photo"') < scanEntry.indexOf('label="Upload photo"'));
  assert.match(scanEntry, /label="Upload photo"[\s\S]*label="Describe a dish"/);
  assert.match(scanEntry, /minHeight: 72/);
});

test('tabs cannot detach into an unexplained blank scene', () => {
  const tabs = read('navigation/MainTabs.tsx');

  assert.match(tabs, /if \(!hasHydrated\)/);
  assert.match(tabs, /Loading your recipes/);
  assert.match(tabs, /detachInactiveScreens=\{false\}/);
  assert.match(tabs, /animation: 'none'/);
  assert.match(tabs, /lazy: false/);
  for (const screen of ['HomeScreen', 'GroceryListScreen', 'LibraryScreen', 'SettingsScreen']) {
    assert.match(tabs, new RegExp(`name="${screen}" component=\\{${screen}\\}`));
  }
});

test('Liked has an explicit empty state and canonical-only references', () => {
  const library = read('screens/LibraryScreen.tsx');
  const tabs = read('navigation/MainTabs.tsx');
  const likeButton = read('components/RecipeLikeButton.tsx');

  assert.match(library, /safeSavedRecipes\.length === 0/);
  assert.match(library, /No liked recipes yet/);
  assert.match(library, /Save recipes you love and they'll show up here\./);
  assert.match(library, /Explore recipes/);
  assert.match(library, /liked-empty-kiko\.png/);
  assert.match(library, /resolveCanonicalRecipes\(recipesById, savedRecipeIds\)/);
  assert.doesNotMatch(library, /recommendedRecipes|mockRecipes/);
  assert.match(tabs, /LibraryScreen: 'Liked'/);
  assert.match(tabs, /focused[\s\S]*HeartSolid/);
  assert.match(likeButton, /'Unlike recipe' : 'Like recipe'/);
  assert.match(likeButton, /isReduceMotionEnabled/);
  assert.match(likeButton, /Animated\.sequence/);
});

test('persisted legacy collections are sanitized before tabs render', () => {
  const store = read('state/useOkyoStore.ts');

  assert.match(store, /sanitizePersistedCanonicalState/);
  assert.match(store, /isMockOrDemoRecipe\(value\)/);
  assert.match(store, /recipe\.origin === 'scan' \|\| recipe\.origin === 'description'/);
  assert.match(store, /recipe\.isSaved === true && typeof recipe\.savedAt === 'string'/);
  assert.match(store, /sanitizeCompletedMeals\(state\.completedMeals\)/);
  assert.match(store, /migrateLegacyCompletedMeals\(recipesById\)/);
  assert.match(store, /version: 4/);
});

test('dashboard distinguishes active cooking from ordinary recipe activity', () => {
  const home = read('screens/HomeScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  const overview = read('components/RecipeAssistantOverview.tsx');
  const store = read('state/useOkyoStore.ts');

  assert.match(home, /activeCookingSession/);
  assert.match(home, /buildGuidedCookingSteps/);
  assert.match(home, /Cooking now/);
  assert.match(home, /classifyRecipeStepTiming/);
  assert.match(home, /Hands-on[\s\S]*waiting[\s\S]*Waiting/);
  assert.doesNotMatch(home, /from '\.\/RecipeDetailScreen'/);
  assert.match(home, /ActiveCookingCard/);
  assert.match(home, /Continue cooking/);
  assert.match(home, /currentStepIndex/);
  assert.match(home, /filter\(\(recipe\) => recipe\.id !== activeCookingSession\?\.recipeId\)/);
  assert.match(home, /formatRecipeDuration\(timing\.totalMinutes\)/);
  assert.match(store, /activeCookingSession: ActiveCookingSession \| null/);
  assert.match(store, /updateCookingStep/);
  assert.match(store, /activeCookingSession: state\.activeCookingSession/);
  assert.match(detail, /activeCookingSession\?\.currentStepIndex/);
  assert.match(detail, /buildGuidedCookingSteps/);
  assert.match(detail, /<RecipeQuickFacts recipe=\{recipe\}/);
  assert.match(overview, /'Active'/);
  assert.match(overview, /'Total'/);
  assert.match(overview, /'Ready'/);
  assert.match(detail, /const goToStep = \(nextIndex: number\)[\s\S]{0,500}updateCookingStep\(recipe\.id, clampedIndex, guidedSteps\.length\)/);
  assert.match(detail, /completeRecipe\(recipe\.id\)/);
  assert.match(detail, /End Cooking/);
});

test('all cooking entry points use the shared guided-step builder', () => {
  const home = read('screens/HomeScreen.tsx');
  const result = read('screens/ResultSummaryScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  const utility = read('utils/guidedCookingSteps.ts');

  assert.match(utility, /export function buildGuidedCookingSteps\(recipe/);
  assert.match(home, /import \{ buildGuidedCookingSteps \} from '\.\.\/utils\/guidedCookingSteps'/);
  assert.match(result, /import \{ buildGuidedCookingSteps \} from '\.\.\/utils\/guidedCookingSteps'/);
  assert.match(detail, /import \{ buildGuidedCookingSteps/);
  assert.doesNotMatch(home, /getGuidedCookingSteps\(/);
  assert.doesNotMatch(result, /getGuidedCookingSteps\(/);
  assert.doesNotMatch(detail, /getGuidedCookingStepsLegacy|legacyGuidedStepCleanupPlaceholder/);
  assert.match(detail, /if \(!hasHydrated\)/);
  assert.match(detail, /const goToStep = \(nextIndex: number\)[\s\S]{0,500}updateCookingStep/);
  assert.doesNotMatch(detail, /useEffect\(\(\) => \{[\s\S]{0,300}updateCookingStep/);
});

test('Result hides steps, starts Guided Cooking directly, and keeps exact correction copy', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const overview = read('components/RecipeAssistantOverview.tsx');

  assert.doesNotMatch(result, /recipe\.steps\.map/);
  assert.match(result, /startCookingRecipe\(selectedRecipe\.id\)/);
  assert.match(result, /screen: 'RecipeStepsScreen'/);
  assert.match(result, /completion: false/);
  assert.match(result, /recipeId: selectedRecipe\.id/);
  assert.match(result, /placeholder="Describe the change you want…"/);
  assert.match(result, />Customize recipe</);
  assert.match(result, />Describe the change you want</);
  assert.match(result, /'Update Recipe'/);
  assert.doesNotMatch(result, /Use what I have|Make cheaper|Make faster|Make healthier|More protein/);
  assert.match(result, /value=\{correctionText\}/);
  assert.match(result, /disabled=\{isCorrecting \|\| !canSubmit\}/);
  assert.match(result, /setCorrectionError\(CORRECTION_FAILURE_MESSAGE\)/);
  assert.match(result, /correctionInFlightRef\.current/);
  const correctionCatch = result.slice(
    result.indexOf('    } catch {', result.indexOf('const submitCorrection')),
    result.indexOf('    } finally {', result.indexOf('const submitCorrection')),
  );
  assert.doesNotMatch(correctionCatch, /setCorrectionText/);
  assert.match(result, /<RecipeNutritionCards nutrition=\{selectedRecipe\.nutritionEstimate\}/);
  assert.match(result, /<RecipeCostSummary/);
  assert.match(overview, /Homemade Estimate/);
});

test('photo and description results preserve origin handling with one honest loading presentation', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const loading = read('screens/AnalysisLoadingScreen.tsx');

  assert.match(result, /latestScanRecipe\?\.origin === 'description'/);
  assert.match(result, /\{!isDescriptionScan \? \([\s\S]*<FoodImageCard/);
  assert.doesNotMatch(result, /DishConfirmationCard|isPhotoScan && !hasConfirmedIdentification/);
  assert.doesNotMatch(result, /Built from your meal description/);
  assert.match(result, /styles\.descriptionTitle/);
  assert.doesNotMatch(result, />\s*Result\s*</);

  assert.match(loading, /\{!isDescriptionScan && stableScanImageUri \? \(/);
  assert.match(loading, /Okyo is scanning your food/);
  assert.match(loading, /assets\/onboarding-ex\/icon\.png/);
  assert.doesNotMatch(loading, /KikoMascot|mascotName/);
  assert.doesNotMatch(loading, />\s*Analyzing\s*</);
});

test('Quick Check keeps one generic customization route on Result and Recipe Detail', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  const canonical = read('state/canonicalRecipes.ts');

  assert.doesNotMatch(result, /confirmRecipeIdentification\(selectedRecipe\.id\)/);
  assert.match(result, /<RecipePrimaryActions[\s\S]*onCustomize=\{revealCorrectionInput\}/);
  assert.doesNotMatch(result, /<EditRecipeAction/);
  assert.match(result, /<RecipeEditCard[\s\S]*correctionText=\{correctionText\}/);
  assert.match(result, /setCorrectionText\(''\)[\s\S]*setCorrectionError\(null\)/);
  assert.match(result, /getRecipeCorrectionSourceId\(selectedRecipe\)/);
  assert.match(detail, /navigation\.navigate\('MainTabs', \{ screen: 'ResultSummaryScreen'/);
  assert.match(detail, /onCustomize=\{openRecipeEditor\}/);
  assert.doesNotMatch(detail, /accessibilityLabel="Edit recipe"/);
  assert.match(canonical, /identificationConfirmedAt\?: string/);
  assert.match(canonical, /sourceRecipeId: normalizedRecipe\.id/);
});

test('photo confirmation stays compact without reducing touch targets', () => {
  const result = read('screens/ResultSummaryScreen.tsx');

  assert.doesNotMatch(result, /Does this look right\?/);
  assert.doesNotMatch(result, /QUICK CHECK|Quick Check/);
  assert.doesNotMatch(result, /Does this look right\?/);
});

test('Guided Cooking is direct and Completion keeps deliberate tab access', () => {
  const detail = read('screens/RecipeDetailScreen.tsx');
  const tabs = read('navigation/MainTabs.tsx');

  assert.match(detail, /getConciseGuidedInstruction\(activeStep\.instruction\)/);
  assert.match(detail, /guidedTotalTime[\s\S]*min total/);
  assert.match(detail, /style=\{styles\.guidedInstructionScroll\}/);
  assert.match(detail, /maxFontSizeMultiplier=\{1\.5\}/);
  assert.doesNotMatch(
    detail.slice(
      detail.indexOf('style={styles.guidedInstructionScroll}'),
      detail.indexOf('</ScrollView>', detail.indexOf('style={styles.guidedInstructionScroll}')),
    ),
    /adjustsFontSizeToFit|minimumFontScale|numberOfLines/,
  );
  assert.match(detail, /guidedInstruction:[\s\S]{0,180}fontSize: 17,[\s\S]{0,100}lineHeight: 25/);
  assert.match(detail, /guidedInstructionScroll:[\s\S]{0,180}maxHeight: 320/);
  assert.match(detail, /activeStep\.doneWhen/);
  assert.match(detail, /activeStep\.commonMistake/);
  assert.match(detail, /import \{ getConciseGuidedInstruction \} from '\.\.\/utils\/guidedInstruction'/);
  assert.doesNotMatch(detail, /<GuidedChipGroup/);
  assert.doesNotMatch(detail, new RegExp(['Why', 'this', 'matters'].join('\\s+'), 'i'));
  assert.doesNotMatch(detail, new RegExp(['Avoid', 'this'].join('\\s+'), 'i'));
  assert.match(detail, /recipe\?\.origin === 'scan'[\s\S]*getRealScanImageUri\(recipe\.originalImage\)/);
  assert.match(detail, /<CompletionRecipeImage uri=\{completionImageUri\}/);
  assert.doesNotMatch(detail, />\s*Done\s*</);
  assert.match(detail, /setCompletionVisible\(true\)/);
  assert.match(tabs, /completion !== true/);
  assert.match(tabs, /shouldHideMainTabBar/);
});

test('recipe mode selection stores an honest presentation choice without replacing recipe data', () => {
  const detail = read('screens/RecipeDetailScreen.tsx');
  const canonical = read('state/canonicalRecipes.ts');
  const store = read('state/useOkyoStore.ts');

  assert.match(detail, /const selectedMode = getSafeRecipeMode\(recipe\?\.selectedMode \?\? routeMode \?\? storeSelectedMode\)/);
  assert.match(canonical, /'Normal',[\s\S]*'Lighter',[\s\S]*'Healthier',[\s\S]*'More Protein'/);
  assert.match(detail, /setRecipePresentationMode\(recipe\.id, mode\)/);
  assert.match(detail, /Update ingredients, quantities, instructions, nutrition, cost/);
  assert.match(store, /setCanonicalRecipePresentationMode/);
});

test('forbidden copy and decorative emoji are absent from mobile source', () => {
  const thisFile = fileURLToPath(import.meta.url);
  const files = sourceFiles(srcDir).filter((file) => file !== thisFile);
  const forbidden = [
    /why you.?ll love this/i,
    new RegExp(['flavor', 'notes'].join('\\s+'), 'i'),
    /inspired[- ]by/i,
    /restaurant[- ]inspired/i,
    /restaurant[- ]style/i,
    new RegExp(['easy', 'swaps'].join('\\s+'), 'i'),
    new RegExp(['why', 'this', 'matters'].join('\\s+'), 'i'),
    new RegExp(['avoid', 'this'].join('\\s+'), 'i'),
  ];
  const decorativeEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const phrase of forbidden) {
      assert.equal(phrase.test(source), false, `${path.relative(srcDir, file)} contains forbidden copy`);
    }
    assert.equal(
      decorativeEmoji.test(source),
      false,
      `${path.relative(srcDir, file)} contains decorative emoji`,
    );
  }
});

test('prepared-dish rejection copy is aligned across the V3 client and API', () => {
  const controller = read('onboarding-v3/controller/useOnboardingV3Controller.ts');
  const api = readFileSync(path.join(srcDir, '..', '..', 'api', 'src', 'services', 'aiService.ts'), 'utf8');
  const message = "Scan a prepared dish you'd like to recreate.";
  assert.match(controller, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(api, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
