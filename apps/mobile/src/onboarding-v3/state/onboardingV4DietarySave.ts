import { DietarySaveInconsistentError, saveAuthoritativeDietaryPreferencesPreservingAvoidances } from '../../state/dietaryPreferencesAuthority';
import { isDietarySafetyAnswered, type DietarySafetyAnswers } from './dietaryContracts';

export type OnboardingV4DietarySaveResult =
  | { status: 'success' }
  // recoverable: true -> nothing was persisted (write failed, or a mirror
  // failure was cleanly rolled back) — retry is safe and the CTA should just
  // re-enable. recoverable: false -> the rollback itself failed, so the two
  // stores may now disagree; retrying is still the only recourse (this
  // function is idempotent) but the copy must not claim a clean no-op
  // failure, since the authoritative value may have actually persisted.
  | { status: 'error'; message: string; recoverable: boolean };

/**
 * The actual save/commit operation for Step 06's dietary screen (repair —
 * see Okyo_Onboarding_V4_Implementation_Plan.md's Step 06 report). Called
 * from `OnboardingV4.tsx`, never from inside `onboardingV4Reducer.ts` — the
 * reducer stays pure; this function does the one real async write and the
 * caller only dispatches `DIETARY_SAVED` (advancing to `plan`) after this
 * resolves with `status: 'success'`.
 *
 * - Validates: refuses to save an unanswered draft (mirrors the CTA's
 *   existing disabled state, but re-checked here so a save can never be
 *   triggered through any path that skips the UI's own guard).
 * - Writes the authoritative global store, syncing the compatibility mirror
 *   and preserving unrelated profile data and the avoidances group (see
 *   `saveAuthoritativeDietaryPreferencesPreservingAvoidances`).
 * - Does NOT clear or touch the V4 draft itself — the draft's own
 *   `writeDraft` effect in `OnboardingV4.tsx` already persists it on every
 *   change, independent of this function, so it remains available for
 *   resume regardless of this save's outcome.
 */
export async function saveOnboardingV4DietarySafety(answers: DietarySafetyAnswers): Promise<OnboardingV4DietarySaveResult> {
  if (!isDietarySafetyAnswered(answers)) {
    return { status: 'error', message: 'Choose at least one option, or select None of these.', recoverable: true };
  }
  try {
    await saveAuthoritativeDietaryPreferencesPreservingAvoidances({
      allergies: answers.noneOfThese ? [] : answers.allergies,
      restrictions: answers.noneOfThese ? [] : answers.restrictions,
      dislikes: answers.noneOfThese ? [] : answers.dislikes,
    });
    return { status: 'success' };
  } catch (error) {
    if (error instanceof DietarySaveInconsistentError) {
      return { status: 'error', message: "Okyo couldn't confirm your preferences saved correctly. Try again, then check Settings to be sure.", recoverable: false };
    }
    return { status: 'error', message: "Okyo couldn't save your preferences. Try again.", recoverable: true };
  }
}
