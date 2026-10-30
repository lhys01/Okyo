import { EMPTY_FOOD_PREFERENCES, type FoodPreferences } from '../../state/foodPreferences';
import { createCanonicalDietaryHandoff } from '../../onboarding/canonical/dietary';
import type { AttributionSource } from '../state/attribution';
import { DEFAULT_MASCOT_NAME, sanitizeMascotName } from '../state/mascotName';
import { MACROS_FOOD_FIRST_VERSION, usesFoodFirstMacros } from '../state/macrosFoodFirst';
import {
  emptyPersonalizedProfile,
  isPrimaryGoal,
  normalizePersonalizedProfile,
  personalizedGoalContent,
  setDietaryPreferences,
  setPersonalizedAnswer,
  sanitizeUserName,
  type PersonalizedAnswer,
  type PersonalizedOnboardingProfile,
  type PrimaryGoal,
  type SecondaryGoal,
  type AgeEligibility,
} from '../state/personalizedOnboarding';

export type OnboardingV3Step =
  | 'splash' | 'showcase' | 'name' | 'ageEligibility' | 'primaryGoal' | 'foxIntro' | 'branchIntro'
  | 'question1' | 'question2' | 'question3' | 'question4' | 'question5' | 'question6' | 'question7' | 'question8' | 'question9'
  | 'holdReveal' | 'branchReveal' | 'branchInsight' | 'nutritionTargets' | 'branchDemo'
  | 'secondaryGoals' | 'dietaryPreferences' | 'personalizedFuture' | 'planReady' | 'branchDietarySafety'
  | 'nameFox' | 'foxExplainer1' | 'foxExplainer2' | 'personalizationChoice' | 'paywall' | 'branchPlan' | 'branchSignature' | 'branchMacroResults' | 'branchAccount'
  | 'postPurchase' | 'input' | 'photoConfirm' | 'analyzing' | 'recipe' | 'cooking' | 'cookingComplete' | 'complete';

// New branch users name the fox before their goal questions. Legacy route ids
// remain accepted so in-progress onboarding can resume without losing answers.
export const ONBOARDING_V3_STEPS: readonly OnboardingV3Step[] = Object.freeze([
  'splash', 'showcase', 'foxIntro', 'nameFox', 'name', 'foxExplainer1', 'foxExplainer2', 'ageEligibility', 'primaryGoal', 'branchIntro', 'question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7', 'question8', 'question9',
  'holdReveal', 'branchReveal', 'branchInsight', 'nutritionTargets', 'branchDemo', 'secondaryGoals', 'dietaryPreferences', 'personalizedFuture', 'planReady', 'branchDietarySafety', 'personalizationChoice', 'paywall', 'branchPlan', 'branchSignature', 'branchMacroResults', 'branchAccount', 'postPurchase', 'input', 'photoConfirm', 'analyzing', 'recipe', 'cooking', 'cookingComplete', 'complete',
]);
const questionSteps = ['question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7', 'question8', 'question9'] as const;
type QuestionStep = (typeof questionSteps)[number];
const isQuestionStep = (step: OnboardingV3Step): step is QuestionStep => questionSteps.includes(step as QuestionStep);

export function isRealInputUnlocked(step: OnboardingV3Step): boolean { return ['postPurchase', 'input', 'photoConfirm', 'analyzing', 'recipe', 'cooking', 'cookingComplete', 'complete'].includes(step); }
export function getPersistedPersonalizedStep(step: OnboardingV3Step): OnboardingV3Step { return isRealInputUnlocked(step) ? 'paywall' : step === 'personalizedFuture' ? 'planReady' : step; }
export type OnboardingV3ErrorKind = 'ingredients_only' | 'not_food' | 'unclear' | 'network' | 'recipe_generation' | 'purchase' | 'not_entitled' | 'nothing_to_restore';
export type OnboardingV3Error = { kind: OnboardingV3ErrorKind; message: string };
export type OnboardingV3State = { step: OnboardingV3Step; resumeStep: OnboardingV3Step | null; profile: PersonalizedOnboardingProfile; mascotName: string; attribution: AttributionSource | null; dietaryRestrictions: string[]; dietaryDislikes: string[]; analysisId: string | null; dishName: string | null; photoUri: string | null; recipeId: string | null; scanSessionId: string | null; error: OnboardingV3Error | null; };
export type OnboardingV3Event =
  | { type: 'HYDRATE'; profile: PersonalizedOnboardingProfile; resumeStep: string | null; mascotName: string; attribution: AttributionSource | null }
  | { type: 'SPLASH_FINISHED'; elapsedMs: number; fontsLoaded: boolean } | { type: 'SHOWCASE_FINISHED' } | { type: 'MASCOT_NAME_SUBMITTED'; raw: string } | { type: 'MASCOT_NAME_SKIPPED' }
  | { type: 'ATTRIBUTION_SELECTED'; source: AttributionSource } | { type: 'ATTRIBUTION_SKIPPED' } | { type: 'NAME_SUBMITTED'; raw: string } | { type: 'NAME_SKIPPED' } | { type: 'AGE_ELIGIBILITY_SELECTED'; value: AgeEligibility } | { type: 'AGE_VALUE_CHANGED'; value: number }
  | { type: 'PRIMARY_GOAL_SELECTED'; goal: PrimaryGoal } | { type: 'ANSWER_SET'; key: string; value: PersonalizedAnswer } | { type: 'CONTINUE' } | { type: 'HOLD_COMPLETED' }
  | { type: 'PERSONALIZATION_DECLINED' }
  | { type: 'SECONDARY_GOALS_SET'; goals: SecondaryGoal[] } | { type: 'DIETARY_SET'; preferences: FoodPreferences }
  | { type: 'PERSONALIZATION_CONTINUE' } | { type: 'PERSONALIZATION_SKIP' }
  | { type: 'PHOTO_SELECTED'; uri: string } | { type: 'DESCRIPTION_SUBMITTED'; text: string; scanSessionId?: string } | { type: 'PERMISSION_DENIED'; message?: string } | { type: 'PHOTO_CONFIRMED'; scanSessionId?: string }
  | { type: 'ANALYSIS_SUCCEEDED'; analysisId: string; dishName: string } | { type: 'ANALYSIS_REJECTED'; kind: 'ingredients_only' | 'not_food' | 'unclear'; message: string } | { type: 'ANALYSIS_FAILED'; message: string }
  | { type: 'RECIPE_READY'; recipeId: string } | { type: 'RECIPE_FAILED'; message: string } | { type: 'RECIPE_RETRY' } | { type: 'START_OVER' } | { type: 'COOK' } | { type: 'COOKING_COMPLETED' } | { type: 'COOKING_EXITED' }
  | { type: 'PURCHASE_SUCCEEDED'; entitled: boolean } | { type: 'PURCHASE_CANCELLED' } | { type: 'PURCHASE_FAILED'; message: string } | { type: 'RESTORE_SUCCEEDED'; entitled: boolean } | { type: 'PAYMENTS_UNAVAILABLE_CONTINUE' } | { type: 'DEV_BYPASS_COMPLETED' } | { type: 'BRANCH_PLAN_READY' } | { type: 'BRANCH_ALLERGIES_SET'; allergies: string[] } | { type: 'BRANCH_DIETARY_COMPLETED' } | { type: 'BRANCH_SIGNATURE_COMPLETED' } | { type: 'MACRO_PLAN_EDIT_REQUESTED' } | { type: 'BRANCH_ACCOUNT_COMPLETED' } | { type: 'BACK' };

export const initialOnboardingV3State: OnboardingV3State = Object.freeze({ step: 'splash', resumeStep: null, profile: emptyPersonalizedProfile, mascotName: 'Kiko', attribution: null, dietaryRestrictions: [], dietaryDislikes: [], analysisId: null, dishName: null, photoUri: null, recipeId: null, scanSessionId: null, error: null });

export function onboardingV3Reducer(state: OnboardingV3State, event: OnboardingV3Event): OnboardingV3State {
  // Branch screens own their questions; the host owns the single plan step.
  if (state.step === 'branchIntro' && event.type === 'BRANCH_PLAN_READY') {
    return { ...state, step: 'branchPlan', error: null };
  }
  if (state.step === 'branchIntro' && state.profile.primaryGoal === 'hit_macros' && event.type === 'AGE_VALUE_CHANGED' && Number.isInteger(event.value) && event.value >= 13 && event.value <= 100) {
    return { ...state, profile: { ...state.profile, age: event.value, ageEligibility: event.value < 18 ? 'under_18' : '18_plus' } };
  }
  // New macros entrants use the compact route. Existing persisted questionnaires
  // have no version marker and retain their original route and target setup.
  if (usesFoodFirstMacros(state.profile)) {
    const compactSteps = ['branchIntro', 'question1', 'question2', 'branchDemo'];
    if (compactSteps.includes(state.step)) {
      if (event.type === 'ANSWER_SET') return { ...state, profile: setPersonalizedAnswer(state.profile, event.key, event.value) };
      if (event.type === 'BACK') return { ...state, step: state.step === 'branchIntro' ? 'primaryGoal' : state.step === 'question1' ? 'branchIntro' : state.step === 'question2' ? 'question1' : state.profile.answers.macrosOwnTargets === 'yes' ? 'question2' : 'question1' };
      if (event.type === 'CONTINUE') {
        if (state.step === 'branchIntro' && state.profile.macroPreferences?.focus) return { ...state, step: 'question1' };
        if (state.step === 'question1' && state.profile.answers.macrosObstacle) return { ...state, step: state.profile.answers.macrosOwnTargets === 'yes' ? 'question2' : 'branchDemo' };
        if (state.step === 'question2' && state.profile.macroPreferences?.ownDailyReferences.proteinGrams !== undefined && (state.profile.answers.macrosDailyCalories == null || state.profile.macroPreferences.ownDailyReferences.calories !== undefined)) return { ...state, step: 'branchDemo' };
        if (state.step === 'branchDemo') return { ...state, step: 'dietaryPreferences' };
      }
      return state;
    }
    if (state.step === 'dietaryPreferences' && event.type === 'DIETARY_SET') {
      const handoff = createCanonicalDietaryHandoff(event.preferences);
      const profile = setDietaryPreferences(state.profile, handoff.preferences);
      // Legacy questionnaire resumes keep their existing plan-summary handoff;
      // the branch preview route handles allergy safety and fox naming itself.
      return { ...state, profile, dietaryRestrictions: handoff.dietaryRestrictions, dietaryDislikes: handoff.dietaryDislikes, step: 'planReady' };
    }
    if (state.step === 'nameFox' && event.type === 'MASCOT_NAME_SUBMITTED') return { ...state, step: 'name', mascotName: sanitizeMascotName(event.raw) };
    if (state.step === 'nameFox' && event.type === 'MASCOT_NAME_SKIPPED') return { ...state, step: 'name' };
    if (state.step === 'nameFox' && event.type === 'BACK') return { ...state, step: 'foxIntro' };
    if (state.step === 'personalizationChoice' && (event.type === 'PERSONALIZATION_CONTINUE' || event.type === 'PERSONALIZATION_SKIP')) return { ...state, step: 'paywall' };
    if (state.step === 'personalizationChoice' && event.type === 'BACK') return { ...state, step: 'planReady' };
  }
  if (event.type === 'HYDRATE' && state.step === 'splash') {
    const normalizedProfile = normalizePersonalizedProfile(event.profile);
    // A null resume route with an otherwise empty profile is a genuinely new
    // onboarding session. Do not let the device-level dietary mirror from a
    // previous account/session pre-fill this user's first safety choice.
    const isFreshSession = event.resumeStep == null
      && !normalizedProfile.primaryGoal
      && !normalizedProfile.name.trim()
      && normalizedProfile.age == null
      && normalizedProfile.ageEligibility == null;
    const profile = isFreshSession ? setDietaryPreferences(normalizedProfile, EMPTY_FOOD_PREFERENCES) : normalizedProfile;
    const legacyStep = event.resumeStep === 'personalizedFuture' ? 'planReady'
      : event.resumeStep === 'branchDietarySafety' || event.resumeStep === 'branchMacroResults' ? 'branchPlan'
      : event.resumeStep;
    const requestedStep = isResumableStep(legacyStep) ? legacyStep : null;
    const resumeStep = requestedStep && needsPrimaryGoal(requestedStep) && !profile.primaryGoal ? 'primaryGoal' : requestedStep;
    return { ...state, profile, mascotName: sanitizeMascotName(event.mascotName), attribution: event.attribution, dietaryRestrictions: [...profile.dietaryPreferences.allergies, ...profile.dietaryPreferences.restrictions], dietaryDislikes: [...profile.dietaryPreferences.avoidances, ...profile.dietaryPreferences.dislikes], resumeStep };
  }
  switch (state.step) {
    case 'splash': return event.type === 'SPLASH_FINISHED' && event.elapsedMs >= 700 && (event.fontsLoaded || event.elapsedMs >= 1100) ? { ...state, step: state.resumeStep ?? 'showcase', resumeStep: null, error: null } : state;
    case 'showcase': if (event.type === 'SHOWCASE_FINISHED') return { ...state, step: 'foxIntro' }; if (event.type === 'ATTRIBUTION_SELECTED') return { ...state, attribution: event.source }; if (event.type === 'ATTRIBUTION_SKIPPED') return { ...state, attribution: null }; return state;
    case 'name':
      if (event.type === 'NAME_SUBMITTED' && sanitizeUserName(event.raw)) return { ...state, step: 'foxExplainer1', profile: { ...state.profile, name: sanitizeUserName(event.raw) } };
      if (event.type === 'NAME_SKIPPED') return { ...state, step: 'foxExplainer1', profile: { ...state.profile, name: '' } };
      return event.type === 'BACK' ? { ...state, step: 'nameFox' } : state;
    case 'ageEligibility':
      if (event.type === 'AGE_VALUE_CHANGED' && Number.isInteger(event.value) && event.value >= 13 && event.value <= 100) return { ...state, profile: { ...state.profile, age: event.value, ageEligibility: event.value < 18 ? 'under_18' : '18_plus' } };
      if (event.type === 'AGE_ELIGIBILITY_SELECTED' && event.value === 'prefer_not_to_say') return { ...state, profile: { ...state.profile, age: null, ageEligibility: event.value } };
      if (event.type === 'CONTINUE' && state.profile.ageEligibility) return { ...state, step: 'primaryGoal' };
      return event.type === 'BACK' ? { ...state, step: 'foxExplainer2' } : state;
    case 'primaryGoal':
      if (event.type === 'PRIMARY_GOAL_SELECTED' && isPrimaryGoal(event.goal)) return { ...state, step: 'branchIntro', profile: { ...state.profile, primaryGoal: event.goal, secondaryGoals: [event.goal], answers: event.goal === 'hit_macros' ? { macrosExperience: MACROS_FOOD_FIRST_VERSION } : {}, macroPreferences: undefined, nutritionProfile: event.goal === 'hit_macros' ? { ...state.profile.nutritionProfile } : state.profile.nutritionProfile } };
      if (event.type === 'PERSONALIZATION_DECLINED') return { ...state, step: 'complete', error: null };
      return event.type === 'BACK' ? { ...state, step: 'ageEligibility' } : state;
    case 'foxIntro': return event.type === 'CONTINUE' ? { ...state, step: 'nameFox' } : event.type === 'BACK' ? { ...state, step: 'showcase' } : state;
    case 'branchIntro': return event.type === 'CONTINUE' ? { ...state, step: 'question1' } : event.type === 'BACK' ? { ...state, step: 'primaryGoal' } : state;
    default: break;
  }
  if (isQuestionStep(state.step)) return reduceQuestion(state, event);
  switch (state.step) {
    case 'holdReveal': return event.type === 'HOLD_COMPLETED' ? { ...state, step: 'planReady' } : event.type === 'BACK' ? { ...state, step: 'secondaryGoals' } : state;
    case 'branchReveal': return event.type === 'CONTINUE' ? { ...state, step: nextAfterFirstInsight(state) } : event.type === 'BACK' ? { ...state, step: 'holdReveal' } : state;
    case 'branchInsight': return event.type === 'CONTINUE' ? { ...state, step: nextAfterSecondInsight(state) } : event.type === 'BACK' ? { ...state, step: previousQuestionStep(state) } : state;
    case 'nutritionTargets': return event.type === 'CONTINUE' ? { ...state, step: 'branchDemo' } : event.type === 'BACK' ? { ...state, step: 'question9' } : state;
    case 'branchDemo': return event.type === 'CONTINUE' ? { ...state, step: 'dietaryPreferences' } : event.type === 'BACK' ? { ...state, step: state.profile.primaryGoal === 'hit_macros' ? 'nutritionTargets' : 'branchInsight' } : state;
    case 'dietaryPreferences':
      if (event.type === 'DIETARY_SET') { const handoff = createCanonicalDietaryHandoff(event.preferences); const profile = setDietaryPreferences(state.profile, handoff.preferences); return { ...state, profile, dietaryRestrictions: handoff.dietaryRestrictions, dietaryDislikes: handoff.dietaryDislikes, step: 'secondaryGoals' }; }
      return event.type === 'BACK' ? { ...state, step: 'branchDemo' } : state;
    case 'secondaryGoals':
      if (event.type === 'SECONDARY_GOALS_SET') { const primary = state.profile.primaryGoal; return { ...state, profile: { ...state.profile, secondaryGoals: [...new Set(primary ? [primary, ...event.goals.filter((goal) => goal !== primary)] : event.goals)] }, step: 'holdReveal' }; }
      return event.type === 'BACK' ? { ...state, step: 'dietaryPreferences' } : state;
    case 'personalizedFuture': return event.type === 'CONTINUE' ? { ...state, step: 'planReady' } : event.type === 'BACK' ? { ...state, step: 'dietaryPreferences' } : state;
    case 'planReady':
      // A mascot name already exists (e.g. this user named their fox under
      // the pre-restructure flow) — do not ask again.
      if (event.type === 'CONTINUE') return { ...state, step: state.mascotName.trim() !== DEFAULT_MASCOT_NAME ? 'paywall' : 'personalizationChoice' };
      return event.type === 'BACK' ? { ...state, step: 'dietaryPreferences' } : state;
    case 'branchDietarySafety':
      // An in-memory route from a previous build uses the new shared plan UI.
      return event.type === 'CONTINUE' ? { ...state, step: 'branchSignature' }
        : event.type === 'BACK' ? { ...state, step: 'branchIntro' } : state;
    case 'nameFox':
      if (event.type === 'MASCOT_NAME_SUBMITTED') return { ...state, step: 'name', mascotName: sanitizeMascotName(event.raw) };
      if (event.type === 'MASCOT_NAME_SKIPPED') return { ...state, step: 'name' };
      return event.type === 'BACK' ? { ...state, step: 'foxIntro' } : state;
    case 'foxExplainer1': return event.type === 'CONTINUE' ? { ...state, step: 'foxExplainer2' } : event.type === 'BACK' ? { ...state, step: 'name' } : state;
    case 'foxExplainer2': return event.type === 'CONTINUE' ? { ...state, step: 'ageEligibility' } : event.type === 'BACK' ? { ...state, step: 'foxExplainer1' } : state;
    case 'personalizationChoice':
      if (event.type === 'PERSONALIZATION_CONTINUE' || event.type === 'PERSONALIZATION_SKIP') return { ...state, step: 'paywall' };
      return event.type === 'BACK' ? { ...state, step: 'planReady' } : state;
    case 'paywall':
      if (event.type === 'PURCHASE_SUCCEEDED') return event.entitled ? { ...state, step: 'postPurchase', error: null } : { ...state, error: { kind: 'not_entitled', message: 'Your purchase completed, but Okyo Pro is not active yet.' } };
      if (event.type === 'RESTORE_SUCCEEDED') return event.entitled ? { ...state, step: 'postPurchase', error: null } : { ...state, error: { kind: 'nothing_to_restore', message: "We couldn't find an Okyo Pro subscription to restore." } };
      if (event.type === 'PURCHASE_CANCELLED') return { ...state, error: null }; if (event.type === 'PURCHASE_FAILED') return { ...state, error: { kind: 'purchase', message: event.message } }; if (event.type === 'PAYMENTS_UNAVAILABLE_CONTINUE' || event.type === 'DEV_BYPASS_COMPLETED') return { ...state, step: 'complete', error: null }; return state;
    case 'branchPlan': return event.type === 'CONTINUE' ? { ...state, step: 'branchSignature' } : event.type === 'MACRO_PLAN_EDIT_REQUESTED' ? { ...state, step: 'branchIntro' } : event.type === 'BACK' ? { ...state, step: 'branchIntro' } : state;
    case 'branchSignature': return event.type === 'BRANCH_SIGNATURE_COMPLETED' ? { ...state, step: 'branchAccount', error: null } : event.type === 'BACK' ? { ...state, step: 'branchPlan' } : state;
    case 'branchMacroResults': return event.type === 'CONTINUE' ? { ...state, step: 'branchSignature' } : event.type === 'BACK' ? { ...state, step: 'branchIntro' } : state;
    case 'branchAccount': return event.type === 'BRANCH_ACCOUNT_COMPLETED' ? { ...state, step: 'complete', error: null } : event.type === 'BACK' ? { ...state, step: 'branchSignature' } : state;
    case 'postPurchase': case 'input': if (event.type === 'PHOTO_SELECTED' && event.uri.trim()) return { ...state, step: 'photoConfirm', photoUri: event.uri, error: null }; if (event.type === 'DESCRIPTION_SUBMITTED' && event.text.trim()) return { ...state, step: 'analyzing', photoUri: null, scanSessionId: event.scanSessionId ?? state.scanSessionId, error: null }; if (event.type === 'PERMISSION_DENIED') return { ...state, error: { kind: 'network', message: event.message ?? 'Photo access is needed to choose that image.' } }; return event.type === 'BACK' && state.step === 'input' ? { ...state, step: 'postPurchase', error: null } : state;
    case 'photoConfirm': return event.type === 'PHOTO_CONFIRMED' && state.photoUri ? { ...state, step: 'analyzing', scanSessionId: event.scanSessionId ?? state.scanSessionId } : event.type === 'BACK' ? { ...state, step: 'postPurchase', photoUri: null } : state;
    case 'analyzing': if (event.type === 'ANALYSIS_SUCCEEDED') return { ...state, step: 'recipe', analysisId: event.analysisId, dishName: event.dishName, error: null }; if (event.type === 'ANALYSIS_REJECTED') return { ...state, step: 'postPurchase', analysisId: null, dishName: null, error: { kind: event.kind, message: event.message } }; if (event.type === 'ANALYSIS_FAILED') return { ...state, step: 'postPurchase', analysisId: null, dishName: null, error: { kind: 'network', message: event.message } }; return event.type === 'BACK' ? { ...state, step: 'postPurchase', analysisId: null, dishName: null } : state;
    case 'recipe': if (event.type === 'RECIPE_READY') return { ...state, recipeId: event.recipeId, error: null }; if (event.type === 'RECIPE_FAILED') return { ...state, error: { kind: 'recipe_generation', message: event.message } }; if (event.type === 'RECIPE_RETRY') return state.analysisId ? { ...state, error: null } : { ...state, step: 'analyzing', error: null }; if (event.type === 'CONTINUE' && state.recipeId) return { ...state, step: 'complete' }; if (event.type === 'COOK' && state.recipeId) return { ...state, step: 'cooking' }; if (event.type === 'START_OVER') return clearScanState(state); return event.type === 'BACK' ? { ...state, step: 'postPurchase', error: null } : state;
    case 'cooking': if (event.type === 'COOKING_COMPLETED') return { ...state, step: 'cookingComplete' }; if (event.type === 'COOKING_EXITED') return { ...state, step: 'complete' }; return event.type === 'BACK' ? { ...state, step: 'recipe' } : state;
    case 'cookingComplete': return event.type === 'CONTINUE' ? { ...state, step: 'complete' } : state;
    case 'complete': return state;
  }
}

function reduceQuestion(state: OnboardingV3State, event: OnboardingV3Event): OnboardingV3State {
  if (event.type === 'ANSWER_SET') return { ...state, profile: setPersonalizedAnswer(state.profile, event.key, event.value) };
  if (event.type === 'BACK') return { ...state, step: state.step === 'question1' ? 'branchIntro' : previousQuestionStep(state) };
  if (event.type !== 'CONTINUE' || !hasCurrentQuestionAnswer(state)) return state;
  const goal = state.profile.primaryGoal!;
  const index = questionSteps.indexOf(state.step as QuestionStep);
  if ((goal !== 'hit_macros' && index === 1) || (goal === 'hit_macros' && index === 3)) return { ...state, step: nextVisibleQuestionStep(state, index) ?? 'branchDemo' };
  if (goal !== 'hit_macros' && index === 4) return { ...state, step: 'branchInsight' };
  if (goal === 'hit_macros' && (index === 7 || (index === 6 && !isQuestionVisible(state, 7)))) return { ...state, step: 'branchInsight' };
  if (goal === 'hit_macros' && index === 8) return { ...state, step: 'nutritionTargets' };
  const next = nextVisibleQuestionStep(state, index);
  return next ? { ...state, step: next } : { ...state, step: goal === 'hit_macros' ? 'nutritionTargets' : 'branchDemo' };
}
function questionForStep(state: OnboardingV3State, step = state.step) { const goal = state.profile.primaryGoal; return goal && isQuestionStep(step) ? personalizedGoalContent[goal].questions[questionSteps.indexOf(step)] : undefined; }
function isQuestionVisible(state: OnboardingV3State, index: number): boolean { const question = state.profile.primaryGoal ? personalizedGoalContent[state.profile.primaryGoal].questions[index] : undefined; return Boolean(question && (!question.visible || question.visible(state.profile))); }
function nextVisibleQuestionStep(state: OnboardingV3State, fromIndex: number): QuestionStep | null { for (let index = fromIndex + 1; index < questionSteps.length; index += 1) if (isQuestionVisible(state, index)) return questionSteps[index]; return null; }
function hasCurrentQuestionAnswer(state: OnboardingV3State): boolean {
  const question = questionForStep(state);
  const answer = state.profile.answers[question?.id ?? ''];
  // `null` is the explicit selection for Okyo's calculated protein estimate.
  if (question?.id === 'proteinTarget') return Object.prototype.hasOwnProperty.call(state.profile.answers, question.id);
  return question?.optional && answer === null ? true : Array.isArray(answer) ? answer.length > 0 : answer !== null && answer !== undefined && answer !== '';
}
function previousQuestionStep(state: OnboardingV3State): QuestionStep {
  const current = isQuestionStep(state.step) ? questionSteps.indexOf(state.step) - 1 : lastRelevantQuestionIndex(state);
  for (let index = Math.max(0, current); index >= 0; index -= 1) if (isQuestionVisible(state, index)) return questionSteps[index];
  return 'question1';
}
function lastRelevantQuestionIndex(state: OnboardingV3State): number { if (state.step === 'holdReveal' || state.step === 'branchReveal') return state.profile.primaryGoal === 'hit_macros' ? 3 : 1; if (state.step === 'branchInsight') { if (state.profile.primaryGoal === 'hit_macros') return isQuestionVisible(state, 7) ? 7 : 6; return 4; } if (state.step === 'nutritionTargets') return 8; return questionSteps.length - 1; }
function nextAfterFirstInsight(state: OnboardingV3State): QuestionStep { return state.profile.primaryGoal === 'hit_macros' ? 'question5' : 'question3'; }
function nextAfterSecondInsight(state: OnboardingV3State): OnboardingV3Step { return state.profile.primaryGoal === 'hit_macros' ? 'question9' : 'question6'; }
function clearScanState(state: OnboardingV3State): OnboardingV3State { return { ...state, step: 'postPurchase', analysisId: null, dishName: null, photoUri: null, recipeId: null, scanSessionId: null, error: null }; }
function isResumableStep(value: string | null): value is OnboardingV3Step { return Boolean(value && ONBOARDING_V3_STEPS.includes(value as OnboardingV3Step) && !['splash', 'complete'].includes(value as OnboardingV3Step) && !isRealInputUnlocked(value as OnboardingV3Step)); }
function needsPrimaryGoal(step: OnboardingV3Step): boolean { return !['splash', 'showcase', 'foxIntro', 'nameFox', 'name', 'foxExplainer1', 'foxExplainer2', 'ageEligibility', 'primaryGoal'].includes(step); }

/**
 * V4's onboarding rebuild (Okyo_Onboarding_V4_Implementation_Plan.md) briefly
 * removed showcase/nameFox/branchIntro/secondaryGoals from ONBOARDING_V3_STEPS
 * before V4 was rejected and V3 was restored (see devFlags.ts's
 * ONBOARDING_V4_ENABLED). All four are live steps again, so `isResumableStep`
 * accepts their raw ids directly and this map is not consulted for them.
 * `personalizedFuture` is kept for backward-compat with any install that
 * persisted it while it was documented as a distinct step, and mirrors this
 * file's own always-redirect handling of it in the HYDRATE branch above.
 * Exported (with `mapLegacyResumeStep`) because a still-live V4-era test
 * exercises it directly; nothing in the restored V3 path calls it.
 */
export const LEGACY_RESUME_STEP_MAP: Readonly<Record<string, OnboardingV3Step>> = Object.freeze({
  personalizedFuture: 'planReady',
  nameFox: 'nameFox',
  branchIntro: 'question1',
  secondaryGoals: 'dietaryPreferences',
});

export function mapLegacyResumeStep(step: string | null): string | null {
  if (step === null) return null;
  if (isResumableStep(step)) return step;
  return LEGACY_RESUME_STEP_MAP[step] ?? step;
}

export type OnboardingActivationPhase = 'questions' | 'first_scan' | 'recipe_revealed' | 'paywall' | 'entitled' | 'complete';

const ENTITLED_PHASE_STEPS: ReadonlySet<OnboardingV3Step> = new Set(['postPurchase', 'input', 'photoConfirm', 'analyzing']);
const RECIPE_REVEALED_PHASE_STEPS: ReadonlySet<OnboardingV3Step> = new Set(['recipe', 'cooking', 'cookingComplete']);

/**
 * Categorizes a step into the activation phases V4 (onboardingV4Route.ts)
 * reuses this type for. Purely descriptive; the restored V3 path does not
 * read this.
 */
export function getOnboardingActivationPhase(step: OnboardingV3Step): OnboardingActivationPhase {
  if (step === 'paywall') return 'paywall';
  if (step === 'complete') return 'complete';
  if (ENTITLED_PHASE_STEPS.has(step)) return 'entitled';
  if (RECIPE_REVEALED_PHASE_STEPS.has(step)) return 'recipe_revealed';
  return 'questions';
}
