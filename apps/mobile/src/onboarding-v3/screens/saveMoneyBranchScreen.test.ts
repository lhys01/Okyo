import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const screen = readFileSync(join(__dirname, 'SaveMoneyBranchScreen.tsx'), 'utf8');
const host = readFileSync(join(__dirname, '..', 'OnboardingV3.tsx'), 'utf8');
const visuals = readFileSync(join(__dirname, '..', 'branch-ui', 'SaveMoneyVisuals.tsx'), 'utf8');
const assets = readFileSync(join(__dirname, '..', 'assets', 'onboardingV3Assets.ts'), 'utf8');
const controller = readFileSync(join(__dirname, '..', 'controller', 'useOnboardingV3Controller.ts'), 'utf8');

test('Save Money completion CTA uses the canonical app completion handoff', () => {
  assert.match(screen, /disabled=\{isComplete \? false : !canContinue\}/);
  assert.match(screen, /label=\{step === 'intro' \? 'Let’s do it' : isComplete \? 'Done' : step === 'reassurance' \? 'Let’s go!' : step === 'encouragement' \? 'Let’s go' : 'Next'\}/);
  assert.match(screen, /const completePreview = \(\) => \{\s*if \(isComplete\) onComplete\(\);\s*\};/s);
  assert.match(screen, /onPress=\{isComplete \? completePreview : next\}/);
  assert.doesNotMatch(screen, /onChooseAnotherGoal/);
});

test('Save Money encouragement uses the native home-cooking value composition', () => {
  assert.match(screen, /step === 'encouragement'/);
  assert.match(screen, /step === 'encouragement' \|\| step === 'reassurance' \? colors\.canvas/);
  assert.match(screen, /step === 'encouragement' \? 'Let’s go'/);
  for (const copy of ['Better meals', 'home.', 'A few home-cooked meals each week can save money, boost energy, and help you reach your goals.', 'Use what you have', 'Save time and money', 'Reach your goals']) {
    assert.match(visuals, new RegExp(copy.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  }
  assert.match(visuals, /encouragementKiko/);
  assert.match(visuals, /encouragementBenefits/);
  assert.match(visuals, /accessibilityRole="image"/);
});

test('Save Money reassurance uses the native small-changes composition', () => {
  assert.match(screen, /<SaveMoneyReassurance \/>/);
  assert.match(screen, /step === 'reassurance' \? colors\.canvas/);
  assert.match(screen, /step === 'reassurance' \? 'Let’s go!' : step === 'encouragement' \? 'Let’s go' : 'Next'/);
  assert.match(visuals, /export function SaveMoneyReassurance/);
  for (const copy of ['Small changes,', 'big results.', 'You don’t need to replace every order —', 'a few meals at home each week adds up.', 'Cooking more = saving more']) {
    assert.match(visuals, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(visuals, /saveMoneyReassuranceKiko/);
  assert.match(visuals, /saveMoneyReassuranceBowl/);
  assert.match(visuals, /PiggyBank/);
  assert.match(visuals, /ReassuranceArrow/);
  assert.doesNotMatch(screen, /QuietResetCard statement=/);
});

test('Save Money completion does not expose a second-goal handoff', () => {
  assert.match(host, /<SaveMoneyBranchScreen onBack=\{controller\.back\} onComplete=\{controller\.completeBranchPreview\} \/>/);
  assert.doesNotMatch(screen, /onChooseAnotherGoal/);
  assert.doesNotMatch(screen, /saveMoneyBranchPersistence\.reset\(\)/);
  assert.match(controller, /const completeBranchPreview = useCallback\(\(\) => \{\s*completionPathRef\.current = 'branch_preview';\s*dispatch\(\{ type: 'BRANCH_PREVIEW_COMPLETED' \}\);\s*\}, \[dispatch\]\);/s);
  assert.doesNotMatch(controller.match(/const completeBranchPreview[\s\S]*?\n  \}, \[dispatch\]\);/)?.[0] ?? '', /setPremium/);
});

test('the preview remains gated and branch answers remain owned by Save Money persistence', () => {
  assert.match(host, /state\.step === 'branchIntro' && state\.profile\.primaryGoal === 'save_money' && isSaveMoneyStage2PreviewEnabled\(\)/);
  assert.match(screen, /saveMoneyBranchPersistence\.read\(\)/);
  assert.match(screen, /saveMoneyBranchPersistence\.write\(state\)/);
});

test('Save Money uses approved transparent sticker artwork while answers and savings remain native', () => {
  for (const asset of ['saveMoneyIntro', 'saveMoneyFrequency', 'saveMoneyCost', 'saveMoneyFriction', 'saveMoneyEncouragement', 'saveMoneyMeals', 'saveMoneyReplacement', 'saveMoneyPriority', 'saveMoneyReassurance', 'saveMoneyHousehold', 'saveMoneyReveal', 'saveMoneyComplete']) {
    assert.match(assets, new RegExp(`${asset}: require\\('\\.\\.\\/\\.\\.\\/\\.\\.\\/assets\\/onboarding-v3\\/stickers\\/`));
    assert.match(screen + visuals, new RegExp(`onboardingV3Assets\\.${asset}`));
  }
  assert.doesNotMatch(assets + screen + visuals, /saveMoneyKikoWave|saveMoneyKikoCup|saveMoneyKikoTakeoutThought|saveMoneyKikoClipboard|saveMoneyKikoCelebrate/);
  assert.match(screen, /weeklyDifference=\{formatDollars\(differenceWeeklyCents\)\}/);
  assert.match(screen + visuals, /Eating out/);
  assert.match(screen + visuals, /Make it at home/);
  assert.doesNotMatch(visuals, /codex-clipboard|9:41|1\/7|\$12|\$30|\$18/);
  assert.match(screen, /saveMoneyFrequency/);
  assert.match(screen, /saveMoneyCost/);
  assert.match(screen, /saveMoneyFriction/);
  assert.match(screen, /saveMoneyReplacement/);
  assert.match(screen, /saveMoneyPriority/);
  assert.match(screen, /saveMoneyHousehold/);
  assert.match(visuals, /contentFit="contain"/);
  assert.match(readFileSync(join(__dirname, 'NameFoxValueScreens.tsx'), 'utf8'), /Takeout/);
  assert.match(readFileSync(join(__dirname, 'NameFoxValueScreens.tsx'), 'utf8'), /Okyo/);
  assert.match(readFileSync(join(__dirname, 'NameFoxValueScreens.tsx'), 'utf8'), /Time/);
});

test('the new artwork stays inside Save Money and does not alter answer contracts or other branches', () => {
  assert.match(screen, /MEAL_TYPE_TOGGLED/);
  assert.match(screen, /HOUSEHOLD_SIZE_SELECTED/);
  assert.match(screen, /REPLACEMENT_TARGET_SAVED/);
  assert.match(visuals, /accessibilityRole="image"/);
  const health = readFileSync(join(__dirname, 'HealthBranchScreen.tsx'), 'utf8');
  const macros = readFileSync(join(__dirname, 'MacrosBranchScreen.tsx'), 'utf8');
  assert.doesNotMatch(health, /saveMoneyKiko/);
  assert.doesNotMatch(macros, /saveMoneyKiko/);
});

test('meal replacement choices use a balanced native 3-plus-2 grid', () => {
  assert.match(screen, /<MealTypeChoiceTiles/);
  assert.doesNotMatch(screen, /<ChoiceTiles/);
  assert.match(visuals, /export function MealTypeChoiceTiles/);
  assert.match(visuals, /options\.slice\(0, 3\)/);
  assert.match(visuals, /options\.slice\(3\)/);
  assert.match(visuals, /mealChoiceRowCentered/);
  assert.match(visuals, /accessibilityRole="checkbox"/);
  assert.match(visuals, /accessibilityState=\{\{ checked: isSelected, selected: isSelected \}\}/);
  assert.match(screen, /MEAL_TYPE_TOGGLED/);
});

test('meal replacement art is centered, larger, and compacted only for smaller viewports', () => {
  assert.match(visuals, /mealKiko: \{ height: 145, width: 172 \}/);
  assert.match(visuals, /mealKikoCompact: \{ height: 116, width: 138 \}/);
  assert.match(visuals, /const isCompact = width < 360/);
  assert.match(visuals, /mealKikoWrap: \{ alignItems: 'center'/);
});

test('Savings reveal uses a native dynamic report composition without changing its calculation inputs', () => {
  assert.match(screen, /<SavingsRevealHero replacementCount=\{replaced\}/);
  assert.match(screen, /<SavingsRevealReport/);
  assert.match(screen, /formatDollars\(differenceWeeklyCents\)/);
  assert.match(screen, /formatDollars\(differenceAnnualCents\)/);
  assert.doesNotMatch(screen, /\$16|\$28|\$12|\$69|\$832/);
  assert.match(visuals, /Eating out vs\. making it at home/);
  assert.match(visuals, /function SavingsBar/);
  assert.match(visuals, /duration: reduceMotion \? 0 : 460/);
  assert.match(visuals, /withDelay\(reduceMotion \? 0 : 310/);
  assert.doesNotMatch(visuals, /YOU KEEP/);
  assert.doesNotMatch(visuals, /For \{replacementCount\}/);
  assert.doesNotMatch(visuals, /more in your pocket every week/);
  assert.match(visuals, /An estimate for now/);
  assert.match(visuals, /source=\{onboardingV3Assets\.saveMoneyReveal\}/);
  assert.doesNotMatch(visuals, /codex-clipboard|9:41|7\/7/);
});
