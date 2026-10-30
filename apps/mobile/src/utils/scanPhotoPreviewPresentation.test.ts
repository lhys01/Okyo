import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8');
}

test('photo confirmation centers the full image in a rounded, responsive frame', () => {
  const current = read('onboarding-v3/screens/PhotoConfirmScreen.tsx');
  const legacy = read('screens/onboarding/PhotoConfirmScreen.tsx');

  assert.match(current, /contentFit="contain" source=\{\{ uri: photoUri \}\}/);
  assert.match(current, /previewFrame: \{[^}]*borderRadius: 28[^}]*overflow: 'hidden'/);
  assert.doesNotMatch(current, /contentFit="cover" source=\{\{ uri: photoUri \}\}/);

  assert.match(legacy, /resizeMode="contain"/);
  assert.match(legacy, /getScanPhotoPreviewHeight\(windowHeight\)/);
  assert.match(legacy, /frame: \{[\s\S]*?borderRadius: 18[\s\S]*?overflow: 'hidden'/);
});

test('loading previews fill the rounded frame while preserving image proportions', () => {
  const analysis = read('screens/AnalysisLoadingScreen.tsx');
  const firstScan = read('onboarding-v3/screens-v4/FirstScanAnalyzingScreen.tsx');
  const legacyLoading = read('components/onboarding/OnboardingUI.tsx');
  const v3Loading = read('onboarding-v3/screens/AnalyzingScreen.tsx');

  assert.match(analysis, /resizeMode="cover"\s+source=\{\{ uri: stableScanImageUri \}\}/);
  assert.match(analysis, /scanImageWrap: \{[\s\S]*?borderRadius: 30[\s\S]*?overflow: 'hidden'/);
  assert.match(firstScan, /contentFit="contain" source=\{\{ uri: imageUri \}\}/);
  assert.match(firstScan, /food: \{[^}]*borderRadius: radius\.hero/);
  assert.match(legacyLoading, /uri: stableUserImageUri \}\}[^>]*resizeMode="contain"/);
  assert.match(v3Loading, /<VideoView[\s\S]*?<Image accessibilityLabel="Dish being scanned" contentFit="contain" source=\{\{ uri: photoUri \}\}/);
});

test('scan results and failure previews use centered cover sizing like reopened recipe detail', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const onboardingResult = read('onboarding-v3/screens-v4/FreeRecipeResultScreen.tsx');
  const legacyResult = read('components/onboarding/OnboardingUI.tsx');

  assert.match(result, /selectedScanImageUri \}\} resizeMode="cover" style=\{styles\.standaloneScanPreview\}/);
  assert.match(result, /uri: imageUri \}\} resizeMode="cover" style=\{styles\.foodImage\}/);
  assert.match(onboardingResult, /contentFit="contain" source=\{\{ uri: imageUri \}\} style=\{styles\.hero\}/);
  assert.match(legacyResult, /uri: imageUri \}\} resizeMode="contain" style=\{styles\.resultImage\}/);

});
