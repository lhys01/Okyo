import type { SaveMoneyDraft } from './saveMoneyBranch';

export type SavingsPlanRead =
  | { plan: { branch: 'save_money'; draft: SaveMoneyDraft }; issue: null }
  | { plan: null; issue: 'answers_incomplete'; recoveryStep: string };

/** Validates the answers themselves; a lagging persisted route cursor must not block a complete plan. */
export function resolveSavingsPlan(draft: SaveMoneyDraft): SavingsPlanRead {
  const recoveryStep = draft.recipePriorities.length === 0 || draft.householdSize === null ? 'planSetup' : null;
  return recoveryStep === null
    ? { plan: { branch: 'save_money', draft }, issue: null }
    : { plan: null, issue: 'answers_incomplete', recoveryStep };
}
