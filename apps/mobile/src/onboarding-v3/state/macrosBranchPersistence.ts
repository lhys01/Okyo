import AsyncStorage from '@react-native-async-storage/async-storage';

import { createCanonicalVersionedDraftPersistence } from '../../onboarding/canonical/draftPersistence';

import { normalizeMacrosDraft, type MacrosDraft } from './macrosBranch';

export const MACROS_BRANCH_STORAGE_KEY = 'okyo:onboarding-v3-macros-branch:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export function createMacrosBranchPersistence(storage: Storage) {
  return createCanonicalVersionedDraftPersistence<MacrosDraft>({
    storage,
    storageKey: MACROS_BRANCH_STORAGE_KEY,
    normalize: normalizeMacrosDraft,
  });
}
export const macrosBranchPersistence = createMacrosBranchPersistence(AsyncStorage);
