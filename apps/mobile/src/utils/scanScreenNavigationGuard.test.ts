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

test('HomeScreen hero-card fallback and empty-state never target ScanScreen', () => {
  const source = readScreenSource('HomeScreen.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  assert.match(source, /onPress=\{heroRecipe \? \(\) => openRecipe\(heroRecipe\) : openScan\}/);
  assert.match(source, /onPress=\{openScan\}/);
  assert.match(source, /void openCameraImmediately\(\)/);
});

test('ChallengeCompleteScreen empty-state routes to Home', () => {
  assert.match(readScreenSource('ChallengeCompleteScreen.tsx'), /screen:\s*'HomeScreen'/);
});

test('LibraryScreen empty-state routes to Home', () => {
  assert.match(readScreenSource('LibraryScreen.tsx'), /screen:\s*'HomeScreen'/);
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

test('SavingsDashboardScreen routes to Home', () => {
  assert.match(readScreenSource('SavingsDashboardScreen.tsx'), /screen:\s*'HomeScreen'/);
});

test('ResultSummaryScreen never references ScanScreen in any branch', () => {
  const source = readScreenSource('ResultSummaryScreen.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  assert.match(source, /screen:\s*'HomeScreen'/);
});

test('AnalysisLoadingScreen back button and failure actions target HomeScreen, never ScanScreen', () => {
  const source = readScreenSource('AnalysisLoadingScreen.tsx');
  assert.equal(source.includes('ScanScreen'), false);
  assert.match(source, /screen:\s*'HomeScreen'/);
});

test('AnalysisLoadingScreen terminal-status navigation only fires for a successful outcome', () => {
  const source = readScreenSource('AnalysisLoadingScreen.tsx');
  assert.match(source, /outcome !== 'success'/);
  assert.match(source, /ResultSummaryScreen/);
});

test('no user-facing component imports the deleted ScanScreen module', () => {
  const offenders = walkSourceFiles(srcDir)
    .filter((file) => /from ['"].*ScanScreen['"]/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(srcDir, file));

  assert.deepEqual(offenders, []);
});
