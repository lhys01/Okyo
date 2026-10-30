// Versioned onboarding progress. Serialise/parse are pure so they can be tested
// without AsyncStorage; the storage wrapper lives in state/onboardingPersistence.ts.

import { clampStepToAnswers, isOnboardingStep, type OnboardingStep } from './flow';
import type { OnboardingAnswers } from './types';

export const ONBOARDING_PROGRESS_VERSION = 1;

export type OnboardingProgress = {
  version: number;
  currentStep: OnboardingStep;
  answers: OnboardingAnswers;
  updatedAt: string;
};

export function createProgress(
  currentStep: OnboardingStep,
  answers: OnboardingAnswers,
  updatedAt: string,
): OnboardingProgress {
  return { version: ONBOARDING_PROGRESS_VERSION, currentStep, answers, updatedAt };
}

export function serializeProgress(progress: OnboardingProgress): string {
  return JSON.stringify(progress);
}

/**
 * Returns null for anything we cannot trust — wrong version, corrupt JSON,
 * unknown step. Callers restart at 'intro' on null.
 */
export function parseProgress(raw: string | null | undefined): OnboardingProgress | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.version !== ONBOARDING_PROGRESS_VERSION) return null;
  if (!isOnboardingStep(record.currentStep)) return null;

  const answers = sanitizeAnswers(record.answers);
  const step = clampStepToAnswers(record.currentStep, answers);
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  return { version: ONBOARDING_PROGRESS_VERSION, currentStep: step, answers, updatedAt };
}

/** Drops anything that is not a recognised shape rather than trusting stored data. */
function sanitizeAnswers(value: unknown): OnboardingAnswers {
  if (typeof value !== 'object' || value === null) return {};
  const raw = value as Record<string, unknown>;
  const out: OnboardingAnswers = {};

  const problems = ['decision_help', 'ingredient_flexibility', 'less_effort', 'use_food_first', 'save_time'];
  if (typeof raw.problem === 'string' && problems.includes(raw.problem)) {
    out.problem = raw.problem as OnboardingAnswers['problem'];
  }

  const guidances = ['step_by_step', 'light', 'essentials'];
  if (typeof raw.guidance === 'string' && guidances.includes(raw.guidance)) {
    out.guidance = raw.guidance as OnboardingAnswers['guidance'];
  }

  if (raw.dietPattern === 'vegetarian' || raw.dietPattern === 'vegan') {
    out.dietPattern = raw.dietPattern;
  }

  if (Array.isArray(raw.avoid)) {
    const allowed = ['gluten', 'dairy', 'nuts'];
    const avoid = raw.avoid.filter((a): a is string => typeof a === 'string' && allowed.includes(a));
    if (avoid.length) out.avoid = avoid as OnboardingAnswers['avoid'];
  }

  const priorities = ['speed', 'fewest_ingredients', 'lowest_cost'];
  if (typeof raw.recipePriority === 'string' && priorities.includes(raw.recipePriority)) {
    out.recipePriority = raw.recipePriority as OnboardingAnswers['recipePriority'];
  }

  const followUp = sanitizeFollowUp(raw.followUp);
  if (followUp) out.followUp = followUp;

  return out;
}

function sanitizeFollowUp(value: unknown): OnboardingAnswers['followUp'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const frictions = [
    'random_ingredients', 'low_energy', 'cooking_for_others', 'needs_substitutions',
    'mark_optional', 'avoid_extra_shopping', 'fewer_ingredients', 'fewer_steps',
    'clearer_instructions', 'less_cleanup',
  ];
  if (raw.kind === 'friction' && typeof raw.value === 'string' && frictions.includes(raw.value)) {
    return { kind: 'friction', value: raw.value as never };
  }
  const spoils = ['produce', 'leftovers', 'protein', 'opened'];
  if (raw.kind === 'spoilFirst' && typeof raw.value === 'string' && spoils.includes(raw.value)) {
    return { kind: 'spoilFirst', value: raw.value as never };
  }
  if (raw.kind === 'maxMinutes' && (raw.value === 15 || raw.value === 30 || raw.value === 45)) {
    return { kind: 'maxMinutes', value: raw.value };
  }
  if (raw.kind === 'maxMinutesUnknown') return { kind: 'maxMinutesUnknown' };
  if (raw.kind === 'servings' && (raw.value === 2 || raw.value === 4)) {
    return { kind: 'servings', value: raw.value };
  }
  return undefined;
}
