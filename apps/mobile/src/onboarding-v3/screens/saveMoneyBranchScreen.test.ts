import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const screen = readFileSync(join(__dirname, 'SaveMoneyBranchScreen.tsx'), 'utf8');
const components = readFileSync(join(__dirname, '..', 'branch-ui', 'SavingsPlanComponents.tsx'), 'utf8');
const state = readFileSync(join(__dirname, '..', 'state', 'saveMoneyBranch.ts'), 'utf8');
const assets = readFileSync(join(__dirname, '..', 'assets', 'onboardingV3Assets.ts'), 'utf8');
const host = readFileSync(join(__dirname, '..', 'OnboardingV3.tsx'), 'utf8');

test('active Save Money branch has the shorter five-screen flow and primary copy', () => {
  for (const copy of [
    'Spend less on takeout without giving up the food you love.',
    'Let’s build a realistic plan around your week.',
    'Let’s get a quick picture of your week.',
    'You can change these anytime.',
    'Cook a little more.',
    'Keep a lot more.',
    'What should your recipes prioritize?',
  ]) assert.match(screen, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(state, /SAVE_MONEY_VISIBLE_STEPS = \['intro', 'weeklySnapshot', 'projection', 'planSetup', 'reveal'\]/);
  assert.match(screen, /label=\{state\.currentStep === 'intro' \? 'Build my plan' : 'Continue'\}/);
});

test('removed interstitials, cravings, arbitrary goal question, and duplicate completion screen stay absent', () => {
  for (const removed of ['Better meals start at home', 'How much would you like to save?', "I want something specific", "step === 'encouragement'", "step === 'reassurance'", "step === 'goal'", 'Your savings plan is ready']) assert.doesNotMatch(screen, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(screen, /Your healthier|Healthier means|Better portions|Biggest barrier|Hard to stay consistent/);
  assert.doesNotMatch(screen, /GoalQuestion|GoalTimelineCard|SAVINGS_GOAL_SELECTED|incrementMoneySaved/);
});

test('weekly snapshot uses three accessible direct sliders, a 0 to 30 range, and keeps replacement bounded', () => {
  assert.equal((screen.match(/<SavingsValueSlider/g) ?? []).length, 3);
  assert.match(screen, /testID="savings-eating-out-slider"/);
  assert.match(screen, /testID="savings-cost-slider"/);
  assert.match(screen, /testID="savings-replacement-slider"/);
  assert.match(screen, /label="How many takeout meals would you like to replace\?"/);
  assert.match(screen, /max=\{state\.weeklyEatingOutCount\}/);
  assert.match(screen, /const MAX_WEEKLY_MEALS = 30/);
  assert.match(screen, /maxLabel="30 \/ week"/);
  assert.match(components, /accessibilityRole="adjustable"/);
  assert.match(components, /Haptics\.selectionAsync/);
});

test('projection is comparative, accessible, green for savings, and concise about potential values', () => {
  assert.match(screen, /function SavingsProjectionScreen/);
  assert.match(screen, /Cook a little more/);
  assert.match(screen, /Keep a lot more/);
  assert.match(screen, /Current routine/);
  assert.match(screen, /`With \$\{projection\.replacements\} at home`/);
  assert.match(screen, /formatMoney\(projection\.weeklyPotentialSavingsCents\)/);
  assert.match(screen, /Cook a little more\.\{"\\n"\}Keep a lot more\./);
  assert.doesNotMatch(screen, /<PiggyBank/);
  assert.doesNotMatch(screen, /Based on your current eating habits, here’s what could change\./);
  assert.doesNotMatch(screen, /That’s \{projection\.replacements\}/);
  assert.doesNotMatch(screen, /Skip for now|skipOptionalStep/);
  assert.doesNotMatch(screen, /illustrative .* make-at-home meal/);
  assert.match(components, /accessibilityRole="image"/);
  assert.match(components, /LinearGradient id="currentArea"/);
  assert.match(components, /LinearGradient id="projectedArea"/);
  assert.match(components, /stroke=\{GREEN\}/);
  assert.match(components, /stroke=\{CORAL\}/);
  assert.match(components, /function smoothPath/);
  assert.match(components, /curveProgress/);
  assert.doesNotMatch(screen + components, /YOU SAVED|money saved|already saved/i);
});

test('priority selections cap at two and custom Other is contextual', () => {
  assert.match(screen, /Choose up to two\./);
  assert.match(screen, /<HouseholdSegment/);
  assert.match(state, /next\.recipePriorities\.length < 2/);
  assert.match(screen, /layout="priorityGrid"/);
  assert.match(screen, /state\.recipePriorities\.includes\('other'\)/);
  for (const id of ['lower_cost', 'quick_easy', 'familiar_satisfying', 'healthier_ingredients', 'leftovers', 'other']) assert.match(screen, new RegExp(`id: '${id}'`));
});

test('final plan keeps dynamic savings, household, and priorities without the old photo card or repeated explanation', () => {
  assert.match(screen, /finalSavingsOrb/);
  assert.match(screen, /finalOrbValue/);
  assert.match(screen, /saveMoneyReassuranceKiko/);
  assert.match(screen, /finalMessage/);
  assert.match(screen, /barrierResponse\[state\.orderingFriction/);
  assert.match(screen, /Cooking for/);
  assert.match(screen, /Recipe priorities/);
  assert.match(components, /projection\.monthlyPotentialSavingsCents/);
  assert.match(components, /projection\.annualPotentialSavingsCents/);
  assert.doesNotMatch(screen, /foodHero|foodScrim|finalExplanation|Projected weekly cost/);
  assert.match(screen, /usePersistedBranchTransition/);
  assert.match(screen, /await persistDraft\(\{ \.\.\.draft, branchCompleted: false, currentStep: 'reveal' \}\)/);
  assert.match(host, /<SaveMoneyBranchScreen variant=\{questionVariant\} onBack=\{controller\.back\} onComplete=\{controller\.beginBranchPlan\} \/>/);
  assert.doesNotMatch(screen, /YOUR REALISTIC SAVINGS PLAN|foodBadge|Actual savings are recorded/);
});

test('final savings reveal keeps the leaves, removes sparkles, and fits long money values', () => {
  assert.match(screen, /finalLeafLeft/);
  assert.match(screen, /finalLeafRight/);
  assert.doesNotMatch(screen, /<Sparks|finalSpark/);
  assert.match(screen, /adjustsFontSizeToFit minimumFontScale=\{0\.72\} numberOfLines=\{3\} style=\{styles\.finalTitle\}/);
  assert.match(screen, /adjustsFontSizeToFit minimumFontScale=\{0\.55\} numberOfLines=\{1\} style=\{styles\.finalOrbValue\}/);
  assert.match(components, /adjustsFontSizeToFit minimumFontScale=\{0\.65\} numberOfLines=\{1\} style=\{styles\.statValue\}/);
});

test('progress, reduced motion, persistence and allow-listed experiment analytics remain wired', () => {
  assert.match(screen, /total: visibleSteps\.length/);
  assert.match(screen, /track\(analyticsEvents\.ONBOARDING_EXPERIMENT_STARTED, \{ experiment_name: 'branch_questions_v1', experiment_variant: variant \}\)/);
  assert.match(screen, /track\(analyticsEvents\.ONBOARDING_EXPERIMENT_BRANCH_COMPLETED, \{ experiment_name: 'branch_questions_v1', experiment_variant: variant \}\)/);
  assert.doesNotMatch(screen, /track\([^\n]*(?:branch:|answer:|text:|value:)/);

  assert.match(screen, /await persistDraft\(\{ \.\.\.draft, branchCompleted: false, currentStep: 'reveal' \}\)/);
  assert.match(screen, /onboardingV3Log\('savings_answers_saved'/);
  assert.match(screen, /onComplete\(\);/);
  assert.match(screen, /saveMoneyBranchPersistence\.read\(\)/);
  assert.match(screen, /if \(!hydrated \|\|[\s\S]{0,150}return <BranchHydrationScreen \/>/);
  assert.match(screen, /usePersistedBranchTransition/);
  assert.match(screen, /setTimeout\(\(\) => \{ schedulePersist\(state\); \}, 220\)/);
  assert.match(components, /useReduceMotion/);
});

test('Savings Continue is guarded and advances the canonical screen exactly once', () => {
  assert.match(screen, /const advanceInFlight = useRef\(false\)/);
  assert.match(screen, /if \(!canContinue \|\| advanceInFlight\.current/);
  assert.match(screen, /type: 'NEXT_PRESSED'/);
  assert.doesNotMatch(screen, /onPress=\{skipOptionalStep\}/);
});

test('question options have no dashed border or green icon container styling', () => {
  assert.doesNotMatch(components, /borderStyle:\s*'dashed'/);
  assert.doesNotMatch(components, /tileIcon: \{[^}]*backgroundColor:\s*colors\.savingsSoft/);
});
