import { mergeOnboardingV4DraftIntoCanonicalProfile } from './onboardingV4CanonicalBridge';
import { onboardingV3Persistence } from './onboardingV3Persistence';
import type { PersonalizedOnboardingProfile } from './personalizedOnboarding';
import type { OnboardingV4Draft } from './onboardingV4Draft';

/**
 * The Step 07 canonical-profile commit — the one reviewed runtime call site
 * for `mergeOnboardingV4DraftIntoCanonicalProfile` (see
 * onboardingV4SettingsPrecedence.test.ts, updated deliberately to permit
 * exactly this call while still proving it can never overwrite dietary data
 * or a newer Settings edit to an unrelated field).
 *
 * - Reads the latest canonical profile immediately before merging (never a
 *   stale copy held from earlier in onboarding).
 * - Merges only the V4-owned branch fields the bridge already scopes itself
 *   to (primaryGoal/secondaryGoals plus the resolved branch's own
 *   sub-object) — every other canonical field, including anything a
 *   Settings edit changed since onboarding started, passes through
 *   untouched by construction (the bridge spreads `...canonical`).
 * - Dietary preferences are explicitly excluded from this write: Step 06's
 *   dietary authority (`state/dietaryPreferencesAuthority.ts`) is the only
 *   writer of `dietaryPreferences`, even though the bridge function itself
 *   still knows how to merge dietary (for its Step 06 callers/tests) —
 *   this function overwrites the merged result's `dietaryPreferences` back
 *   to whatever was just read from canonical, so a plan-commit can never
 *   race a Settings edit or re-apply stale onboarding-time dietary answers.
 * - Never writes `not_sure`: `draft.resolvedPrimaryGoal` is already typed as
 *   `PrimaryGoal | null` (one of the three real goals, or unresolved) — the
 *   bridge only sets `primaryGoal` when it is non-null, so a literal
 *   `'not_sure'` can never reach the canonical profile's three-goal field.
 * - Idempotent and retryable: a single full-profile write from a pure merge
 *   of the same inputs — calling this twice with the same draft and no
 *   intervening Settings edit produces the same persisted profile both
 *   times. On failure (the write throws), nothing has changed yet — retry
 *   is a clean re-attempt, exactly like Step 06's save.
 */
type ProfileStore = Pick<typeof onboardingV3Persistence, 'readPersonalizedProfile' | 'writePersonalizedProfile'>;

/** Factory so the idempotency/dietary-preservation behavior is testable against an injected in-memory store (see dietaryPreferencesAuthority.ts's identical rationale). */
export function createOnboardingV4CanonicalCommitter(profileStore: ProfileStore) {
  return async function commit(draft: OnboardingV4Draft): Promise<PersonalizedOnboardingProfile> {
    const canonical = await profileStore.readPersonalizedProfile();
    const merged = mergeOnboardingV4DraftIntoCanonicalProfile(canonical, draft);
    const committed: PersonalizedOnboardingProfile = { ...merged, dietaryPreferences: canonical.dietaryPreferences };
    await profileStore.writePersonalizedProfile(committed);
    return committed;
  };
}

export const commitOnboardingV4PlanToCanonicalProfile = createOnboardingV4CanonicalCommitter(onboardingV3Persistence);
