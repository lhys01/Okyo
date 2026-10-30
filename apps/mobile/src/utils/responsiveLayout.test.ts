import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getMainTabScrollClearance, getNameFoxLayout, getOnboardingGoalCardLayout, getRecipeScrollBottomPadding, getScanLoadingVisualHeight, getScanPhotoPreviewHeight } from './responsiveLayout';

const branchScaffold = readFileSync(join(__dirname, '../onboarding-v3/branch-ui/BranchScaffold.tsx'), 'utf8');
const onboardingUi = readFileSync(join(__dirname, '../components/onboarding/OnboardingUI.tsx'), 'utf8');
const analyzingScreen = readFileSync(join(__dirname, '../onboarding-v3/screens/AnalyzingScreen.tsx'), 'utf8');
const resultScreen = readFileSync(join(__dirname, '../screens/ResultSummaryScreen.tsx'), 'utf8');
const saveMoneyScreen = readFileSync(join(__dirname, '../onboarding-v3/screens/SaveMoneyBranchScreen.tsx'), 'utf8');

test('responsive visual sizes stay bounded on SE, 16e, and 17 Pro viewport heights', () => {
  const heights = [667, 844, 874];
  const loadingHeights = heights.map(getScanLoadingVisualHeight);
  const previewHeights = heights.map(getScanPhotoPreviewHeight);
  const foxLayouts = heights.map(getNameFoxLayout);

  assert.deepEqual(loadingHeights, [227, 280, 280]);
  assert.deepEqual(previewHeights, [247, 312, 323]);
  assert.deepEqual(foxLayouts, [
    { artworkHeight: 287, contentTop: 167 },
    { artworkHeight: 350, contentTop: 190 },
    { artworkHeight: 350, contentTop: 190 },
  ]);
  assert.ok(loadingHeights.every((height) => height <= 280));
  assert.ok(previewHeights.every((height) => height >= 180 && height <= 330));
});

test('focused recipe result scroll tail clears only the safe area while regular tab screens retain nav clearance', () => {
  assert.equal(getMainTabScrollClearance(0), 160);
  assert.equal(getMainTabScrollClearance(34), 194);
  assert.equal(getRecipeScrollBottomPadding(0), 24);
  assert.equal(getRecipeScrollBottomPadding(34), 58);
  assert.match(resultScreen, /getRecipeScrollBottomPadding\(insets\.bottom\)/);
  assert.match(resultScreen, /<ScrollView/);
});

test('three onboarding goal cards fit compact phones without changing the 17 Pro baseline', () => {
  assert.deepEqual(getOnboardingGoalCardLayout(812), { minHeight: 136, paddingVertical: 16, gap: 12 });
  assert.deepEqual(getOnboardingGoalCardLayout(844), { minHeight: 136, paddingVertical: 16, gap: 12 });
  assert.deepEqual(getOnboardingGoalCardLayout(874), { minHeight: 176, paddingVertical: 20, gap: 14 });
  assert.equal(3 * getOnboardingGoalCardLayout(844).minHeight + 2 * getOnboardingGoalCardLayout(844).gap, 432);
});

test('onboarding questions and scan states retain intrinsic content in scrollable layouts', () => {
  assert.match(branchScaffold, /<KeyboardAvoidingView behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(branchScaffold, /<ScrollView[\s\S]*?keyboardShouldPersistTaps="handled"/);
  assert.match(branchScaffold, /scrollBody: \{ flexBasis: 'auto', flexGrow: 1, flexShrink: 0 \}/);
  assert.match(saveMoneyScreen, /What should your recipes prioritize\?[\s\S]*?layout="priorityGrid"[\s\S]*?householdBlock/);
  assert.match(onboardingUi, /shellContent: \{[\s\S]*?flexBasis: 'auto',[\s\S]*?flexShrink: 0/);
  assert.doesNotMatch(onboardingUi, /OnboardingScreenShell canGoBack=\{false\} progress=\{progress\} scroll=\{false\}/);
  assert.match(analyzingScreen, /<ScrollView contentContainerStyle=\{styles\.content\}/);
  assert.match(onboardingUi, /loadingUserImageStage: \{[\s\S]*?aspectRatio: 1\.45,[\s\S]*?maxHeight: 230/);
  assert.match(onboardingUi, /resultImageCard: \{[\s\S]*?aspectRatio: 1\.35,[\s\S]*?maxHeight: 256/);
});
