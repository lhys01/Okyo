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

test('Home sections and curated four-card grid stay in the required order', () => {
  const home = read('screens/HomeScreen.tsx');
  const recommendations = read('data/recommendedRecipes.ts');
  const recommendationCard = read('components/RecommendationCard.tsx');
  const scanEntry = read('components/ScanEntryOptions.tsx');

  assert.ok(home.indexOf('<HomeScanSection') < home.indexOf('Recent Recipes'));
  assert.ok(home.indexOf('Recent Recipes') < home.indexOf('Today’s Ideas'));
  assert.match(home, /getRecommendationsForMealTime\(getMealTimeForHour\(/);
  assert.match(home, /\), 4\), \[\]\)/);
  assert.match(home, /<RecommendationCard[\s\S]*compact/);
  assert.match(home, /styles\.ideasGrid/);
  assert.match(home, /mealIdeas\.slice\(0, 2\)/);
  assert.match(home, /mealIdeas\.slice\(2, 4\)/);
  assert.match(home, /styles\.ideasRow/);
  assert.doesNotMatch(home, /ideasGrid:[\s\S]{0,180}flexWrap/);
  assert.doesNotMatch(home, /latestScanRecipe|savedRecipeIds|mockRecipes/);
  assert.match(recommendations, /return source\.slice\(0, limit\)/);
  assert.match(recommendationCard, /compactCard:[\s\S]*flex: 1,[\s\S]*height: 214,[\s\S]*minWidth: 0/);
  assert.match(recommendationCard, /compactArt:[\s\S]*height: 112/);
  assert.match(recommendationCard, /numberOfLines=\{2\} style=\{styles\.title\}/);
  assert.match(recommendationCard, /numberOfLines=\{1\}[\s\S]*style=\{styles\.meta\}/);
  assert.ok(scanEntry.indexOf('label="Take photo"') < scanEntry.indexOf('label="Upload photo"'));
  assert.ok(scanEntry.indexOf('label="Upload photo"') < scanEntry.indexOf('label="Describe a meal"'));
  assert.match(scanEntry, /firstRow:[\s\S]*flexDirection: 'row'/);
  assert.match(scanEntry, /rowButton:[\s\S]*flex: 1/);
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
  assert.match(library, /No liked recipes yet\./);
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
  assert.match(store, /version: 3/);
});

test('Result hides steps, starts Guided Cooking directly, and keeps exact correction copy', () => {
  const result = read('screens/ResultSummaryScreen.tsx');

  assert.doesNotMatch(result, /recipe\.steps\.map/);
  assert.match(result, /startCookingRecipe\(selectedRecipe\.id\)/);
  assert.match(result, /screen: 'RecipeStepsScreen'/);
  assert.match(result, /completion: false/);
  assert.match(result, /recipeId: selectedRecipe\.id/);
  assert.match(result, /placeholder="Fix anything that looks wrong"/);
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
  assert.match(result, /Homemade Estimate/);
});

test('photo and description results use origin-specific presentation', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const loading = read('screens/AnalysisLoadingScreen.tsx');

  assert.match(result, /latestScanRecipe\?\.origin === 'description'/);
  assert.match(result, /\{!isDescriptionScan \? \([\s\S]*<FoodImageCard/);
  assert.match(result, /\{isPhotoScan && !hasConfirmedIdentification \? \([\s\S]*<DishConfirmationCard/);
  assert.doesNotMatch(result, /Built from your meal description/);
  assert.match(result, /styles\.descriptionTitle/);
  assert.doesNotMatch(result, />\s*Result\s*</);

  assert.match(loading, /\{!isDescriptionScan && stableScanImageUri \? \(/);
  assert.match(loading, /size=\{isDescriptionScan \? 48 : 72\}/);
  assert.doesNotMatch(loading, />\s*Analyzing\s*</);
});

test('Quick Check transitions to permanent generic recipe editing on Result and Recipe Detail', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  const canonical = read('state/canonicalRecipes.ts');

  assert.match(result, /selectedRecipe\?\.identificationConfirmedAt|latestScanRecipe\?\.identificationConfirmedAt/);
  assert.match(result, /confirmRecipeIdentification\(selectedRecipe\.id\)/);
  assert.match(result, /<EditRecipeAction onPress=\{revealCorrectionInput\}/);
  assert.match(result, /<RecipeEditCard[\s\S]*correctionText=\{correctionText\}/);
  assert.match(result, /accessibilityLabel="Edit recipe"/);
  assert.match(result, />Edit recipe</);
  assert.match(result, /setCorrectionText\(''\)[\s\S]*setCorrectionError\(null\)/);
  assert.match(result, /getRecipeCorrectionSourceId\(selectedRecipe\)/);
  assert.match(detail, /navigation\.navigate\('ResultSummaryScreen', \{ recipeId: recipe\.id \}\)/);
  assert.match(detail, /accessibilityLabel="Edit recipe"/);
  assert.match(canonical, /identificationConfirmedAt\?: string/);
  assert.match(canonical, /sourceRecipeId: normalizedRecipe\.id/);
});

test('photo Quick Check stays compact without reducing touch targets', () => {
  const result = read('screens/ResultSummaryScreen.tsx');

  assert.match(result, /confirmCard:[\s\S]{0,240}paddingVertical: 14/);
  assert.match(result, /confirmTitle:[\s\S]{0,180}fontSize: 18/);
  assert.match(result, /confirmDishName:[\s\S]{0,180}fontSize: 20/);
  assert.match(result, /confirmActions:[\s\S]{0,160}marginTop: 9/);
  assert.match(result, /confirmPrimary:[\s\S]{0,220}minHeight: 44/);
  assert.match(result, /confirmSecondary:[\s\S]{0,220}minHeight: 44/);
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
  assert.match(detail, /guidedInstruction:[\s\S]{0,180}fontSize: 20,[\s\S]{0,100}lineHeight: 29/);
  assert.match(detail, /guidedInstructionScroll:[\s\S]{0,180}maxHeight: 174/);
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
  assert.match(detail, /This choice does not change ingredients or nutrition yet\./);
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
