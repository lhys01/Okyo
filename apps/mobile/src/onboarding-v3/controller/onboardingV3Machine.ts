import type { FoodPreferences } from '../../state/foodPreferences';
import type { AttributionSource } from '../state/attribution';
import { sanitizeMascotName } from '../state/mascotName';
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
} from '../state/personalizedOnboarding';

export type OnboardingV3Step =
  | 'splash' | 'showcase' | 'nameFox' | 'name' | 'primaryGoal' | 'branchIntro'
  | 'question1' | 'question2' | 'question3' | 'question4' | 'question5' | 'question6' | 'question7' | 'question8' | 'question9'
  | 'holdReveal' | 'branchReveal' | 'branchInsight' | 'nutritionTargets' | 'branchDemo'
  | 'secondaryGoals' | 'dietaryPreferences' | 'personalizedFuture' | 'planReady' | 'paywall'
  | 'postPurchase' | 'input' | 'photoConfirm' | 'analyzing' | 'recipe' | 'cooking' | 'cookingComplete' | 'complete';

export const ONBOARDING_V3_STEPS: readonly OnboardingV3Step[] = Object.freeze([
  'splash', 'showcase', 'nameFox', 'name', 'primaryGoal', 'branchIntro', 'question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7', 'question8', 'question9',
  'holdReveal', 'branchReveal', 'branchInsight', 'nutritionTargets', 'branchDemo', 'secondaryGoals', 'dietaryPreferences', 'personalizedFuture', 'planReady', 'paywall', 'postPurchase', 'input', 'photoConfirm', 'analyzing', 'recipe', 'cooking', 'cookingComplete', 'complete',
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
  | { type: 'SPLASH_FINISHED'; elapsedMs: number; fontsLoaded: boolean } | { type: 'SHOWCASE_FINISHED' } | { type: 'MASCOT_NAME_SUBMITTED'; raw: string }
  | { type: 'ATTRIBUTION_SELECTED'; source: AttributionSource } | { type: 'ATTRIBUTION_SKIPPED' } | { type: 'NAME_SUBMITTED'; raw: string }
  | { type: 'PRIMARY_GOAL_SELECTED'; goal: PrimaryGoal } | { type: 'ANSWER_SET'; key: string; value: PersonalizedAnswer } | { type: 'CONTINUE' } | { type: 'HOLD_COMPLETED' }
  | { type: 'SECONDARY_GOALS_SET'; goals: SecondaryGoal[] } | { type: 'DIETARY_SET'; preferences: FoodPreferences }
  | { type: 'PHOTO_SELECTED'; uri: string } | { type: 'DESCRIPTION_SUBMITTED'; text: string; scanSessionId?: string } | { type: 'PERMISSION_DENIED'; message?: string } | { type: 'PHOTO_CONFIRMED'; scanSessionId?: string }
  | { type: 'ANALYSIS_SUCCEEDED'; analysisId: string; dishName: string } | { type: 'ANALYSIS_REJECTED'; kind: 'ingredients_only' | 'not_food' | 'unclear'; message: string } | { type: 'ANALYSIS_FAILED'; message: string }
  | { type: 'RECIPE_READY'; recipeId: string } | { type: 'RECIPE_FAILED'; message: string } | { type: 'RECIPE_RETRY' } | { type: 'START_OVER' } | { type: 'COOK' } | { type: 'COOKING_COMPLETED' } | { type: 'COOKING_EXITED' }
  | { type: 'PURCHASE_SUCCEEDED'; entitled: boolean } | { type: 'PURCHASE_CANCELLED' } | { type: 'PURCHASE_FAILED'; message: string } | { type: 'RESTORE_SUCCEEDED'; entitled: boolean } | { type: 'DEV_BYPASS_COMPLETED' } | { type: 'BACK' };

export const initialOnboardingV3State: OnboardingV3State = Object.freeze({ step: 'splash', resumeStep: null, profile: emptyPersonalizedProfile, mascotName: 'Kiko', attribution: null, dietaryRestrictions: [], dietaryDislikes: [], analysisId: null, dishName: null, photoUri: null, recipeId: null, scanSessionId: null, error: null });

export function onboardingV3Reducer(state: OnboardingV3State, event: OnboardingV3Event): OnboardingV3State {
  if (event.type === 'HYDRATE' && state.step === 'splash') {
    const profile = normalizePersonalizedProfile(event.profile);
    const legacyStep = event.resumeStep === 'personalizedFuture' ? 'planReady' : event.resumeStep;
    const requestedStep = isResumableStep(legacyStep) ? legacyStep : null;
    const resumeStep = requestedStep && needsPrimaryGoal(requestedStep) && !profile.primaryGoal ? 'primaryGoal' : requestedStep;
    return { ...state, profile, mascotName: sanitizeMascotName(event.mascotName), attribution: event.attribution, dietaryRestrictions: [...profile.dietaryPreferences.allergies, ...profile.dietaryPreferences.restrictions], dietaryDislikes: [...profile.dietaryPreferences.avoidances, ...profile.dietaryPreferences.dislikes], resumeStep };
  }
  switch (state.step) {
    case 'splash': return event.type === 'SPLASH_FINISHED' && event.elapsedMs >= 700 && (event.fontsLoaded || event.elapsedMs >= 1100) ? { ...state, step: state.resumeStep ?? 'showcase', resumeStep: null, error: null } : state;
    case 'showcase': if (event.type === 'SHOWCASE_FINISHED') return { ...state, step: 'nameFox' }; if (event.type === 'ATTRIBUTION_SELECTED') return { ...state, attribution: event.source }; if (event.type === 'ATTRIBUTION_SKIPPED') return { ...state, attribution: null }; return state;
    case 'nameFox': if (event.type === 'MASCOT_NAME_SUBMITTED') return { ...state, step: 'name', mascotName: sanitizeMascotName(event.raw) }; return event.type === 'BACK' ? { ...state, step: 'showcase' } : state;
    case 'name': if (event.type === 'NAME_SUBMITTED' && sanitizeUserName(event.raw)) return { ...state, step: 'primaryGoal', profile: { ...state.profile, name: sanitizeUserName(event.raw) } }; return event.type === 'BACK' ? { ...state, step: 'nameFox' } : state;
    case 'primaryGoal':
      if (event.type === 'PRIMARY_GOAL_SELECTED' && isPrimaryGoal(event.goal)) return { ...state, step: 'branchIntro', profile: { ...state.profile, primaryGoal: event.goal, secondaryGoals: [event.goal], answers: {}, nutritionProfile: event.goal === 'hit_macros' ? { ...state.profile.nutritionProfile } : state.profile.nutritionProfile } };
      return event.type === 'BACK' ? { ...state, step: 'name' } : state;
    case 'branchIntro': return event.type === 'CONTINUE' ? { ...state, step: 'question1' } : event.type === 'BACK' ? { ...state, step: 'primaryGoal' } : state;
    default: break;
  }
  if (isQuestionStep(state.step)) return reduceQuestion(state, event);
  switch (state.step) {
    case 'holdReveal': return event.type === 'HOLD_COMPLETED' ? { ...state, step: 'branchReveal' } : event.type === 'BACK' ? { ...state, step: previousQuestionStep(state) } : state;
    case 'branchReveal': return event.type === 'CONTINUE' ? { ...state, step: nextAfterFirstInsight(state) } : event.type === 'BACK' ? { ...state, step: 'holdReveal' } : state;
    case 'branchInsight': return event.type === 'CONTINUE' ? { ...state, step: nextAfterSecondInsight(state) } : event.type === 'BACK' ? { ...state, step: previousQuestionStep(state) } : state;
    case 'nutritionTargets': return event.type === 'CONTINUE' ? { ...state, step: 'branchDemo' } : event.type === 'BACK' ? { ...state, step: 'question9' } : state;
    case 'branchDemo': return event.type === 'CONTINUE' ? { ...state, step: 'dietaryPreferences' } : event.type === 'BACK' ? { ...state, step: state.profile.primaryGoal === 'hit_macros' ? 'nutritionTargets' : 'branchInsight' } : state;
    case 'dietaryPreferences':
      if (event.type === 'DIETARY_SET') { const profile = setDietaryPreferences(state.profile, event.preferences); return { ...state, profile, dietaryRestrictions: [...profile.dietaryPreferences.allergies, ...profile.dietaryPreferences.restrictions], dietaryDislikes: [...profile.dietaryPreferences.avoidances, ...profile.dietaryPreferences.dislikes], step: 'secondaryGoals' }; }
      return event.type === 'BACK' ? { ...state, step: 'branchDemo' } : state;
    case 'secondaryGoals':
      if (event.type === 'SECONDARY_GOALS_SET') { const primary = state.profile.primaryGoal; return { ...state, profile: { ...state.profile, secondaryGoals: [...new Set(primary ? [primary, ...event.goals.filter((goal) => goal !== primary)] : event.goals)] }, step: 'planReady' }; }
      return event.type === 'BACK' ? { ...state, step: 'dietaryPreferences' } : state;
    case 'personalizedFuture': return event.type === 'CONTINUE' ? { ...state, step: 'planReady' } : event.type === 'BACK' ? { ...state, step: 'dietaryPreferences' } : state;
    case 'planReady': return event.type === 'CONTINUE' ? { ...state, step: 'paywall' } : event.type === 'BACK' ? { ...state, step: 'secondaryGoals' } : state;
    case 'paywall':
      if (event.type === 'PURCHASE_SUCCEEDED') return event.entitled ? { ...state, step: 'postPurchase', error: null } : { ...state, error: { kind: 'not_entitled', message: 'Your purchase completed, but Okyo Pro is not active yet.' } };
      if (event.type === 'RESTORE_SUCCEEDED') return event.entitled ? { ...state, step: 'postPurchase', error: null } : { ...state, error: { kind: 'nothing_to_restore', message: "We couldn't find an Okyo Pro subscription to restore." } };
      if (event.type === 'PURCHASE_CANCELLED') return { ...state, error: null }; if (event.type === 'PURCHASE_FAILED') return { ...state, error: { kind: 'purchase', message: event.message } }; if (event.type === 'DEV_BYPASS_COMPLETED') return { ...state, step: 'complete', error: null }; return state;
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
  if ((goal !== 'hit_macros' && index === 1) || (goal === 'hit_macros' && index === 3)) return { ...state, step: 'holdReveal' };
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
function needsPrimaryGoal(step: OnboardingV3Step): boolean { return !['splash', 'showcase', 'nameFox', 'name', 'primaryGoal'].includes(step); }
