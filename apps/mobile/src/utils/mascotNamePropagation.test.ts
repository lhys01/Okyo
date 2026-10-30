import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const srcRoot = resolve(process.cwd(), 'src');

test('user-facing mascot copy resolves the persisted mascot name', () => {
  const sites = [
    'utils/recipeCorrection.ts',
    'utils/scanFailureCopy.ts',
    'screens/KitchenLetterScreen.tsx',
  ];

  for (const site of sites) {
    const source = readFileSync(resolve(srcRoot, site), 'utf8');
    assert.match(source, /mascotName/, `${site} must use the persisted mascot name`);
  }

  const resultSummary = readFileSync(resolve(srcRoot, 'screens/ResultSummaryScreen.tsx'), 'utf8');
  assert.match(resultSummary, /validateCorrectionNote\(correctionNote, mascotName\)/);

  const analysisLoading = readFileSync(resolve(srcRoot, 'screens/AnalysisLoadingScreen.tsx'), 'utf8');
  assert.match(analysisLoading, /getInlineFailureCopy\(failureCategory, isDescriptionScan, mascotName\)/);
  assert.doesNotMatch(analysisLoading, /KikoMascot/);
  assert.match(analysisLoading, /const okyoAppIcon = require\('\.\.\/\.\.\/assets\/app-icon\/icon\.png'\)/);
  assert.match(analysisLoading, /source=\{okyoAppIcon\}/);
});

test('internal Kiko asset, component, and analytics identifiers stay literal', () => {
  const assetSource = readFileSync(resolve(srcRoot, 'assets/kikoAssets.ts'), 'utf8');
  const componentSource = readFileSync(resolve(srcRoot, 'components/KikoMascot.tsx'), 'utf8');
  const analyticsSource = readFileSync(resolve(srcRoot, 'analytics/track.ts'), 'utf8');

  assert.match(assetSource, /kiko/i);
  assert.match(componentSource, /KikoMascot/);
  assert.doesNotMatch(analyticsSource, /\$\{mascotName\}|`[^`]*mascotName/);
});

test('user-facing fox copy has no fixed Kiko name', () => {
  const sites = [
    'screens/AnalysisLoadingScreen.tsx',
    'screens/onboarding/IntroScreen.tsx',
    'screens/onboarding/ScanEntryScreen.tsx',
    'screens/onboarding/PhotoConfirmScreen.tsx',
    'screens/onboarding/SetupScreen.tsx',
    'screens/PersonalizationScreen.tsx',
    'components/onboarding/OnboardingUI.tsx',
    'utils/scanFailureCopy.ts',
    'utils/scanFailureReason.ts',
    'utils/recipeCorrection.ts',
    'tour/CoachDock.tsx',
  ];
  for (const site of sites) {
    const source = readFileSync(resolve(srcRoot, site), 'utf8');
    assert.doesNotMatch(source, /['"`]Kiko\b|\bKiko (?:is|will|can|couldn)/, `${site} must not render the fixed fox name`);
  }
});
