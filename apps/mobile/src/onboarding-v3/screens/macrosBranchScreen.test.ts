import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const screen = readFileSync(join(__dirname, 'MacrosBranchScreen.tsx'), 'utf8');
const visuals = readFileSync(join(__dirname, 'MacrosVisuals.tsx'), 'utf8');
const reducer = readFileSync(join(__dirname, '..', 'state', 'macrosBranch.ts'), 'utf8');
const copy = readFileSync(join(__dirname, '..', 'state', 'macrosBranchCopy.ts'), 'utf8');
const host = readFileSync(join(__dirname, '..', 'OnboardingV3.tsx'), 'utf8');

test('the live V3 host mounts the redesigned Macros branch at its real preview route', () => {
  assert.match(host, /state\.profile\.primaryGoal === 'hit_macros' && isHitMacrosStage2PreviewEnabled\(\)/);
  assert.match(host, /<MacrosBranchScreen onBack=\{controller\.back\} onComplete=\{controller\.completeBranchPreview\} userName=\{state\.profile\.name\} \/>/);
});

test('Done awaits the canonical completion handoff and stays retryable if it fails', () => {
  assert.match(screen, /const done = async \(\) =>/);
  assert.match(screen, /await onComplete\(\)/);
  assert.match(screen, /We couldn.t finish onboarding/);
  assert.match(screen, /accessibilityRole="alert"/);
  assert.match(screen, /testID="macros-completion-cta"/);
  assert.match(screen, /handoffStarted/);
  assert.match(screen, /label=\{isComplete \? \(isFinalizing \? 'Finishing…' : 'Done'\) : 'Next'\}/);
  assert.match(screen, /onPress=\{isComplete \? \(\) => \{ void done\(\); \} : next\}/);
  assert.doesNotMatch(screen, /onChooseAnotherGoal|setPremium|completeOnboarding/);
});

test('all seven question screens use the one shared responsive layout', () => {
  const layouts = screen.match(/<HealthQuestionLayout\b/g) ?? [];
  assert.equal(layouts.length, 6); // focus, calorieCheck, barrier, mealToImprove, trackingStyle, commitment (proteinWeight is the native numeric step)
  assert.match(screen, /<BodyWeightStep/);
  assert.match(reducer, /MACROS_QUESTION_STEPS: readonly MacrosStep\[\] = \['focus', 'proteinWeight', 'calorieCheck', 'barrier', 'mealToImprove', 'trackingStyle', 'commitment'\]/);
});

test('the body-weight and protein-preference numeric flow stays native and non-prescriptive', () => {
  assert.match(screen, /What’s your body weight\?/);
  assert.match(screen, /Skip for now/);
  assert.match(screen, /How much protein do you want to aim for\?/);
  assert.match(screen, /1\.0× body weight/);
  assert.match(screen, /1\.3× body weight/);
  assert.match(screen, /1\.6× body weight/);
  assert.match(screen, /This is a preference range, not medical advice\./);
  assert.match(screen, /qualified professional/);
  assert.match(screen, /accessibilityRole="radiogroup"/);
  assert.doesNotMatch(screen, /recommended daily|deficit|BMI|body mass|diagnos/i);
  assert.doesNotMatch(screen, /\b\d+\s?(kcal|calories)\b/i);
});

test('each screen uses a distinct approved sticker from the stickers folder', () => {
  const registry = readFileSync(join(__dirname, '..', 'assets', 'onboardingV3Assets.ts'), 'utf8');
  const refs = [...`${screen}\n${visuals}`.matchAll(/onboardingV3Assets\.(macros[A-Z][A-Za-z]+)/g)].map((m) => m[1]);
  const used = [...new Set(refs.filter((name) => !name.startsWith('macrosAccent') && name !== 'macrosNutritionMeal'))];
  // proteinWeight is the native numeric picker step and carries no sticker.
  assert.deepEqual(used.sort(), [
    'macrosApproach', 'macrosBarrier', 'macrosBarrierResponse', 'macrosCalorie', 'macrosCalorieInsight',
    'macrosCommitment', 'macrosFocus', 'macrosFocusInsight', 'macrosIntro', 'macrosMeal', 'macrosMealInsight',
    'macrosPlanHero', 'macrosReveal', 'macrosTracking', 'macrosWhatOkyo',
  ].sort());
  for (const name of used) {
    const match = registry.match(new RegExp(`${name}: require\\('([^']+)'\\)`));
    assert.ok(match, `${name} missing from onboardingV3Assets.ts`);
    assert.match(match![1], /assets\/onboarding-v3\/stickers\//);
  }
});

test('the exact introduction and question copy is present', () => {
  assert.match(screen, /Let’s make hitting your macros feel less like math\./);
  assert.match(screen, /No spreadsheets\. No perfect days\. Just numbers that fit how you already eat\./);
  assert.match(screen, /What are you focused on right now\?/);
  assert.match(screen, /Do you track calories too\?/);
  assert.match(screen, /What makes hitting your macros the hardest\?/);
  assert.match(screen, /Which meal is hardest to keep aligned\?/);
  assert.match(screen, /How closely do you want to track\?/);
  assert.match(screen, /What feels realistic right now\?/);
  assert.match(screen, /Pick a starting point—not a perfect streak\./);
});

test('the exact non-question beat copy is present', () => {
  assert.match(screen, /That points us in the right direction\./);
  assert.match(screen, /Okyo uses this to shape recipes and suggestions, not to lock you in\./);
  assert.match(screen, /Good to know\./);
  assert.match(screen, /We’ll start there\./);
  assert.match(screen, /You don’t have to fix every meal at once\./);
  assert.match(visuals, /Nutrition without the homework\./);
  assert.match(visuals, /Okyo keeps the numbers useful\./);
  assert.match(visuals, /Match recipes to what you’re aiming for/);
  assert.match(visuals, /Show nutrition at the level you chose/);
  assert.match(visuals, /Adjust a meal without recounting everything/);
  assert.match(visuals, /Your macros plan is ready\./);
  assert.match(visuals, /Your starting point/);
  assert.match(visuals, /Built around your preferences—not a generic template\./);
  assert.match(visuals, /Keep the food you enjoy\./);
  assert.match(visuals, /Okyo handles the numbers\./);
});

test('the dynamic insight/response/approach/reveal screens are wired to answer-driven copy', () => {
  assert.match(screen, /focusInsightBody\(state\.macroFocus\)/);
  assert.match(screen, /calorieInsightBody\(state\.calorieTrackingStatus\)/);
  assert.match(screen, /barrierResponse\(state\.macroBarrier\)/);
  assert.match(screen, /mealInsightBody\(state\.mealToImprove\)/);
  assert.match(screen, /approachHeadline\(state\)/);
  assert.match(screen, /revealSummary\(state\)/);
  assert.match(screen, /startingPointValue\(state\)/);
  assert.match(screen, /startingPointValue\(state, \{ lowercase: true \}\)/);
  assert.match(screen, /planSummaryRows\(state\)/);
  assert.match(screen, /proteinPreferenceLine\(state\)/);
});

test('the branch uses one continuous progress bar over seven questions and renders the plan visual', () => {
  assert.match(screen, /progressVariant="continuous"/);
  assert.match(screen, /getBranchProgress\(MACROS_STEPS, step\)/);
  assert.match(screen, /<MacrosPlanVisual/);
});

test('no medical claims or fabricated numbers survive in the branch copy', () => {
  assert.doesNotMatch(`${screen}\n${visuals}\n${copy}`, /lose weight|weight loss|BMI|body mass|diagnos|cure\b|recommended daily|deficit|guaranteed/i);
});

test('every rendered string is Sora — no Inter font family in the branch', () => {
  assert.doesNotMatch(`${screen}\n${visuals}`, /fontFamilies\.(?!body|medium|semibold|bold|extraBold|display)/);
  assert.match(visuals, /onboardingFontFamilies as fontFamilies/);
});
