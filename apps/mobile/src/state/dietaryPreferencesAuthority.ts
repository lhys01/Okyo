import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { setDietaryPreferences } from '../onboarding-v3/state/personalizedOnboarding';
import { foodPreferencesPersistence, normalizeFoodPreferences, type FoodPreferences } from './foodPreferences';

/**
 * The single authoritative path for permanent dietary data (repair of Step
 * 06 — see Okyo_Onboarding_V4_Implementation_Plan.md's Step 06 report).
 *
 * Authoritative store: `PersonalizedOnboardingProfile.dietaryPreferences`,
 * persisted via `onboardingV3Persistence`. This is already what the real
 * scan/recipe-generation request reads at runtime
 * (`useOnboardingV3Controller.generateRecipe` passes `state.profile.dietaryPreferences`
 * to `toApiFoodPreferences`) — making it authoritative required no change to
 * the scan pipeline, only routing every *writer* through the same path.
 *
 * Compatibility mirror: `state/foodPreferences.ts`'s `foodPreferencesPersistence`
 * (`useFoodPreferences()` and its change-listener subscription are the only
 * other live readers of this key). Kept in sync by this one function so nothing
 * can read a stale mirror against a moved-on canonical profile.
 *
 * Migration precedence when the two disagree on hydrate: the canonical
 * profile always wins — nothing in this module ever seeds the canonical
 * profile FROM the mirror. `onboardingV3Persistence.readPersonalizedProfile`
 * already has its own independent, versioned migration path
 * (`unwrapPersistedPersonalizedProfile` / `normalizePersonalizedProfile`);
 * this module does not add a second one.
 *
 * Deletion: `state/dietaryDeletion.ts`'s `clearAllPersonalOkyoData` clears
 * both this authoritative key (via `onboardingV3Persistence.reset`, which
 * removes the whole canonical profile — not just dietary — matching the
 * app's one existing "delete everything" affordance) and the mirror (via
 * `foodPreferencesPersistence.clear`).
 *
 * Two-store transaction (repair): the authoritative write and the mirror
 * write are two separate AsyncStorage keys, so they cannot be made atomic by
 * the platform. If the mirror write fails after the authoritative write
 * already succeeded, this rolls the authoritative store back to its
 * pre-call value rather than leaving the two stores silently disagreeing —
 * chosen over "mirror is derived/reconciled on read" because the mirror has
 * its own independent reader (`useFoodPreferences()`/`DietaryPreferencesScreen`)
 * with no read-time reconciliation hook, so an un-rolled-back authoritative
 * write would be visible to recipe generation while the mirror (and Settings
 * screen) still showed the old values. A failed call therefore always means
 * "nothing changed" — safe to retry, and retrying is idempotent (this
 * function always overwrites both stores wholesale from `preferences`, never
 * appends). If the rollback write itself also fails, the two stores may now
 * genuinely disagree; that case throws a distinctly-tagged error
 * (`DietarySaveInconsistentError`) so callers can tell "nothing changed,
 * retry" apart from "state is uncertain, don't claim a clean failure."
 */
export class DietarySaveInconsistentError extends Error {
  constructor() {
    super('Dietary preferences may be partially saved — the authoritative and mirror stores could not be reconciled.');
    this.name = 'DietarySaveInconsistentError';
  }
}

type ProfileStore = Pick<typeof onboardingV3Persistence, 'readPersonalizedProfile' | 'writePersonalizedProfile'>;
type MirrorStore = Pick<typeof foodPreferencesPersistence, 'write'>;

/**
 * Factory so the rollback/idempotency behavior is testable against injected
 * in-memory stores (this repo's `node:test` runner cannot exercise the real
 * AsyncStorage-bound singletons below) without reimplementing the save logic
 * a second time in tests, the way earlier Step 06 tests did.
 */
export function createDietaryPreferencesAuthority(profileStore: ProfileStore, mirrorStore: MirrorStore) {
  async function save(preferences: FoodPreferences): Promise<FoodPreferences> {
    const normalized = normalizeFoodPreferences(preferences);
    // Read-modify-write: never construct a fresh profile here, so unrelated
    // profile fields (name, primaryGoal, savings/health/macro answers) are
    // never touched or reset by a dietary-only save.
    const previousProfile = await profileStore.readPersonalizedProfile();
    const nextProfile = setDietaryPreferences(previousProfile, normalized);
    await profileStore.writePersonalizedProfile(nextProfile); // first write — if this throws, nothing persisted, caller's retry is a clean no-op
    try {
      await mirrorStore.write(normalized); // second write
    } catch (mirrorError) {
      try {
        await profileStore.writePersonalizedProfile(previousProfile); // rollback the first write
      } catch {
        throw new DietarySaveInconsistentError();
      }
      throw mirrorError;
    }
    return normalized;
  }

  async function savePreservingAvoidances(partial: Pick<FoodPreferences, 'allergies' | 'restrictions' | 'dislikes'>): Promise<FoodPreferences> {
    const current = await profileStore.readPersonalizedProfile();
    return save({ ...partial, avoidances: current.dietaryPreferences.avoidances });
  }

  return { save, savePreservingAvoidances };
}

const defaultAuthority = createDietaryPreferencesAuthority(onboardingV3Persistence, foodPreferencesPersistence);

export const saveAuthoritativeDietaryPreferences = defaultAuthority.save;

/**
 * For V4's dietary safety screen, which only collects three groups (no
 * "avoidances" — see dietaryContracts.ts). `setDietaryPreferences` replaces
 * all four groups wholesale from whatever is passed to it, so saving V4's
 * draft through `saveAuthoritativeDietaryPreferences` directly with
 * `avoidances: []` would silently wipe any avoidances the user set earlier
 * (via V3 onboarding or Settings) — exactly the "erasing unrelated profile
 * data" this repair exists to prevent. This reads the current avoidances
 * first and carries them forward untouched.
 */
export const saveAuthoritativeDietaryPreferencesPreservingAvoidances = defaultAuthority.savePreservingAvoidances;
