import { EMPTY_FOOD_PREFERENCES, normalizeFoodPreferences, type FoodPreferences } from '../../state/foodPreferences';
import {
  calculateNutritionTargets,
  emptyNutritionProfile,
  type ActivityLevel,
  type BiologicalSexForEstimate,
  type GoalRate,
  type MacroGoal,
  type NutritionProfile,
  type NutritionTargets,
  type ProteinPreference,
} from './nutritionTargets';

export const PRIMARY_GOALS = ['save_money', 'eat_healthier', 'hit_macros'] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

/**
 * `not_sure` is a planned fourth primary goal (see onboarding rebuild blueprint
 * §14.8). Its typing is prepared ahead of the screens so downstream code can
 * start guarding for it, but it is deliberately excluded from PRIMARY_GOALS so
 * no current screen (which renders one GoalCard per PRIMARY_GOALS entry) offers
 * it yet.
 */
export const FUTURE_PRIMARY_GOALS = [...PRIMARY_GOALS, 'not_sure'] as const;
export type FuturePrimaryGoal = (typeof FUTURE_PRIMARY_GOALS)[number];
export function isFuturePrimaryGoal(value: unknown): value is FuturePrimaryGoal { return typeof value === 'string' && FUTURE_PRIMARY_GOALS.includes(value as FuturePrimaryGoal); }
export const SECONDARY_GOALS = [...PRIMARY_GOALS, 'cook_more', 'waste_less', 'save_time'] as const;
export type SecondaryGoal = (typeof SECONDARY_GOALS)[number];
export type PersonalizedAnswer = string | number | string[] | null;

export type SavingsProfile = {
  takeoutFrequency: string | null;
  spendPerMeal: number | null;
  orderingFriction: string[];
  realisticCookingFrequency: string | null;
  cookingPriority: string | null;
  householdSize: string | null;
  handsOnTimeMinutes: number | null;
};

export type HealthProfile = {
  healthGoals: string[];
  healthChallenges: string[];
  protectPriority: string | null;
  difficultMeals: string[];
  trackingPreference: string | null;
  handsOnTimeMinutes: number | null;
};

export type PersonalizedOnboardingProfile = {
  name: string;
  primaryGoal: PrimaryGoal | null;
  secondaryGoals: SecondaryGoal[];
  /** Kept for old resumable onboarding data and lightweight analytics. */
  answers: Record<string, PersonalizedAnswer>;
  savings: SavingsProfile;
  health: HealthProfile;
  nutritionProfile: NutritionProfile;
  nutritionTargets: NutritionTargets | null;
  dietaryPreferences: FoodPreferences;
  /** Legacy mirrors retained so older app surfaces keep working. */
  dietaryRestrictions: string[];
  dietaryOther: string;
};

export const emptySavingsProfile: SavingsProfile = Object.freeze({ takeoutFrequency: null, spendPerMeal: null, orderingFriction: [], realisticCookingFrequency: null, cookingPriority: null, householdSize: null, handsOnTimeMinutes: null });
export const emptyHealthProfile: HealthProfile = Object.freeze({ healthGoals: [], healthChallenges: [], protectPriority: null, difficultMeals: [], trackingPreference: null, handsOnTimeMinutes: null });
export const emptyPersonalizedProfile: PersonalizedOnboardingProfile = Object.freeze({
  name: '', primaryGoal: null, secondaryGoals: [], answers: {}, savings: emptySavingsProfile,
  health: emptyHealthProfile, nutritionProfile: emptyNutritionProfile, nutritionTargets: null,
  dietaryPreferences: EMPTY_FOOD_PREFERENCES, dietaryRestrictions: [], dietaryOther: '',
});

export const primaryGoalLabels: Record<PrimaryGoal, string> = { save_money: 'Save money on food', eat_healthier: 'Eat healthier', hit_macros: 'Hit my macros' };
export const secondaryGoalLabels: Record<SecondaryGoal, string> = { ...primaryGoalLabels, cook_more: 'Cook more', waste_less: 'Waste less food', save_time: 'Save time' };
export const TAKEOUT_FREQUENCY: Record<string, number> = { 'Almost every day': 6, '4–5 times a week': 4.5, '2–3 times a week': 2.5, 'About once a week': 1, Rarely: 0.25 };
export const COOKING_FREQUENCY: Record<string, number> = { 'Almost every day': 6, 'A few times a week': 3, 'Once a week': 1, Rarely: 0.25, 'Basically never': 0 };

export type PersonalizedQuestion = {
  id: string;
  title: string;
  helper?: string;
  kind: 'single' | 'multi' | 'money' | 'protein' | 'number' | 'stepper';
  options?: readonly string[];
  optional?: boolean;
  visible?: (profile: PersonalizedOnboardingProfile) => boolean;
};
export type PersonalizedGoalContent = { questions: readonly PersonalizedQuestion[]; holdPrompt: string; revealHeadline: string; demoHeadline: string; futureHeadline: string; paywallHeadline: string; planBenefits: readonly string[] };

const timeOptions = ['10 min', '20 min', '30 min', '45+ min'] as const;
export const personalizedGoalContent: Record<PrimaryGoal, PersonalizedGoalContent> = {
  save_money: {
    questions: [
      { id: 'takeoutFrequency', title: 'How often do you order takeout or eat out?', kind: 'single', options: Object.keys(TAKEOUT_FREQUENCY) },
      { id: 'spendPerMeal', title: 'About how much does one meal usually cost?', helper: 'Move the amount that feels most typical.', kind: 'money' },
      { id: 'orderingFriction', title: 'What usually makes you order instead of cook?', kind: 'multi', options: ["I don't know what to make", 'Cooking feels difficult', "I'm missing ingredients", "I don't have much time", 'Restaurant food sounds better', 'Recipe searching is annoying'] },
      { id: 'realisticCookingFrequency', title: 'How often would you realistically like to cook instead?', kind: 'single', options: ['Once more per week', '2–3 more times', 'Most weekdays', 'Almost every day'] },
      { id: 'cookingPriority', title: 'What matters most when you cook?', kind: 'single', options: ['Spend as little as possible', 'Balance cost and taste', 'Save time', 'Use ingredients I already have'] },
      { id: 'householdSize', title: 'Who are you usually cooking for?', kind: 'single', options: ['Just me', '2 people', '3–4 people', '5+ people'] },
      { id: 'handsOnTimeMinutes', title: 'How much hands-on cooking time feels realistic?', kind: 'single', options: timeOptions },
    ],
    holdPrompt: 'Want to see what that adds up to?', revealHeadline: 'That can add up faster than it feels.', demoHeadline: 'Anything you crave can become a meal instead of an order.', futureHeadline: 'One homemade craving a week can change the picture.', paywallHeadline: 'Start spending less on the food you actually want.', planBenefits: ['Recreate food you already want', 'Estimate homemade cost', 'Prioritize your preferred cooking time', 'Suggest cheaper substitutions'],
  },
  eat_healthier: {
    questions: [
      { id: 'healthGoals', title: 'What does eating healthier mean to you?', kind: 'multi', options: ['Fewer calories', 'More whole foods', 'More protein', 'Better portions', 'Less takeout', 'Eating better overall'] },
      { id: 'healthChallenges', title: 'What makes eating healthier hardest?', kind: 'multi', options: ['Healthy recipes feel boring', "I crave foods that don't fit my goals", "I don't know what to make", 'Tracking everything is annoying', "I don't have enough time", 'Healthy cooking feels complicated'] },
      { id: 'protectPriority', title: 'What do you want Okyo to protect most?', kind: 'single', options: ['Foods I already love', 'Convenience', 'Portion size', 'Protein', 'Variety'] },
      { id: 'difficultMeals', title: 'Which meals are hardest?', kind: 'multi', options: ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Late-night eating'] },
      { id: 'trackingPreference', title: 'How much nutrition tracking do you want?', kind: 'single', options: ['Keep meals generally balanced', 'Show basic calories and protein', 'Show full macros', 'I want detailed tracking'] },
      { id: 'handsOnTimeMinutes', title: 'How much hands-on cooking time feels realistic?', kind: 'single', options: timeOptions },
    ],
    holdPrompt: 'Want food to work with your goals?', revealHeadline: "Your favorite foods don't have to fight your goals.", demoHeadline: 'Change the recipe, not the craving.', futureHeadline: 'Keep the food you love. Change what needs changing.', paywallHeadline: 'Make the foods you love fit your goals.', planBenefits: ['Keep foods you already love', 'Adjust recipes when needed', 'Show nutrition at your chosen level', 'Prioritize realistic cooking time'],
  },
  hit_macros: {
    questions: [
      { id: 'macroGoal', title: 'What are you working toward?', kind: 'single', options: ['Lose fat', 'Maintain', 'Build muscle', 'Improve performance', 'Hit protein consistently'] },
      { id: 'ageYears', title: 'How old are you?', helper: 'We use this only for your starting estimate.', kind: 'number' },
      { id: 'heightCm', title: 'How tall are you?', helper: 'Use centimetres for now.', kind: 'number' },
      { id: 'weightKg', title: 'What do you weigh?', helper: 'Use kilograms for now.', kind: 'number' },
      { id: 'biologicalSex', title: 'For the calorie estimate', helper: 'This is only used in the calculation.', kind: 'single', options: ['Female', 'Male', 'Prefer not to say'] },
      { id: 'activityLevel', title: 'How active is your typical week?', kind: 'single', options: ['Mostly sitting', 'Lightly active', 'Active', 'Very active'] },
      { id: 'trainingDaysPerWeek', title: 'How many days a week do you train?', kind: 'stepper' },
      { id: 'desiredRatePerWeek', title: 'What pace feels right?', helper: 'We only use gentle, sustainable starting estimates.', kind: 'single', options: ['Slow', 'Moderate'], visible: (profile) => ['lose_fat', 'build_muscle'].includes(profile.nutritionProfile.goal ?? '') },
      { id: 'proteinTarget', title: 'How do you want to set protein?', kind: 'protein' },
    ],
    holdPrompt: "Let's make food fit your numbers.", revealHeadline: 'The food you want can work with your targets.', demoHeadline: 'Great food. Your numbers.', futureHeadline: 'Choose the food first. Okyo helps shape the numbers.', paywallHeadline: 'Make every meal work harder toward your targets.', planBenefits: ['Start with practical calorie targets', 'Prioritize protein in recipes', 'Show target-aware recipe edits', 'Keep macros visible when you want them'],
  },
};

export function sanitizeUserName(value: unknown): string { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 40) : ''; }
export function isPrimaryGoal(value: unknown): value is PrimaryGoal { return typeof value === 'string' && PRIMARY_GOALS.includes(value as PrimaryGoal); }

function asStringArray(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()))] : []; }
function asNumber(value: unknown, min: number, max: number): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null; }
function asChoice<T extends string>(value: unknown, choices: readonly T[]): T | null { return typeof value === 'string' && choices.includes(value as T) ? value as T : null; }
function timeFromAnswer(value: unknown): number | null { return value === '10 min' ? 10 : value === '20 min' ? 20 : value === '30 min' ? 30 : value === '45+ min' ? 45 : null; }
function macroGoalFromAnswer(value: unknown): MacroGoal | null { return ({ 'Lose fat': 'lose_fat', Maintain: 'maintain', 'Build muscle': 'build_muscle', 'Improve performance': 'improve_performance', 'Hit protein consistently': 'hit_protein' } as Record<string, MacroGoal>)[String(value)] ?? null; }

/** Only a complete, user-edited target set may override a recalculated estimate on resume. */
function normalizeManualNutritionTargets(value: unknown): NutritionTargets | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<NutritionTargets>;
  if (candidate.source !== 'manual' || candidate.calculationVersion !== 1) return null;
  const calories = asNumber(candidate.calories, 1000, 5000);
  const proteinGrams = asNumber(candidate.proteinGrams, 20, 350);
  const carbsGrams = asNumber(candidate.carbsGrams, 0, 700);
  const fatGrams = asNumber(candidate.fatGrams, 20, 250);
  if (calories === null || proteinGrams === null || carbsGrams === null || fatGrams === null) return null;
  return {
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    source: 'manual',
    calculationVersion: 1,
    calculatedAt: typeof candidate.calculatedAt === 'string' ? candidate.calculatedAt : new Date(0).toISOString(),
  };
}

export function getVisibleQuestions(goal: PrimaryGoal, profile: PersonalizedOnboardingProfile): PersonalizedQuestion[] { return personalizedGoalContent[goal].questions.filter((question) => !question.visible || question.visible(profile)); }

export function setPersonalizedAnswer(profile: PersonalizedOnboardingProfile, key: string, value: PersonalizedAnswer): PersonalizedOnboardingProfile {
  const next: PersonalizedOnboardingProfile = { ...profile, answers: { ...profile.answers, [key]: value } };
  if (key === 'takeoutFrequency') next.savings = { ...next.savings, takeoutFrequency: typeof value === 'string' ? value : null };
  if (key === 'spendPerMeal') next.savings = { ...next.savings, spendPerMeal: asNumber(value, 1, 500) };
  if (key === 'orderingFriction') next.savings = { ...next.savings, orderingFriction: asStringArray(value) };
  if (key === 'realisticCookingFrequency') next.savings = { ...next.savings, realisticCookingFrequency: typeof value === 'string' ? value : null };
  if (key === 'cookingPriority') next.savings = { ...next.savings, cookingPriority: typeof value === 'string' ? value : null };
  if (key === 'householdSize') next.savings = { ...next.savings, householdSize: typeof value === 'string' ? value : null };
  if (key === 'healthGoals') next.health = { ...next.health, healthGoals: asStringArray(value) };
  if (key === 'healthChallenges') next.health = { ...next.health, healthChallenges: asStringArray(value) };
  if (key === 'protectPriority') next.health = { ...next.health, protectPriority: typeof value === 'string' ? value : null };
  if (key === 'difficultMeals') next.health = { ...next.health, difficultMeals: asStringArray(value) };
  if (key === 'trackingPreference') next.health = { ...next.health, trackingPreference: typeof value === 'string' ? value : null };
  if (key === 'handsOnTimeMinutes') {
    const minutes = timeFromAnswer(value);
    next.savings = { ...next.savings, handsOnTimeMinutes: minutes };
    next.health = { ...next.health, handsOnTimeMinutes: minutes };
  }
  const nutrition = { ...next.nutritionProfile };
  if (key === 'macroGoal') nutrition.goal = macroGoalFromAnswer(value);
  if (key === 'ageYears') nutrition.ageYears = asNumber(value, 13, 100);
  if (key === 'heightCm') nutrition.heightCm = asNumber(value, 120, 230);
  if (key === 'weightKg') nutrition.weightKg = asNumber(value, 35, 300);
  if (key === 'biologicalSex') nutrition.biologicalSex = ({ Female: 'female', Male: 'male', 'Prefer not to say': 'prefer_not_to_say' } as Record<string, BiologicalSexForEstimate>)[String(value)] ?? null;
  if (key === 'activityLevel') nutrition.activityLevel = ({ 'Mostly sitting': 'mostly_sitting', 'Lightly active': 'lightly_active', Active: 'active', 'Very active': 'very_active' } as Record<string, ActivityLevel>)[String(value)] ?? null;
  if (key === 'trainingDaysPerWeek') nutrition.trainingDaysPerWeek = asNumber(value, 0, 7);
  if (key === 'desiredRatePerWeek') nutrition.desiredRatePerWeek = ({ Slow: 'slow', Moderate: 'moderate' } as Record<string, GoalRate>)[String(value)] ?? null;
  if (key === 'proteinTarget') { nutrition.proteinPreference = typeof value === 'number' ? 'manual' : 'estimate'; nutrition.manualProteinTargetGrams = typeof value === 'number' ? asNumber(value, 40, 350) : null; }
  next.nutritionProfile = nutrition;
  next.nutritionTargets = calculateNutritionTargets(nutrition);
  return next;
}

export function setDietaryPreferences(profile: PersonalizedOnboardingProfile, preferences: FoodPreferences): PersonalizedOnboardingProfile {
  const dietaryPreferences = normalizeFoodPreferences(preferences);
  return { ...profile, dietaryPreferences, dietaryRestrictions: [...dietaryPreferences.allergies, ...dietaryPreferences.restrictions], dietaryOther: dietaryPreferences.dislikes.join(', ') };
}

export function normalizePersonalizedProfile(value: unknown): PersonalizedOnboardingProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...emptyPersonalizedProfile, savings: { ...emptySavingsProfile }, health: { ...emptyHealthProfile }, nutritionProfile: { ...emptyNutritionProfile }, dietaryPreferences: { ...EMPTY_FOOD_PREFERENCES } };
  const candidate = value as Partial<PersonalizedOnboardingProfile>;
  const primaryGoal = isPrimaryGoal(candidate.primaryGoal) ? candidate.primaryGoal : null;
  const secondaryGoals = asStringArray(candidate.secondaryGoals).filter((goal): goal is SecondaryGoal => SECONDARY_GOALS.includes(goal as SecondaryGoal));
  const answers = candidate.answers && typeof candidate.answers === 'object' && !Array.isArray(candidate.answers) ? { ...candidate.answers } : {};
  const manuallyEditedTargets = normalizeManualNutritionTargets(candidate.nutritionTargets);
  const dietaryPreferences = normalizeFoodPreferences(candidate.dietaryPreferences ?? {
    // Older personalized profiles used these two flat fields. Map them into
    // the canonical preference shape before normalizing rather than dropping
    // them during a resume or migration.
    restrictions: candidate.dietaryRestrictions,
    dislikes: candidate.dietaryOther ? [candidate.dietaryOther] : [],
  });
  let profile: PersonalizedOnboardingProfile = {
    name: sanitizeUserName(candidate.name), primaryGoal,
    secondaryGoals: primaryGoal ? [...new Set([primaryGoal, ...secondaryGoals])] : secondaryGoals,
    answers, savings: { ...emptySavingsProfile, ...(candidate.savings ?? {}) }, health: { ...emptyHealthProfile, ...(candidate.health ?? {}) },
    nutritionProfile: { ...emptyNutritionProfile, ...(candidate.nutritionProfile ?? {}) }, nutritionTargets: candidate.nutritionTargets ?? null,
    dietaryPreferences, dietaryRestrictions: [...dietaryPreferences.allergies, ...dietaryPreferences.restrictions], dietaryOther: dietaryPreferences.dislikes.join(', '),
  };
  Object.entries(answers).forEach(([key, answer]) => { profile = setPersonalizedAnswer(profile, key, answer); });
  // Replaying answers reconstructs typed branch data. Preserve an explicit
  // Settings edit afterwards so a future resume never silently overwrites it.
  profile.nutritionTargets = manuallyEditedTargets ?? calculateNutritionTargets(profile.nutritionProfile);
  return profile;
}

export function annualTakeoutSpend(profile: PersonalizedOnboardingProfile): number { const frequency = TAKEOUT_FREQUENCY[profile.savings.takeoutFrequency ?? String(profile.answers.takeoutFrequency)] ?? 0; const spend = profile.savings.spendPerMeal ?? (typeof profile.answers.spendPerMeal === 'number' ? profile.answers.spendPerMeal : 0); return Math.round(frequency * spend * 52); }
export function estimatedHomeMealCost(profile: PersonalizedOnboardingProfile): number { const spend = profile.savings.spendPerMeal ?? 0; return spend ? Math.min(7.4, Math.max(4, spend * 0.3)) : 0; }
export function conservativeAnnualProjection(profile: PersonalizedOnboardingProfile): number { const spend = profile.savings.spendPerMeal ?? 0; const replaceableOrders = Math.min(1, TAKEOUT_FREQUENCY[profile.savings.takeoutFrequency ?? ''] ?? 0); return Math.max(0, Math.round((spend - estimatedHomeMealCost(profile)) * replaceableOrders * 52)); }
export function answerSummary(profile: PersonalizedOnboardingProfile, key: string): string { const answer = profile.answers[key]; return Array.isArray(answer) ? answer[0] ?? '' : answer == null ? '' : String(answer); }
