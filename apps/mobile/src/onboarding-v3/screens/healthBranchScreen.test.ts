import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const screen = readFileSync(join(__dirname, 'HealthBranchScreen.tsx'), 'utf8');
const visuals = readFileSync(join(__dirname, 'HealthVisuals.tsx'), 'utf8');
const reducer = readFileSync(join(__dirname, '..', 'state', 'healthBranch.ts'), 'utf8');
const copy = readFileSync(join(__dirname, '..', 'state', 'healthBranchCopy.ts'), 'utf8');
const host = readFileSync(join(__dirname, '..', 'OnboardingV3.tsx'), 'utf8');

test('the live V3 host mounts the redesigned Health branch at its real preview route', () => {
  assert.match(host, /state\.step === 'branchIntro' && state\.profile\.primaryGoal === 'eat_healthier' && isEatHealthierStage2PreviewEnabled\(\)/);
  assert.match(host, /<HealthBranchScreen onBack=\{controller\.back\} onComplete=\{controller\.completeBranchPreview\} userName=\{state\.profile\.name\} \/>/);
});

test('completion CTA is enabled and runs the preview completion handoff', () => {
  assert.match(screen, /disabled=\{!isComplete && !canContinue\}/);
  assert.match(screen, /label=\{isComplete \? 'Done' : 'Continue'\}/);
  assert.match(screen, /onPress=\{isComplete \? completePreview : next\}/);
  assert.match(screen, /const completePreview = \(\) => \{\s*dispatch\(\{ type: 'BRANCH_COMPLETED' \}\);\s*if \(onComplete\) void onComplete\(\);\s*\};/s);
  assert.doesNotMatch(screen, /Choose another goal/);
});

test('Back uses the reducer transition and completion stays stable when resumed', () => {
  assert.match(screen, /else dispatch\(\{ type: 'BACK_PRESSED' \}\);/);
  assert.match(reducer, /if \(event\.type === 'BACK_PRESSED'\) \{[\s\S]*?next\.currentStep = HEALTH_STEPS\[Math\.max\(index - 1, 0\)\];/);
  assert.match(reducer, /if \(event\.type === 'BRANCH_COMPLETED'\) \{ next\.branchCompleted = true; next\.currentStep = 'complete'; \}/);
  assert.match(screen, /healthBranchPersistence\.read\(\)/);
  assert.match(screen, /healthBranchPersistence\.write\(state\)/);
});

test('all five question screens use the one shared responsive layout', () => {
  const layouts = screen.match(/<HealthQuestionLayout\b/g) ?? [];
  assert.equal(layouts.length, 5);
  assert.match(visuals, /export function HealthQuestionLayout/);
  assert.match(visuals, /questionChoices: \{ width: '100%' \}/);
});

test('every screen uses a distinct approved sticker from the stickers folder', () => {
  const registry = readFileSync(join(__dirname, '..', 'assets', 'onboardingV3Assets.ts'), 'utf8');
  const refs = [...`${screen}\n${visuals}`.matchAll(/onboardingV3Assets\.(health[A-Z][A-Za-z]+)/g)].map((m) => m[1]);
  const used = [...new Set(refs.filter((name) => !name.startsWith('healthAccent')))];
  // One pose per screen, fourteen screens, no reuse.
  assert.deepEqual(used.sort(), [
    'healthApproach', 'healthBarrier', 'healthBarrierResponse', 'healthCommitment', 'healthFoodStyle',
    'healthIntro', 'healthMeal', 'healthMealInsight', 'healthMeaning', 'healthMeaningInsight',
    'healthPlanHero', 'healthReassurance', 'healthReveal', 'healthWhatOkyo',
  ].sort());
  // Each alias resolves to a real, distinct file under assets/onboarding-v3/stickers.
  const files = used.map((name) => {
    const match = registry.match(new RegExp(`${name}: require\\('([^']+)'\\)`));
    assert.ok(match, `${name} missing from onboardingV3Assets.ts`);
    assert.match(match![1], /assets\/onboarding-v3\/stickers\//);
    return match![1];
  });
  assert.equal(new Set(files).size, files.length);
});

test('the exact introduction and question copy is present', () => {
  assert.match(screen, /Let’s make eating healthier feel easier\./);
  assert.match(screen, /No strict rules\. No perfect meals\. Just small changes that fit the way you already eat\./);
  assert.match(screen, /What would eating healthier mean to you\?/);
  assert.match(screen, /There’s no wrong answer\. Choose what would make the biggest difference for you\./);
  assert.match(screen, /What usually gets in the way\?/);
  assert.match(screen, /Healthy choices are easier when they work around your real life\./);
  assert.match(screen, /Which meal would you most like to improve\?/);
  assert.match(screen, /Let’s start with the part of your day that needs the most help\./);
  assert.match(screen, /What kind of food do you actually enjoy\?/);
  assert.match(screen, /Your healthier approach should still taste like you\./);
  assert.match(screen, /What feels realistic for you right now\?/);
  assert.match(screen, /Choose a starting point—not a perfect promise\./);
});

test('the exact non-question beat copy is present', () => {
  assert.match(screen, /That gives us a great place to start\./);
  assert.match(screen, /Okyo will use this preference to make your recipes more useful and realistic\./);
  assert.match(screen, /We’ll start where it matters most\./);
  assert.match(screen, /You do not need to change everything at once\./);
  assert.match(screen, /You do not have to give up the food you love\./);
  assert.match(screen, /Okyo helps you make better-fitting choices, one meal at a time\./);
  assert.match(screen, /Your answers shape the recipes, suggestions, and guidance Okyo gives you\./);
  assert.match(visuals, /Okyo handles the planning\./);
  assert.match(visuals, /Find better-fitting recipes/);
  assert.match(visuals, /See useful nutrition details/);
  assert.match(visuals, /Make changes without starting over/);
  assert.match(visuals, /Your healthier approach is ready\./);
  assert.match(visuals, /Your starting point/);
  assert.match(visuals, /Your healthier food plan is ready\./);
  assert.match(visuals, /Built around what matters to you—not someone else’s routine\./);
  assert.match(visuals, /Keep the food you love\./);
  assert.match(visuals, /Okyo helps with the next small change\./);
});

test('the exact option labels are present', () => {
  for (const label of ['More balanced meals', 'More whole foods', 'More vegetables and fruit', 'More energy', 'Better portions', 'Less takeout', 'Something else']) {
    assert.match(screen, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const label of ['I do not have enough time', 'Healthy food feels too expensive', 'I do not know what to cook', 'Healthy meals feel boring', 'I struggle to stay consistent', 'I am usually too hungry or tired']) {
    assert.match(screen, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'It varies']) {
    assert.match(screen, new RegExp(`'${label}'`));
  }
  for (const label of ['Comfort food', 'Fresh and colorful', 'High-protein meals', 'Quick and simple', 'International flavors', 'A little bit of everything']) {
    assert.match(screen, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const label of ['A few healthier meals each week', 'Small changes most days', 'I want to improve gradually', 'I am not sure yet']) {
    assert.match(screen, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('the dynamic insight/response/approach/reveal screens are wired to answer-driven copy', () => {
  assert.match(screen, /meaningInsightBody\(state\.healthDefinition\)/);
  assert.match(screen, /barrierResponse\(state\.healthBarrier\)/);
  assert.match(screen, /mealInsightBody\(state\.mealToImprove\)/);
  assert.match(screen, /approachHeadline\(state\)/);
  assert.match(screen, /revealSummary\(state\)/);
  assert.match(screen, /startingPointValue\(state\)/);
  assert.match(screen, /startingPointValue\(state, \{ lowercase: true \}\)/);
  assert.match(screen, /planSummaryRows\(state\)/);
});

test('the branch uses one continuous progress bar over five questions', () => {
  assert.match(screen, /progressVariant="continuous"/);
  assert.match(screen, /getBranchProgress\(HEALTH_STEPS, step\)/);
  assert.match(reducer, /HEALTH_QUESTION_STEPS: readonly HealthStep\[\] = \['meaning', 'barrier', 'mealToImprove', 'foodStyle', 'commitment'\]/);
});

test('the example nutrition card stays honest and no medical claims are made', () => {
  assert.match(visuals, /<HealthNutritionExample/);
  assert.match(visuals, /Example recipe nutrition:/);
  assert.match(visuals, /Example nutrition only\./);
  assert.doesNotMatch(`${screen}\n${visuals}\n${copy}`, /lose weight|weight loss|BMI|body mass|diagnos|cure\b|calorie target|guaranteed/i);
});

test('every rendered string is Sora — no Inter font family in the branch', () => {
  assert.doesNotMatch(`${screen}\n${visuals}`, /fontFamilies\.(?!body|medium|semibold|bold|extraBold|display)/);
  assert.match(visuals, /onboardingFontFamilies as fontFamilies/);
});
