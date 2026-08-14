import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

// Source-inspection sweep, not component render tests — these screens pull in
// React Native modules that can't execute under the plain node:test runtime
// used here (see analytics/onboardingV4Events.ts's header comment and
// utils/scanScreenNavigationGuard.test.ts, which documents the same
// constraint for the rest of the repo).

const onboardingV3Dir = resolve(process.cwd(), 'src/onboarding-v3');
const read = (relativePath: string) => readFileSync(resolve(onboardingV3Dir, relativePath), 'utf8');

const onboardingV3Source = read('OnboardingV3.tsx');
const promiseSource = read('screens-v4/PromiseScreen.tsx');
const goalSource = read('screens-v4/PrimaryGoalScreen.tsx');
const onboardingV4Source = read('screens-v4/OnboardingV4.tsx');
const branchQuestionSource = read('screens-v4/BranchQuestionScreen.tsx');
const savingsSpendSource = read('screens-v4/SavingsSpendQuestionScreen.tsx');
const macroTargetSetupSource = read('screens-v4/MacroTargetSetupScreen.tsx');
const personalInsightSource = read('screens-v4/PersonalInsightScreen.tsx');
const dietarySafetySource = read('screens-v4/DietarySafetyScreen.tsx');
const recipePreviewSource = read('screens/OnboardingRecipePreview.tsx');
const privacyDataSource = readFileSync(resolve(process.cwd(), 'src/screens/PrivacyDataScreen.tsx'), 'utf8');
const branchCopySource = read('screens-v4/onboardingV4BranchCopy.ts');
const step05Sources = [branchQuestionSource, savingsSpendSource, macroTargetSetupSource, personalInsightSource];
const personalPlanSource = read('screens-v4/PersonalPlanScreen.tsx');
const scanEntrySource = read('screens-v4/FirstScanEntryScreen.tsx');
const planCopySource = read('screens-v4/onboardingV4PlanCopy.ts');

test('V4 is selected behind the reversible gate and the retained V3 fallback remains complete', () => {
  assert.match(onboardingV3Source, /if \(shouldUseOnboardingV4\(/);
  assert.match(onboardingV3Source, /return \(\s*<OnboardingV4/);

  // Every original case label (Step 01/02 baseline) must still be present, in
  // a single unbroken switch — proves the gate is a pure early-return, not a
  // restructuring of the existing V3 render path.
  const originalCaseLabels = [
    'splash', 'name', 'primaryGoal',
    'question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7', 'question8', 'question9',
    'holdReveal', 'branchReveal', 'branchInsight', 'nutritionTargets', 'branchDemo', 'dietaryPreferences', 'planReady',
    'postPurchase', 'input', 'photoConfirm', 'analyzing', 'recipe', 'cooking', 'cookingComplete', 'paywall', 'complete',
  ];
  const switchBlock = onboardingV3Source.slice(onboardingV3Source.indexOf('switch (state.step)'));
  for (const label of originalCaseLabels) {
    assert.match(switchBlock, new RegExp(`case '${label}':`), `missing original V3 case: ${label}`);
  }
});

test('ShowcasePager and NameFoxScreen are absent from both engines', () => {
  assert.doesNotMatch(onboardingV3Source, /ShowcasePager|NameFoxScreen/);
  for (const v4Source of [promiseSource, goalSource, onboardingV4Source]) {
    const code = v4Source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /ShowcasePager/);
    assert.doesNotMatch(code, /NameFoxScreen/);
  }
});

test('mascot naming and standalone user-name entry are absent from the V4 screens built this step', () => {
  for (const v4Source of [promiseSource, goalSource, onboardingV4Source]) {
    assert.doesNotMatch(v4Source, /mascotName/i);
    assert.doesNotMatch(v4Source, /submitMascotName/);
  }
});

test('Promise and PrimaryGoal remain isolated from later branch, scan, paywall, permission, and dietary logic', () => {
  for (const v4Source of [promiseSource, goalSource]) {
    assert.doesNotMatch(v4Source, /branchIntro|BranchIntro/);
    assert.doesNotMatch(v4Source, /revenueCat|purchasePackage|restorePurchases/i);
    assert.doesNotMatch(v4Source, /requestCameraPermissionsAsync|ImagePicker/);
    assert.doesNotMatch(v4Source, /dietary|Dietary/i);
  }
  assert.doesNotMatch(onboardingV4Source, /branchIntro|BranchIntro/);
});

test('PrimaryGoalScreen renders one GoalCard per FUTURE_PRIMARY_GOALS entry (all four goals, not_sure reachable here and only here)', () => {
  assert.match(goalSource, /FUTURE_PRIMARY_GOALS\.map/);
  assert.doesNotMatch(goalSource, /(?<!FUTURE_)PRIMARY_GOALS\.map/, 'must iterate FUTURE_PRIMARY_GOALS, not the 3-goal PRIMARY_GOALS');
});

test('PromiseScreen wires its restore link through the host to the shared RevenueCat restore service', () => {
  assert.match(promiseSource, /onPress=\{onRestore\}/);
  assert.match(onboardingV4Source, /onRestore=\{onRestore\}/);
  assert.match(onboardingV3Source, /restorePurchases\(\)/);
  assert.doesNotMatch(promiseSource, /restorePurchases/, 'PromiseScreen must not call RevenueCat directly — it goes through the injected onRestore prop');
});

test('PrimaryGoalScreen wires its back button through OnboardingBackButton, dispatching BACK', () => {
  assert.match(goalSource, /OnboardingBackButton onPress=\{onBack\}/);
  assert.match(onboardingV4Source, /onBack=\{\(\) => dispatch\(\{ type: 'BACK' \}\)\}/);
});

test('goal cards and the restore link carry explicit, non-empty accessibility labels', () => {
  assert.match(goalSource, /accessibilityLabel=\{FUTURE_GOAL_LABELS\[goal\]\}/);
  assert.match(goalSource, /accessibilityRole="button"/);
  assert.match(promiseSource, /accessibilityLabel=\{isRestoring[\s\S]{0,80}\}/);
  assert.match(promiseSource, /accessibilityRole="button"/);
});

test('every answer persists immediately via one centralized writeDraft effect keyed on state.draft (Step 05: every submitted answer, not just the primary goal)', () => {
  assert.match(onboardingV4Source, /useEffect\(\(\) => \{[\s\S]{0,200}onboardingV4DraftPersistence\.writeDraft\(state\.draft\)/);
  assert.match(onboardingV4Source, /\}, \[state\.draft\]\);/);
});

test('OnboardingV4 hydrates the persisted draft on mount (resume)', () => {
  assert.match(onboardingV4Source, /onboardingV4DraftPersistence\.readDraft\(\)/);
  assert.match(onboardingV4Source, /onboardingV4ScanPersistence\.readInFlightScan\(\)/);
  assert.match(onboardingV4Source, /onboardingV4ScanPersistence\.readFreeRecipeConsumed\(\)/);
  assert.match(onboardingV4Source, /dispatch\(\{ type: 'HYDRATE', draft, inFlightScan, freeRecipeConsumed, recipeId: restoredRecipe\?\.recipeId \?\? null, pendingPremiumAction \}\)/);
});

test('ONBOARDING_V4_ENABLED is activated in Step 11', () => {
  const flags = readFileSync(resolve(process.cwd(), 'src/config/devFlags.ts'), 'utf8');
  assert.match(flags, /export const ONBOARDING_V4_ENABLED = true;/);
});

// --- Step 05 ------------------------------------------------------------

test('none of the Step 05 screens collect a name, secondary goal, mascot name, or dietary field', () => {
  for (const source of step05Sources) {
    assert.doesNotMatch(source, /submitName|userName|mascotName/);
    assert.doesNotMatch(source, /secondaryGoal/i);
    assert.doesNotMatch(source, /dietary|allerg/i);
  }
});

test('PersonalInsightScreen uses tap-to-reveal (Pressable + onPress), not a hold gesture, as the default', () => {
  assert.doesNotMatch(personalInsightSource, /HoldToReveal|onPressIn.*duration|Vibration/i);
  assert.match(personalInsightSource, /accessibilityLabel="Reveal your insight"/);
  assert.match(personalInsightSource, /accessibilityRole="button"/);
});

test('PersonalInsightScreen respects Reduce Motion (reads useReduceMotion and branches styling on it)', () => {
  assert.match(personalInsightSource, /useReduceMotion/);
  assert.match(personalInsightSource, /reduceMotion &&/);
});

test('BranchQuestionScreen respects Reduce Motion and gives immediate selected-state feedback without an auto-advance timer', () => {
  assert.match(branchQuestionSource, /useReduceMotion/);
  assert.doesNotMatch(branchQuestionSource, /setTimeout|setInterval/);
});

function stripCommentsAndStyles(source: string): string {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const styleSheetStart = withoutComments.indexOf('const styles = StyleSheet.create(');
  return styleSheetStart === -1 ? withoutComments : withoutComments.slice(0, styleSheetStart);
}

test('every Step 05 screen shows a stage label (or explicitly allows null) sourced from getOnboardingV4StageLabel via OnboardingV4.tsx, never a numeric "X of Y" / "N% complete" progress indicator', () => {
  assert.match(onboardingV4Source, /getOnboardingV4StageLabel/);
  for (const source of [...step05Sources, goalSource, promiseSource]) {
    const jsxOnly = stripCommentsAndStyles(source);
    assert.doesNotMatch(jsxOnly, /\d+\s*%\s*(complete|done)|step\s*\d+\s*(of|\/)\s*\d+/i);
  }
});

test('no screen hardcodes the fixed 150g protein / 2,100 calorie defaults as if they were personalized results', () => {
  for (const source of [...step05Sources, branchCopySource]) {
    const codeOnly = stripCommentsAndStyles(source);
    assert.doesNotMatch(codeOnly, /\b150g\b/);
    assert.doesNotMatch(codeOnly, /\b2,?100\s*(cal|calories)?\b/i);
  }
});

test('macroDetails is the one explicit, centrally-defined local sub-step — no second reducer or onboarding system was created', () => {
  // onboardingV4Route.ts already declares 'macroDetails' as a canonical step
  // (Step 02); this asserts Step 05 reused it rather than inventing a new
  // step id or a parallel state container.
  assert.match(onboardingV4Source, /state\.step === 'macroDetails'/);
  assert.doesNotMatch(onboardingV4Source, /useReducer\([\s\S]*useReducer\(/, 'only one useReducer call — one reducer, not two');
});

test('OnboardingV4 emits onboarding_answer_submitted for every branch-answer dispatch, and personal_insight_viewed on reveal (not on mere step arrival)', () => {
  assert.match(onboardingV4Source, /onboardingV4AnswerSubmittedEvent/);
  assert.match(onboardingV4Source, /onRevealed=\{\(\) => \{/);
  assert.match(onboardingV4Source, /onboardingV4InsightViewedEvent/);
  // trackAnswer is called imperatively inside each onSelect/onChange handler
  // (fires once per real submission) — never inside a useEffect keyed only
  // on step, which would double-fire on unrelated re-renders.
  const trackAnswerCallSites = onboardingV4Source.match(/trackAnswer\('/g) ?? [];
  assert.ok(trackAnswerCallSites.length >= 9, `expected at least one trackAnswer call per answerable field (savings x2, health x2, macro x4, notSure x2), found ${trackAnswerCallSites.length}`);
});

test('MacroTargetSetupScreen explains why the calculator inputs are needed before showing the estimate form, and never shows a long demographic questionnaire (<=6 fields)', () => {
  assert.match(macroTargetSetupSource, /We use this only for a starting estimate/);
  const estimateFieldCount = (macroTargetSetupSource.match(/NumberField accessibilityLabel="(Age|Height|Weight|Training)/g) ?? []).length;
  assert.ok(estimateFieldCount <= 4, 'estimate form should be compact — 4 numeric fields plus 2 choice rows, not a long questionnaire');
});

test('SavingsSpendQuestionScreen includes the required "A rough estimate is perfect" helper copy', () => {
  assert.match(savingsSpendSource, /SAVINGS_Q2_HELPER/);
  assert.match(branchCopySource, /A rough estimate is perfect\./);
});

// --- Step 06: dietary safety --------------------------------------------

test('DietarySafetyScreen has the required headline, safety copy, and Save CTA', () => {
  assert.match(dietarySafetySource, /Anything every recipe should avoid\?/);
  assert.match(dietarySafetySource, /Okyo can flag and adapt recipes, but AI and ingredient labels can be wrong/);
  assert.match(dietarySafetySource, /'Save my preferences'/);
  assert.match(dietarySafetySource, /isSaving/, 'Step 06 repair: the CTA must reflect an in-flight save transaction');
});

test('OnboardingV4 routes dietarySafety with the "Your preferences" stage label and wires all dietary events', () => {
  assert.match(onboardingV4Source, /state\.step === 'dietarySafety'/);
  assert.match(onboardingV4Source, /DIETARY_ALLERGY_TOGGLED/);
  assert.match(onboardingV4Source, /DIETARY_RESTRICTION_TOGGLED/);
  assert.match(onboardingV4Source, /DIETARY_DISLIKES_CHANGED/);
  assert.match(onboardingV4Source, /DIETARY_NONE_OF_THESE_TOGGLED/);
  assert.match(onboardingV4Source, /DIETARY_SAVED/);
  assert.match(onboardingV4Source, /onboardingV4DietarySavedEvent/);
});

test('DietarySafetyScreen collects only allergies/restrictions/dislikes/noneOfThese — no dietary field outside the Step 04/06 contract', () => {
  assert.doesNotMatch(dietarySafetySource, /submitName|userName|mascotName|secondaryGoal/i);
});

test('Every DietarySafetyScreen Pressable has an accessibilityLabel and accessibilityRole (covered by the repo-wide sweep, asserted directly here too)', () => {
  const pressableBlocks = dietarySafetySource.match(/<Pressable[\s\S]{0,220}?>/g) ?? [];
  assert.ok(pressableBlocks.length > 0);
  for (const block of pressableBlocks) {
    assert.match(block, /accessibilityLabel=/, `Pressable missing accessibilityLabel: ${block.slice(0, 60)}`);
    assert.match(block, /accessibilityRole=/, `Pressable missing accessibilityRole: ${block.slice(0, 60)}`);
  }
});

// --- Step 06: recipe-result and pre-Cook warning integration ----------------

test('OnboardingRecipePreview reuses the existing FoodSafetyNotice/findFoodPreferenceConflicts engine, not a new warning system', () => {
  assert.match(recipePreviewSource, /import \{ FoodSafetyNotice \} from '\.\.\/\.\.\/components\/FoodSafetyNotice'/);
  assert.match(recipePreviewSource, /findFoodPreferenceConflicts\(/);
  assert.match(recipePreviewSource, /<FoodSafetyNotice conflicts=\{dietaryConflicts\} \/>/);
});

test('a saved-allergy reminder always renders regardless of automated conflict detection, and never claims a clean scan is safe', () => {
  assert.match(recipePreviewSource, /hasSavedAllergies/);
  assert.match(recipePreviewSource, /always verify every ingredient before cooking, even when no warning appears below/);
});

test('the pre-Cook acknowledgment only appears for users with saved allergies — no added friction otherwise', () => {
  // Step 06 repair: routed through the shared classifyDietarySafetyPrompt
  // (dietarySafetyPrompt.ts) instead of a local hasSavedAllergies check, so
  // OnboardingRecipePreview and RecipeDetailScreen can no longer diverge.
  assert.match(recipePreviewSource, /import \{ classifyDietarySafetyPrompt \} from '\.\.\/\.\.\/utils\/dietarySafetyPrompt'/);
  assert.match(recipePreviewSource, /if \(promptLevel === 'none'\) \{ onCook\(\); return; \}/);
  assert.match(recipePreviewSource, /Before you start cooking/);
  assert.doesNotMatch(recipePreviewSource, /is safe to (cook|eat)/i, 'must never claim the recipe is safe');
});

test('OnboardingV3.tsx threads the real canonical dietaryPreferences into the recipe preview', () => {
  assert.match(onboardingV3Source, /dietaryPreferences=\{state\.profile\.dietaryPreferences\}/);
});

// --- Step 06: deletion + bundled imagery -------------------------------------

test('deleting all data clears the V4 onboarding draft (which may hold dietary answers), not just the canonical profile', () => {
  // Step 06 repair: extracted into dietaryDeletion.ts's clearAllPersonalOkyoData
  // (now runtime-tested directly in dietaryDeletion.test.ts) so the sequence
  // is testable without rendering this screen; the source-text guarantee
  // moves to that module.
  assert.match(privacyDataSource, /clearAllPersonalOkyoData/);
  const deletionSource = readFileSync(resolve(process.cwd(), 'src/state/dietaryDeletion.ts'), 'utf8');
  assert.match(deletionSource, /ONBOARDING_V4_DRAFT_STORAGE_KEY/);
  assert.match(deletionSource, /dietaryMirror\.clear\?\.\(\)/);
});

test('deletion never references bundled/hard-coded library food imagery (require(...assets/food...) paths are static, not per-user data)', () => {
  assert.doesNotMatch(privacyDataSource, /assets\/food/);
  assert.doesNotMatch(privacyDataSource, /require\(/);
});

// --- Step 07: compact personal plan and first-scan entry -------------------

test('PersonalPlanScreen renders three cards derived from onboardingV4PlanCopy, not fabricated placeholder copy', () => {
  assert.match(personalPlanSource, /buildSavingsPlanContent|buildHealthPlanContent|buildMacrosPlanContent|buildNotSurePlanContent/);
  assert.doesNotMatch(personalPlanSource, /personalized plan (is )?ready/i);
  assert.doesNotMatch(personalPlanSource, /ActivityIndicator|setTimeout/); // no fake loading theater
});

test('onboardingV4PlanCopy never fabricates default numbers (no hardcoded 150g/2100/2,100-style placeholders)', () => {
  const stripped = planCopySource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(stripped, /150g protein/);
  assert.doesNotMatch(stripped, /2[,.]?100 cal/);
});

test('FirstScanEntryScreen never requests camera permission outside handleTakePhoto, and never requests broad photo-library access', () => {
  const stripped = scanEntrySource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(stripped, /requestMediaLibraryPermissionsAsync\(/);
  const permissionCalls = (stripped.match(/requestCameraPermissionsAsync\(/g) ?? []).length;
  assert.equal(permissionCalls, 1, 'camera permission must be requested exactly once, from inside the tap handler');
  const handleTakePhotoBody = stripped.slice(stripped.indexOf('handleTakePhoto ='), stripped.indexOf('handleUploadPhoto ='));
  assert.match(handleTakePhotoBody, /requestCameraPermissionsAsync/);
});

test('FirstScanEntryScreen never calls the analysis API and never shows a paywall', () => {
  assert.doesNotMatch(scanEntrySource, /generateRecipe|analyzeImage|\/api\/(scan|analy[sz]e)/i);
  assert.doesNotMatch(scanEntrySource, /paywall|RevenueCat|Purchases\./i);
});

test('FirstScanEntryScreen normalizes and length-limits the description, and never passes it to analytics/logging', () => {
  assert.match(scanEntrySource, /validateMealDescription/);
  assert.match(scanEntrySource, /maxLength=\{MAX_MEAL_DESCRIPTION_LENGTH\}/);
  assert.doesNotMatch(scanEntrySource, /track\w*\([^)]*description/i);
  assert.doesNotMatch(scanEntrySource, /console\.(log|warn|error)\([^)]*description/i);
});

test('FirstScanEntryScreen provides accessible labels for all three input actions and the description field', () => {
  assert.match(scanEntrySource, /accessibilityLabel="Dish description"/);
  assert.match(scanEntrySource, /onTakePhoto=/);
  assert.match(scanEntrySource, /onUpload=/);
  assert.match(scanEntrySource, /onDescribeMeal=/);
});

test('cancelling the system picker (result.canceled) returns to scanEntry with no image and no error shown', () => {
  const cameraBlock = scanEntrySource.slice(scanEntrySource.indexOf('launchCameraAsync'), scanEntrySource.indexOf('} catch', scanEntrySource.indexOf('launchCameraAsync')));
  assert.match(cameraBlock, /if \(result\.canceled \|\| !asset\) return;/);
  const libraryBlock = scanEntrySource.slice(scanEntrySource.indexOf('launchImageLibraryAsync'), scanEntrySource.indexOf('} catch', scanEntrySource.indexOf('launchImageLibraryAsync')));
  assert.match(libraryBlock, /if \(result\.canceled \|\| !asset\) return;/);
});

test('OnboardingV4.tsx wires plan/scanEntry with once-only analytics guards and never mutates Home savings/macro totals', () => {
  assert.match(onboardingV4Source, /hasEmittedPlanViewedRef/);
  assert.match(onboardingV4Source, /hasEmittedScanInputSelectedRef/);
  assert.match(onboardingV4Source, /commitOnboardingV4PlanToCanonicalProfile/);
  assert.doesNotMatch(onboardingV4Source, /homeSavings|streak|completedMeal|macroTotal/i);
});

test('plan and scanEntry never show a paywall, call RevenueCat, or request notification permission', () => {
  const planThroughScanEntry = onboardingV4Source.slice(onboardingV4Source.indexOf("if (state.step === 'plan')"), onboardingV4Source.indexOf("if (state.step === 'photoConfirm'"));
  assert.doesNotMatch(planThroughScanEntry, /RevenueCat|Purchases\.|purchasePackage|restorePurchases|V4Paywall|requestNotificationPermission/i);
});
