import { completeDietarySafety, isDietarySafetyAnswered, type DietarySafetyAnswers } from './dietaryContracts';
import type { OnboardingV4DietarySaveResult } from './onboardingV4DietarySave';
import type { OnboardingV4Draft } from './onboardingV4Draft';

type Dependencies = {
  saveDietary: (answers: DietarySafetyAnswers) => Promise<OnboardingV4DietarySaveResult>;
  commitProfile: (draft: OnboardingV4Draft) => Promise<unknown>;
};

/** One user action, two existing authorities. Never advance on a partial save. */
export function createOnboardingV4SetupCommitter({ saveDietary, commitProfile }: Dependencies) {
  return async (draft: OnboardingV4Draft): Promise<OnboardingV4DietarySaveResult> => {
    if (!draft.initialGoal || !isDietarySafetyAnswered(draft.dietaryAnswers)) {
      return { status: 'error', recoverable: true, message: 'Confirm your food preferences before continuing.' };
    }
    try {
      const dietary = await saveDietary(draft.dietaryAnswers);
      if (dietary.status === 'error') return dietary;
      await commitProfile({ ...draft, dietaryAnswers: completeDietarySafety(draft.dietaryAnswers) });
      return { status: 'success' };
    } catch {
      // Dietary may already have persisted. Do not claim a rollback or clear
      // the draft: retrying the existing idempotent writers finishes setup.
      return { status: 'error', recoverable: true, message: "Okyo couldn't finish saving your preferences. Try again." };
    }
  };
}
