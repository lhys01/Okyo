import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createOnboardingV3Persistence,
  PERSONALIZED_PROFILE_STORAGE_KEY,
  PERSONALIZED_PROGRESS_STORAGE_KEY,
} from '../../onboarding-v3/state/onboardingV3Persistence';
import { createHealthBranchPersistence } from '../../onboarding-v3/state/healthBranchPersistence';
import { createMacrosBranchPersistence } from '../../onboarding-v3/state/macrosBranchPersistence';
import { createSaveMoneyBranchPersistence } from '../../onboarding-v3/state/saveMoneyBranchPersistence';
import { createBranchCommitmentPersistence } from '../../onboarding-v3/state/branchCommitmentPersistence';
import { emptyPersonalizedProfile, normalizePersonalizedProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import { CANONICAL_ONBOARDING_SCHEMA_VERSION, type CanonicalOnboardingSnapshot } from './types';

export const CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY = 'okyo:onboarding-canonical:v1';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;
type PersistedSnapshot = { schemaVersion: number; profile: unknown; resumeStep: unknown };

function readSnapshot(value: string | null): CanonicalOnboardingSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PersistedSnapshot>;
    if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== CANONICAL_ONBOARDING_SCHEMA_VERSION) return null;
    return {
      schemaVersion: CANONICAL_ONBOARDING_SCHEMA_VERSION,
      profile: normalizePersonalizedProfile(parsed.profile),
      resumeStep: typeof parsed.resumeStep === 'string' ? parsed.resumeStep : null,
    };
  } catch {
    return null;
  }
}

/**
 * Dual-reads the legacy V3 keys and the canonical envelope. Legacy V3 stays
 * authoritative for existing installs, so adding this layer cannot reset or
 * reinterpret a user's draft. New snapshots are a reversible mirror until a
 * separately approved migration retires the old keys.
 */
export function createCanonicalOnboardingPersistence(storage: Storage) {
  const legacy = createOnboardingV3Persistence(storage);
  const commitments = createBranchCommitmentPersistence(storage);
  return {
    async readSnapshot(): Promise<CanonicalOnboardingSnapshot> {
      const [legacyProfileRaw, legacyProgressRaw, canonicalRaw] = await Promise.all([
        storage.getItem(PERSONALIZED_PROFILE_STORAGE_KEY),
        storage.getItem(PERSONALIZED_PROGRESS_STORAGE_KEY),
        storage.getItem(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY),
      ]);
      if (legacyProfileRaw !== null || legacyProgressRaw !== null) {
        return {
          schemaVersion: CANONICAL_ONBOARDING_SCHEMA_VERSION,
          profile: await legacy.readPersonalizedProfile(),
          resumeStep: await legacy.readPersonalizedProgress(),
        };
      }
      return readSnapshot(canonicalRaw) ?? {
        schemaVersion: CANONICAL_ONBOARDING_SCHEMA_VERSION,
        profile: { ...emptyPersonalizedProfile },
        resumeStep: null,
      };
    },
    async writeSnapshot(snapshot: Omit<CanonicalOnboardingSnapshot, 'schemaVersion'>) {
      const profile = normalizePersonalizedProfile(snapshot.profile);
      const resumeStep = typeof snapshot.resumeStep === 'string' ? snapshot.resumeStep : null;
      await legacy.writePersonalizedProfile(profile);
      await legacy.writePersonalizedProgress(resumeStep ?? '');
      await storage.setItem(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY, JSON.stringify({
        schemaVersion: CANONICAL_ONBOARDING_SCHEMA_VERSION,
        profile,
        resumeStep,
      }));
    },
    async reset() {
      // These three drafts are part of the active V3 onboarding session. They
      // must leave with the V3 profile/progress envelope so Reset cannot revive
      // an old branch step or a completed branch after the fresh entry mounts.
      await Promise.all([
        legacy.reset(),
        storage.removeItem(CANONICAL_ONBOARDING_SNAPSHOT_STORAGE_KEY),
        createSaveMoneyBranchPersistence(storage).reset(),
        createHealthBranchPersistence(storage).reset(),
        createMacrosBranchPersistence(storage).reset(),
        commitments.reset(),
      ]);
    },
  };
}

export const canonicalOnboardingPersistence = createCanonicalOnboardingPersistence(AsyncStorage);
