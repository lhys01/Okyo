import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const branchUiDir = __dirname;
const onboardingDir = resolve(branchUiDir, '..');

const read = (relativePath: string) => readFileSync(resolve(onboardingDir, relativePath), 'utf8');

const kitFiles = readdirSync(branchUiDir)
  .filter((name) => (name.endsWith('.tsx') || name.endsWith('.ts')) && !name.endsWith('.test.ts'))
  .map((name) => ({ name, source: readFileSync(join(branchUiDir, name), 'utf8') }));

const branchScreens = ['screens/SaveMoneyBranchScreen.tsx', 'screens/HealthBranchScreen.tsx', 'screens/MacrosBranchScreen.tsx'];

test('the onboarding CTA is coral, not the generic dark charcoal button', () => {
  const cta = read('components/OnboardingCTA.tsx');
  const branchTheme = read('branch-ui/branchTheme.ts');
  assert.match(cta, /backgroundColor:/);
  assert.doesNotMatch(cta, /backgroundColor: colors\.softCharcoal/);
  assert.match(branchTheme, /BRANCH_CTA_COLOR = colors\.coral/);
  // Ink on coral clears the contrast bar that white on coral would not.
  assert.match(cta, /label: \{ color: '#FFFFFF'/);
});

test('the branch kit resolves its colours from the shipped Okyo tokens', () => {
  const theme = read('branch-ui/branchTheme.ts');
  assert.match(theme, /from '\.\.\/\.\.\/theme\/okyoTheme'/);
  assert.match(theme, /BRANCH_CTA_COLOR = colors\.coral/);
  // branchTheme.ts is the token layer itself; everything else consumes it.
  for (const { name, source } of kitFiles.filter((file) => file.name !== 'branchTheme.ts')) {
    assert.doesNotMatch(source, /#[0-9a-fA-F]{6}/, `${name} should not hard-code hex colours outside the token layer`);
  }
});

test('V3 elevation reuses the Today’s ideas recipe-card token', () => {
  const theme = read('branch-ui/branchTheme.ts');
  const okyoTheme = read('../theme/okyoTheme.ts');
  const cta = read('components/OnboardingCTA.tsx');
  const backButton = read('components/OnboardingBackButton.tsx');
  const controls = read('branch-ui/BranchControls.tsx');

  assert.match(theme, /homeRecipeCardShadow/);
  assert.match(theme, /onboardingShadow = homeRecipeCardShadow/);
  assert.match(theme, /onboardingElevation = onboardingShadow/);
  assert.match(theme, /onboardingShadow = homeRecipeCardShadow/);
  assert.match(theme, /branchShadow = onboardingElevation/);
  assert.match(okyoTheme, /shadowColor: '#4A4850'/);
  assert.match(okyoTheme, /shadowOffset: \{ width: 0, height: 3 \}/);
  assert.match(okyoTheme, /shadowOpacity: 0\.2/);
  assert.match(okyoTheme, /shadowRadius: 0\.85/);
  assert.match(okyoTheme, /elevation: 2/);
  assert.match(cta, /\.\.\.homeRecipeCardShadow/);
  assert.match(backButton, /\.\.\.homeRecipeCardShadow/);
  assert.match(controls, /\.\.\.branchShadow/);
});

test('no branch surface says "Restaurant estimate"', () => {
  for (const { name, source } of kitFiles) {
    assert.doesNotMatch(source, /Restaurant estimate/i, `${name} must not say Restaurant estimate`);
  }
  for (const screen of branchScreens) {
    assert.doesNotMatch(read(screen), /Restaurant estimate/i, `${screen} must not say Restaurant estimate`);
  }
});

test('the Save Money spending and savings visuals use the "Eating out" label', () => {
  const screen = read('screens/SaveMoneyBranchScreen.tsx');
  const visuals = read('branch-ui/SaveMoneyVisuals.tsx');
  assert.match(visuals, /Eating out vs\. making it at home/);
  assert.match(screen, /label="Eating out, weekly"/);
});

test('every Pressable in the branch kit carries a label, a role, and a state', () => {
  for (const { name, source } of kitFiles) {
    const pressables = source.match(/<Pressable[\s\S]*?>/g) ?? [];
    for (const pressable of pressables) {
      assert.match(pressable, /accessibilityLabel=/, `${name}: Pressable missing accessibilityLabel`);
      assert.match(pressable, /accessibilityRole=/, `${name}: Pressable missing accessibilityRole`);
      assert.match(pressable, /accessibilityState=/, `${name}: Pressable missing accessibilityState`);
    }
  }
});

test('every animated branch surface respects Reduce Motion', () => {
  for (const { name, source } of kitFiles) {
    if (!source.includes('withTiming')) continue;
    assert.match(source, /useReduceMotion/, `${name} animates without reading Reduce Motion`);
    assert.match(source, /reduceMotion \? 0 :/, `${name} must collapse its duration to zero under Reduce Motion`);
  }
});

test('every branch uses one continuous progress bar that advances per screen', () => {
  const scaffold = read('branch-ui/BranchScaffold.tsx');
  assert.match(scaffold, /accessibilityRole="progressbar"/);
  assert.match(scaffold, /accessibilityValue=\{\{ min: 0, max: total, now: answered \}\}/);
  const helper = read('branch-ui/branchProgress.ts');
  assert.match(helper, /export function getBranchProgress/);
  // One notch per screen (intro excluded, complete = 100%), one continuous fill.
  assert.match(helper, /order\.filter\(\(step\) => step !== 'intro'\)/);
  assert.match(helper, /sequence\.indexOf\(currentStep\)/);
  for (const file of ['screens/SaveMoneyBranchScreen.tsx', 'screens/HealthBranchScreen.tsx', 'screens/MacrosBranchScreen.tsx']) {
    const screen = read(file);
    assert.match(screen, /progressVariant="continuous"/, `${file} must use the continuous bar`);
    assert.match(screen, /getBranchProgress\(\w+, step\)/, `${file} must derive progress from step position`);
  }
});

test('the savings reveal states its arithmetic and never claims banked money', () => {
  const screen = read('screens/SaveMoneyBranchScreen.tsx');
  const visuals = read('branch-ui/SaveMoneyVisuals.tsx');
  assert.match(visuals, /Eating out vs\. making it at home/);
  assert.match(visuals, /An estimate for now — Okyo will calculate your actual savings when you cook a recipe\./);
  assert.match(visuals, /function SavingsBar/);
  assert.doesNotMatch(visuals, /YOU KEEP/);
  assert.doesNotMatch(`${screen}\n${visuals}`, /you have saved|money saved so far/i);
});

test('the branch kit introduces no nutrition targets and no downstream routing', () => {
  const sources = [...kitFiles.map((file) => file.source), ...branchScreens.map(read)].join('\n');
  assert.doesNotMatch(sources, /\b\d{3,4}\s?(kcal|calories)\b/i);
  assert.doesNotMatch(sources, /\b\d{2,3}\s?g of protein\b/i);
  assert.doesNotMatch(sources, /revenueCat|Paywall|dietaryPreferences|ScanInputScreen|generateRecipe/i);
});

test('interactive branch previews stay local and avoid prohibited product surfaces', () => {
  const moments = read('branch-ui/BranchMoments.tsx');
  const macros = read('branch-ui/MacroVisuals.tsx');
  const previews = `${moments}\n${macros}`;
  assert.match(previews, /useState/);
  assert.doesNotMatch(previews, /fetch\(|axios|analysisApi|generateRecipe|RevenueCat|Paywall|purchas|savingsProgress|macroProgress/i);
  assert.doesNotMatch(previews, /dispatch\(/);
});

test('the Health visual moments label example nutrition and make no medical claims', () => {
  const screen = read('screens/HealthBranchScreen.tsx');
  const visuals = read('screens/HealthVisuals.tsx');
  assert.match(visuals, /export function HealthNutritionExample/);
  assert.match(visuals, /<HealthNutritionExample/);
  assert.match(visuals, /Example nutrition only\./);
  assert.match(visuals, /Example recipe nutrition:/);
  assert.doesNotMatch(`${screen}\n${visuals}`, /lose weight|weight loss|BMI|body mass|diagnos|cure|treat\b/i);
});

test('the Macros reveal makes no fabricated numbers, deficit language, or clinical claims', () => {
  const screen = read('screens/MacrosBranchScreen.tsx');
  assert.match(screen, /This is a preference range, not medical advice\./);
  assert.match(screen, /qualified professional/);
  assert.doesNotMatch(screen, /recommended daily|deficit|BMI|body mass|diagnos/i);
  assert.match(screen, /MacrosPlanVisual/);
  assert.doesNotMatch(screen, /\bRR\b|\bEx\b|\b\d+\s?(kcal|calories)\b/i);
});

test('Macros completion stays on the completed single branch', () => {
  const screen = read('screens/MacrosBranchScreen.tsx');
  const host = read('OnboardingV3.tsx');
  assert.match(screen, /disabled=\{isComplete \? isFinalizing : !canContinue\}/);
  assert.match(screen, /label=\{isComplete \? \(isFinalizing \? 'Finishing…' : 'Done'\) : 'Next'\}/);
  assert.match(screen, /onPress=\{isComplete \? \(\) => \{ void done\(\); \} : next\}/);
  assert.match(screen, /handoffStarted/);
  assert.doesNotMatch(screen, /onChooseAnotherGoal/);
  assert.match(host, /<MacrosBranchScreen onBack=\{controller\.back\} onComplete=\{controller\.completeBranchPreview\} userName=\{state\.profile\.name\} \/>/);
});
