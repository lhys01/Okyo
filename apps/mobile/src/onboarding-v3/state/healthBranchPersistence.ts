import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeHealthDraft, type HealthDraft } from './healthBranch';
export const HEALTH_BRANCH_STORAGE_KEY = 'okyo:onboarding-v3-health-branch:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
export function createHealthBranchPersistence(storage: Storage) {
  return {
    async read(): Promise<HealthDraft> { try { const raw = await storage.getItem(HEALTH_BRANCH_STORAGE_KEY); return normalizeHealthDraft(raw ? JSON.parse(raw) : null); } catch { return normalizeHealthDraft(null); } },
    async write(value: unknown): Promise<HealthDraft | null> { const draft = normalizeHealthDraft(value); try { await storage.setItem(HEALTH_BRANCH_STORAGE_KEY, JSON.stringify(draft)); return draft; } catch { return null; } },
    async reset() { try { await storage.removeItem(HEALTH_BRANCH_STORAGE_KEY); } catch { /* storage is recoverable */ } },
  };
}
export const healthBranchPersistence = createHealthBranchPersistence(AsyncStorage);
