import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

// App-wide regression guard: the legacy ScanScreen "What are we remaking
// today?" UI must be unreachable from anywhere in the app. This is a
// source-inspection sweep (not a component render test) because these
// screens pull in React Native modules that can't execute under the plain
// Node test runtime used here — see scanController.test.ts, which only
// imports the RN-free scanControllerUtils module for the same reason.
//
// Supersedes the narrower analysisNavigationGuard.test.ts, which only
// checked AnalysisLoadingScreen and ResultSummaryScreen.

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function isTestFile(fileName: string) {
  return fileName.endsWith('.test.ts') || fileName.endsWith('.test.tsx');
}

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkSourceFiles(fullPath, files);
    } else if (/\.tsx?$/.test(entry) && !isTestFile(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function readScreenSource(fileName: string) {
  return readFileSync(path.join(srcDir, 'screens', fileName), 'utf8');
}

function readNavigationSource(fileName: string) {
  return readFileSync(path.join(srcDir, 'navigation', fileName), 'utf8');
}

test('ScanScreen.tsx no longer exists in the source tree', () => {
  assert.equal(existsSync(path.join(srcDir, 'screens', 'ScanScreen.tsx')), false);
});

test('no production source file anywhere in the app references ScanScreen', () => {
  const offenders = walkSourceFiles(srcDir)
    .filter((file) => readFileSync(file, 'utf8').includes('ScanScreen'))
    .map((file) => path.relative(srcDir, file));

  assert.deepEqual(offenders, []);
});

test('navigation registry no longer declares a ScanScreen route anywhere', () => {
  for (const fileName of ['AppNavigator.tsx', 'MainTabs.tsx', 'types.ts']) {
    assert.equal(readNavigationSource(fileName).includes('ScanScreen'), false, `${fileName} still references ScanScreen`);
  }
});

test('HomeScreen scan-entry controls never target ScanScreen', () => {
  const source = readScreenSource('HomeScreen.tsx');
  const tabs = readNavigationSource('MainTabs.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  assert.equal(tabs.includes('ScanScreen'), false);
  assert.match(tabs, /onTakePhoto=\{\(\) => void startPickedScan\('camera'\)\}/);
  assert.match(tabs, /onUpload=\{\(\) => void startPickedScan\('photos'\)\}/);
  assert.match(tabs, /onDescribeMeal=\{\(\) => rootNavigation\.navigate\('DescribeMealScreen'\)\}/);
  // The single sheet and its scan hook are owned by MainTabs; Home opens it
  // through the shared context rather than mounting a second modal instance.
  assert.match(tabs, /useStartPickedScan/);
  assert.equal((tabs.match(/<ScanActionSheet\b/g) ?? []).length, 1);
  assert.match(readScreenSource('HomeScreen.tsx'), /useOpenScanActionSheet/);
  assert.match(
    readFileSync(path.join(srcDir, 'hooks', 'useStartPickedScan.ts'), 'utf8'),
    /HOME_UPLOAD_TARGET_SCREEN/,
  );
});

test('ChallengeCompleteScreen empty-state routes to Home', () => {
  assert.match(readScreenSource('ChallengeCompleteScreen.tsx'), /screen:\s*'HomeScreen'/);
});

test('LibraryScreen empty-state routes to Food Inspiration', () => {
  assert.match(readScreenSource('LibraryScreen.tsx'), /screen:\s*'RestaurantPacksScreen'/);
});

test('GoalScreen routes to Home after goal selection', () => {
  assert.match(readScreenSource('GoalScreen.tsx'), /screen:\s*'HomeScreen'/);
});

test('ShareCardPreviewScreen routes to Home for both the back fallback and the empty state', () => {
  const source = readScreenSource('ShareCardPreviewScreen.tsx');
  const matches = source.match(/screen:\s*'HomeScreen'/g) ?? [];
  assert.equal(matches.length >= 2, true, `expected at least 2 HomeScreen destinations, found ${matches.length}`);
});

test('RecipeDetailScreen fallbacks (back, missing-recipe, missing-steps) never target ScanScreen', () => {
  const source = readScreenSource('RecipeDetailScreen.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  const matches = source.match(/screen:\s*'HomeScreen'/g) ?? [];
  assert.equal(matches.length >= 3, true, `expected at least 3 HomeScreen destinations, found ${matches.length}`);
});

test('Guided Cooking exits to a reset Home tab instead of leaving Recipe Steps active', () => {
  const source = readScreenSource('RecipeDetailScreen.tsx');
  const tabs = readFileSync(path.resolve(process.cwd(), 'src/navigation/MainTabs.tsx'), 'utf8');
  assert.match(source, /import \{ getHomeResetState \} from '\.\.\/utils\/scanControllerUtils'/);
  assert.match(source, /const resetToHome = \(\) => \{[\s\S]{0,320}rootNavigation\.reset\(getHomeResetState\(\)\)/);
  assert.match(source, /const goHomeFromCompletion = \(\) => \{[\s\S]{0,120}resetToHome\(\)/);
  assert.match(source, /End Session[\s\S]{0,240}resetToHome\(\)/);
  assert.match(tabs, /routeName === 'HomeScreen'[\s\S]{0,220}focusedRoute\?\.name === 'RecipeStepsScreen'[\s\S]{0,200}rootNavigation\?\.reset\(getHomeResetState\(\)\)/);
});

test('SavingsDashboardScreen routes to Home', () => {
  assert.match(readScreenSource('SavingsDashboardScreen.tsx'), /screen:\s*'HomeScreen'/);
});

test('ResultSummaryScreen never references ScanScreen in any branch', () => {
  const source = readScreenSource('ResultSummaryScreen.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  assert.match(source, /getHomeResetState/);
  assert.match(source, /rootNavigation\.reset\(getFreshDescribeMealResetState\(\)\)/);
  assert.match(source, /rootNavigation\.reset\(getHomeResetState\(\)\)/);
});

test('fresh scan-entry screens reset to Home on Back or cancel', () => {
  assert.match(readScreenSource('DescribeMealScreen.tsx'), /navigation\.reset\(getHomeResetState\(\)\)/);
  assert.doesNotMatch(readScreenSource('AnalysisLoadingScreen.tsx'), /getHomeResetState/);
});

test('AnalysisLoadingScreen renders its safe-area back button and preserves scan actions', () => {
  const source = readScreenSource('AnalysisLoadingScreen.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  assert.match(source, /import \{ BackButton \} from '\.\.\/components\/okyo\/BackButton'/);
  assert.match(source, /<SafeAreaView style=\{styles\.safeArea\}>\s*<View style=\{styles\.topBar\}>\s*<BackButton onPress=\{handleGoBack\} \/>\s*<\/View>\s*<ScrollView/);
  assert.match(source, /style=\{styles\.scroll\}/);
  assert.match(source, /topBar:\s*\{[\s\S]{0,180}height:\s*48[\s\S]{0,100}paddingHorizontal:\s*18/);
  assert.match(source, /Try again/);
  assert.match(source, /Choose another photo/);
});

test('AnalysisLoadingScreen back action cancels and clears the active scan before returning', () => {
  const source = readScreenSource('AnalysisLoadingScreen.tsx');
  const backButton = readFileSync(path.join(srcDir, 'components', 'okyo', 'BackButton.tsx'), 'utf8');
  const backHandler = source.match(/const handleGoBack = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.match(backButton, /accessibilityLabel="Go back"/);
  assert.match(backHandler, /didCancel\.current = true/);
  assert.match(backHandler, /cancelScanSession\(sessionId, 'AnalysisLoadingScreen\.back'\)/);
  assert.ok(backHandler.indexOf('cancelScanSession') < backHandler.indexOf('navigation.goBack()'));
  assert.match(source, /if \(didCancel\.current \|\| !navigation\.isFocused\(\)\) return/);
});

test('AnalysisLoadingScreen terminal-status navigation only fires for a successful outcome', () => {
  const source = readScreenSource('AnalysisLoadingScreen.tsx');
  assert.match(source, /outcome !== 'success'/);
  assert.match(source, /getScanResultNavigationTarget\(/);
});

test('AnalysisLoadingScreen shows category-specific failure details and hides progress', () => {
  const source = readScreenSource('AnalysisLoadingScreen.tsx');
  assert.match(source, /!isFailure \? \([\s\S]*accessibilityRole="progressbar"/);
  assert.match(source, /getInlineFailureCopy\(failureCategory, isDescriptionScan, mascotName\)/);
  assert.match(source, /numberOfLines=\{2\} style=\{styles\.failureBody\}>\{failureCopy\.body\}/);
  assert.match(source, /borderRadius: 28/);
  assert.match(source, /overflow: 'hidden'/);
});

test('no user-facing component imports the deleted ScanScreen module', () => {
  const offenders = walkSourceFiles(srcDir)
    .filter((file) => /from ['"].*ScanScreen['"]/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(srcDir, file));

  assert.deepEqual(offenders, []);
});
