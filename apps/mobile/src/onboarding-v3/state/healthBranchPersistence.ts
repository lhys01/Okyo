import AsyncStorage from '@react-native-async-storage/async-storage';

import { createCanonicalVersionedDraftPersistence } from '../../onboarding/canonical/draftPersistence';

import { normalizeHealthDraft, type HealthDraft } from './healthBranch';

export const HEALTH_BRANCH_STORAGE_KEY = 'okyo:onboarding-v3-health-branch:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export function createHealthBranchPersistence(storage: Storage) {
  return createCanonicalVersionedDraftPersistence<HealthDraft>({
    storage,
    storageKey: HEALTH_BRANCH_STORAGE_KEY,
    normalize: normalizeHealthDraft,
  });
}
export const healthBranchPersistence = createHealthBranchPersistence(AsyncStorage);
