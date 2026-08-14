import type { DietarySafetyAnswers } from '../state/dietaryContracts';
import type { FuturePrimaryGoal, PrimaryGoal } from '../state/personalizedOnboarding';
import type { OnboardingV4ScanInputMethod } from '../state/onboardingV4Draft';
import type { OnboardingV4EventName, OnboardingV4EventProperties } from '../../analytics/onboardingV4Events';

export type OnboardingV4EventToEmit = { name: OnboardingV4EventName; properties: OnboardingV4EventProperties };

/**
 * Pure analytics-decision logic for `OnboardingV4.tsx` (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 03), split out so duplicate-emission avoidance is directly unit-testable
 * without rendering a React Native component tree — this repo's `node:test`
 * runner can't transform `react-native` (see `analytics/onboardingV4Events.ts`'s
 * header comment). `OnboardingV4.tsx` calls these once per real transition and
 * forwards non-null results to `trackOnboardingV4`.
 */
export function onboardingV4StartedEvent(): OnboardingV4EventToEmit {
  return { name: 'onboarding_started', properties: { screen: 'splash' } };
}

/** Returns null when `step` is the same step already reported, so a re-render never re-emits the same screen view. */
export function onboardingV4ScreenViewedEvent(step: string, previouslyViewedStep: string | null): OnboardingV4EventToEmit | null {
  if (step === previouslyViewedStep) return null;
  return { name: 'onboarding_screen_viewed', properties: { screen: step } };
}

export function onboardingV4GoalSelectedEvent(goal: FuturePrimaryGoal): OnboardingV4EventToEmit {
  return { name: 'primary_goal_selected', properties: { branch: goal } };
}

/**
 * Step 05. `fieldId` is the field's *name* (e.g. `'takeoutFrequency'`), never
 * its value — the answer content itself (a choice, a dollar amount, a body
 * measurement) never leaves this function. `screen` records which step the
 * answer belongs to for funnel analysis.
 */
export function onboardingV4AnswerSubmittedEvent(step: string, fieldId: string): OnboardingV4EventToEmit {
  return { name: 'onboarding_answer_submitted', properties: { screen: step, actionType: fieldId } };
}

/** Fires once per insight view (guarded by the same last-viewed-step ref OnboardingV4.tsx already uses for screen_viewed dedup) — branch only, never the insight's computed numbers. */
export function onboardingV4InsightViewedEvent(branch: PrimaryGoal): OnboardingV4EventToEmit {
  return { name: 'personal_insight_viewed', properties: { screen: 'personalInsight', branch } };
}

/**
 * Step 06. Only counts and the explicit none-selected flag — never the
 * group contents, never custom-entry text (allergy/restriction/dislike
 * names and free text never leave this function).
 */
export function onboardingV4DietarySavedEvent(answers: DietarySafetyAnswers): OnboardingV4EventToEmit {
  return {
    name: 'dietary_preferences_saved',
    properties: {
      screen: 'dietarySafety',
      allergyCount: answers.allergies.length,
      restrictionCount: answers.restrictions.length,
      dislikeCount: answers.dislikes.length,
      selectedNoneOfThese: answers.noneOfThese,
    },
  };
}

/** Step 07. Branch only — never any of the plan's computed numbers or copy. */
export function onboardingV4PlanViewedEvent(branch: PrimaryGoal): OnboardingV4EventToEmit {
  return { name: 'personal_plan_viewed', properties: { screen: 'plan', branch } };
}

/** Step 07. The chosen method only — never the description text or the image itself. */
export function onboardingV4ScanInputSelectedEvent(method: OnboardingV4ScanInputMethod): OnboardingV4EventToEmit {
  return { name: 'first_scan_input_selected', properties: { screen: 'scanEntry', actionType: method } };
}

export function onboardingV4FirstRecipeRevealedEvent(branch: PrimaryGoal): OnboardingV4EventToEmit {
  return { name: 'first_recipe_revealed', properties: { screen: 'recipe', branch } };
}

export function onboardingV4MeaningfulActionSelectedEvent(actionType: 'cook' | 'customize', branch: PrimaryGoal): OnboardingV4EventToEmit {
  return { name: 'meaningful_action_selected', properties: { screen: 'recipe', branch, actionType } };
}

export function onboardingV4PaywallViewedEvent(actionType: 'cook' | 'customize', branch: PrimaryGoal): OnboardingV4EventToEmit {
  return { name: 'paywall_viewed', properties: { screen: 'paywall', source: 'first_recipe', branch, actionType } };
}

export function onboardingV4PurchaseEvent(name: 'purchase_started' | 'purchase_succeeded' | 'purchase_failed' | 'purchase_restored', actionType: 'cook' | 'customize', branch: PrimaryGoal, errorKind?: string): OnboardingV4EventToEmit {
  return { name, properties: { screen: 'paywall', source: 'first_recipe', branch, actionType, ...(errorKind ? { errorKind } : {}) } };
}
