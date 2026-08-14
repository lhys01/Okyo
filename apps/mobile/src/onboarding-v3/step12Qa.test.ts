import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), 'src/onboarding-v3');
const sourceRoot = resolve(process.cwd(), 'src');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const readSource = (path: string) => readFileSync(resolve(sourceRoot, path), 'utf8');

test('Step 12 accessibility audit: V4 interactive screens declare labels, roles, state, and live errors where applicable', () => {
  const sources = [
    'screens-v4/PromiseScreen.tsx', 'screens-v4/PrimaryGoalScreen.tsx', 'screens-v4/BranchQuestionScreen.tsx',
    'screens-v4/MacroTargetSetupScreen.tsx', 'screens-v4/DietarySafetyScreen.tsx', 'screens-v4/PersonalPlanScreen.tsx',
    'screens-v4/FirstScanEntryScreen.tsx', 'screens-v4/FirstScanAnalyzingScreen.tsx', 'screens-v4/FreeRecipeResultScreen.tsx',
    'screens-v4/V4PaywallScreen.tsx', 'screens-v4/V4CustomizationScreen.tsx',
  ].map(read).join('\n');
  assert.match(sources, /accessibilityLabel=/);
  assert.match(sources, /accessibilityRole=/);
  assert.match(sources, /accessibilityState=/);
  assert.match(sources, /accessibilityLiveRegion=|accessibilityRole="alert"/);
});

test('Step 12 accessibility audit: animated V4 insight and question surfaces honor Reduce Motion', () => {
  for (const path of ['screens-v4/BranchQuestionScreen.tsx', 'screens-v4/PersonalInsightScreen.tsx']) {
    assert.match(read(path), /useReduceMotion/, path);
  }
});

test('Step 12 terminology and privacy audit: user-facing legacy cost copy and sensitive analytics fields are absent', () => {
  const production = [read('screens-v4/FreeRecipeResultScreen.tsx'), readSource('components/RecipeAssistantOverview.tsx')].join('\n');
  assert.match(production, /Eating out/);
  assert.doesNotMatch(production, /Restaurant estimate/);
  const analytics = readSource('analytics/onboardingV4Events.ts');
  const allowList = analytics.slice(analytics.indexOf('const ALLOWED_PROPERTY_KEYS'), analytics.indexOf('/**\n * Runtime defense'));
  for (const sensitive of ['name', 'allergies', 'photoUri', 'mealDescription', 'customizationText', 'receipt']) {
    assert.doesNotMatch(allowList, new RegExp(`['\"]${sensitive}['\"]`));
  }
  assert.match(analytics, /sanitizeOnboardingV4EventProperties/);
});

test('Step 12 rollout audit: source flag remains explicit and activation remains single-owner', () => {
  const flags = readSource('config/devFlags.ts');
  const host = read('OnboardingV3.tsx');
  assert.match(flags, /ONBOARDING_V4_ENABLED = true/);
  assert.match(host, /if \(assignment === null\) return <View/);
  assert.match(host, /<OnboardingV4/);
  assert.match(host, /<LegacyOnboardingV3/);
});
