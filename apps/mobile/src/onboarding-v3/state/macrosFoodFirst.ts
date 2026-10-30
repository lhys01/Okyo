import type { PersonalizedOnboardingProfile } from './personalizedOnboarding';

export const MACROS_FOOD_FIRST_VERSION = 'food_first_v1';
export const MACROS_FOOD_FOCUSES = ['Protein', 'Calories', 'Balanced macros', 'Portions', 'Less tracking', 'Just the information'] as const;
export const MACROS_FOOD_BARRIERS = ['Boring meals', 'Not enough time', 'I get too hungry', 'Eating out throws me off', 'Planning takes too much effort', 'Keeping it consistent', 'Guessing portions'] as const;
export function usesFoodFirstMacros(profile: PersonalizedOnboardingProfile) {
  return profile.primaryGoal === 'hit_macros' && profile.answers.macrosExperience === MACROS_FOOD_FIRST_VERSION;
}
export function macrosFoodFirstReveal(profile: PersonalizedOnboardingProfile) {
  const barrier = profile.answers.macrosObstacle;
  const focus = profile.macroPreferences?.focus;
  return {
    title: barrier === 'Boring meals' ? 'Keep the craving.\nSkip the bland.' : barrier === 'Not enough time' ? 'Good food.\nLess figuring it out.' : barrier === 'Guessing portions' ? 'A real dish.\nA clearer serving.' : 'Food you look\nforward to eating.',
    response: barrier === 'Boring meals' ? 'Start with a dish you love—not another meal you have to tolerate.' : barrier === 'Not enough time' ? 'Ingredients and clear steps together, so you can decide what fits your day.' : barrier === 'Guessing portions' ? 'See ingredient amounts and nutrition for each serving, instead of guessing from a photo.' : 'Start with one meal you want to make. No perfect week required.',
    insight: focus === 'Protein' ? 'Protein, front and center.' : focus === 'Calories' ? 'Calories in serving-size context.' : focus === 'Balanced macros' ? 'Protein, carbs, and fat together.' : 'Understand the meal. No target needed.',
  };
}
