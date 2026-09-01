import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeMacrosDraft, type MacrosDraft } from './macrosBranch';
export const MACROS_BRANCH_STORAGE_KEY = 'okyo:onboarding-v3-macros-branch:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
export function createMacrosBranchPersistence(storage: Storage) {
  return {
    async read(): Promise<MacrosDraft> { try { const raw = await storage.getItem(MACROS_BRANCH_STORAGE_KEY); return normalizeMacrosDraft(raw ? JSON.parse(raw) : null); } catch { return normalizeMacrosDraft(null); } },
    async write(value: unknown): Promise<MacrosDraft | null> { const draft = normalizeMacrosDraft(value); try { await storage.setItem(MACROS_BRANCH_STORAGE_KEY, JSON.stringify(draft)); return draft; } catch { return null; } },
    async reset() { try { await storage.removeItem(MACROS_BRANCH_STORAGE_KEY); } catch { /* storage is recoverable */ } },
  };
}
export const macrosBranchPersistence = createMacrosBranchPersistence(AsyncStorage);
