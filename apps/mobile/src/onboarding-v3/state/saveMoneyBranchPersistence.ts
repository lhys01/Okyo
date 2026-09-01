import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeSaveMoneyDraft, type SaveMoneyDraft } from './saveMoneyBranch';
export const SAVE_MONEY_BRANCH_STORAGE_KEY = 'okyo:onboarding-v3-save-money-branch:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
export function createSaveMoneyBranchPersistence(storage: Storage) {
  return {
    async read(): Promise<SaveMoneyDraft> { try { const raw = await storage.getItem(SAVE_MONEY_BRANCH_STORAGE_KEY); return normalizeSaveMoneyDraft(raw ? JSON.parse(raw) : null); } catch { return normalizeSaveMoneyDraft(null); } },
    async write(value: unknown): Promise<SaveMoneyDraft | null> { const draft = normalizeSaveMoneyDraft(value); try { await storage.setItem(SAVE_MONEY_BRANCH_STORAGE_KEY, JSON.stringify(draft)); return draft; } catch { return null; } },
    async reset() { try { await storage.removeItem(SAVE_MONEY_BRANCH_STORAGE_KEY); } catch { /* storage is recoverable */ } },
  };
}
export const saveMoneyBranchPersistence = createSaveMoneyBranchPersistence(AsyncStorage);
