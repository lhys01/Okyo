import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingQuestionVariant = 'A' | 'B' | 'C';
export type OnboardingExperimentStep =
  | 'intro' | 'weeklySnapshot' | 'projection' | 'planSetup' | 'reveal'
  | 'problem' | 'barrier' | 'mealToImprove' | 'meaning' | 'mealPriority' | 'foodStyle' | 'commitment' | 'goal' | 'solutionValue'
  | 'diagnosis' | 'targetMode' | 'estimateDetails' | 'knownTargets' | 'complete';
export type OnboardingExperimentBranch = 'save_money' | 'eat_healthier' | 'hit_macros';

export const ONBOARDING_QUESTION_EXPERIMENT_KEY = 'okyo:onboarding-question-experiment:v1';
export const ONBOARDING_QUESTION_EXPERIMENT_OVERRIDE_KEY = 'okyo:onboarding-question-experiment-override:v1';
const variants: readonly OnboardingQuestionVariant[] = ['A', 'B', 'C'];
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

function isVariant(value: unknown): value is OnboardingQuestionVariant {
  return value === 'A' || value === 'B' || value === 'C';
}

export function createOnboardingQuestionExperiment(storage: Storage, random: () => number = Math.random) {
  return {
    async getAssignment(): Promise<OnboardingQuestionVariant> {
      try {
        const override = await storage.getItem(ONBOARDING_QUESTION_EXPERIMENT_OVERRIDE_KEY);
        if (isVariant(override)) return override;

        const current = await storage.getItem(ONBOARDING_QUESTION_EXPERIMENT_KEY);
        if (isVariant(current)) return current;

        const index = Math.max(0, Math.min(variants.length - 1, Math.floor(random() * variants.length)));
        const assigned = variants[index] ?? 'A';
        await storage.setItem(ONBOARDING_QUESTION_EXPERIMENT_KEY, assigned);
        return assigned;
      } catch {
        return 'A';
      }
    },
    async getOverride(): Promise<OnboardingQuestionVariant | null> {
      try {
        const value = await storage.getItem(ONBOARDING_QUESTION_EXPERIMENT_OVERRIDE_KEY);
        return isVariant(value) ? value : null;
      } catch {
        return null;
      }
    },
    async setOverride(variant: OnboardingQuestionVariant | null): Promise<void> {
      if (variant) await storage.setItem(ONBOARDING_QUESTION_EXPERIMENT_OVERRIDE_KEY, variant);
      else await storage.removeItem(ONBOARDING_QUESTION_EXPERIMENT_OVERRIDE_KEY);
    },
    async resetAssignment(): Promise<void> {
      await Promise.all([
        storage.removeItem(ONBOARDING_QUESTION_EXPERIMENT_OVERRIDE_KEY),
        storage.removeItem(ONBOARDING_QUESTION_EXPERIMENT_KEY),
      ]);
    },
  };
}

export const onboardingQuestionExperiment = createOnboardingQuestionExperiment(AsyncStorage);

const skippedSteps: Record<OnboardingQuestionVariant, Partial<Record<OnboardingExperimentBranch, readonly OnboardingExperimentStep[]>>> = {
  A: {},
  B: {
    eat_healthier: ['mealToImprove', 'mealPriority', 'foodStyle', 'solutionValue'],
    hit_macros: ['barrier', 'mealPriority'],
  },
  C: {
    eat_healthier: ['mealToImprove', 'meaning', 'mealPriority', 'foodStyle', 'commitment', 'solutionValue'],
    hit_macros: ['barrier', 'diagnosis', 'mealPriority'],
    save_money: ['projection'],
  },
};

export function stepsSkippedForVariant(
  variant: OnboardingQuestionVariant,
  branch: OnboardingExperimentBranch,
): readonly OnboardingExperimentStep[] {
  return skippedSteps[variant][branch] ?? [];
}
