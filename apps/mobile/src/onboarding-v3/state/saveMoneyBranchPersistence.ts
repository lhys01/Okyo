import AsyncStorage from '@react-native-async-storage/async-storage';

import { createCanonicalVersionedDraftPersistence } from '../../onboarding/canonical/draftPersistence';

import { normalizeSaveMoneyDraft, type SaveMoneyDraft } from './saveMoneyBranch';

export const SAVE_MONEY_BRANCH_STORAGE_KEY = 'okyo:onboarding-v3-save-money-branch:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export function createSaveMoneyBranchPersistence(storage: Storage) {
  async function readDetailed(): Promise<
    | { status: 'ready'; draft: SaveMoneyDraft }
    | { status: 'storage_error' | 'invalid_json' }
  > {
    let raw: string | null;
    try {
      raw = await storage.getItem(SAVE_MONEY_BRANCH_STORAGE_KEY);
    } catch {
      return { status: 'storage_error' };
    }
    if (raw === null) return { status: 'ready', draft: normalizeSaveMoneyDraft(null) };
    try {
      return { status: 'ready', draft: normalizeSaveMoneyDraft(JSON.parse(raw)) };
    } catch {
      return { status: 'invalid_json' };
    }
  }

  return {
    ...createCanonicalVersionedDraftPersistence<SaveMoneyDraft>({
      storage,
      storageKey: SAVE_MONEY_BRANCH_STORAGE_KEY,
      normalize: normalizeSaveMoneyDraft,
    }),
    readDetailed,
  };
}
export const saveMoneyBranchPersistence = createSaveMoneyBranchPersistence(AsyncStorage);
