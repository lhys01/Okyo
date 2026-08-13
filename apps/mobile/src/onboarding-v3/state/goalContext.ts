import type { GoalContext } from '../../api/types';
import type { PersonalizedOnboardingProfile } from './personalizedOnboarding';

/**
 * Only product-relevant onboarding answers travel with a real recipe request.
 * This keeps the prompt useful without forwarding questionnaire trivia.
 */
export function buildGoalContext(profile: PersonalizedOnboardingProfile): GoalContext {
  const handsOnTimeMinutes = profile.primaryGoal === 'save_money'
    ? profile.savings.handsOnTimeMinutes
    : profile.primaryGoal === 'eat_healthier'
      ? profile.health.handsOnTimeMinutes
      : undefined;

  return {
    primaryGoal: profile.primaryGoal ?? undefined,
    secondaryGoals: profile.secondaryGoals,
    handsOnTimeMinutes: handsOnTimeMinutes ?? undefined,
    defaultServings: servingsForHousehold(profile.savings.householdSize) ?? undefined,
    cookingPriority: profile.savings.cookingPriority ?? undefined,
    orderingFriction: profile.savings.orderingFriction.length
      ? profile.savings.orderingFriction.join(', ')
      : undefined,
    healthPriorities: profile.health.healthGoals.length ? profile.health.healthGoals : undefined,
    trackingPreference: profile.health.trackingPreference ?? undefined,
    nutritionTargets: profile.nutritionTargets ? {
      calories: profile.nutritionTargets.calories,
      proteinGrams: profile.nutritionTargets.proteinGrams,
      carbsGrams: profile.nutritionTargets.carbsGrams,
      fatGrams: profile.nutritionTargets.fatGrams,
    } : undefined,
  };
}

function servingsForHousehold(value: string | null) {
  if (value === 'Just me') return 1;
  if (value === '2 people') return 2;
  if (value === '3–4 people') return 4;
  if (value === '5+ people') return 5;
  return null;
}
