import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ScanSource } from '../../api/types';

export const ONBOARDING_V4_IN_FLIGHT_SCAN_KEY = 'okyo:onboarding-v4-in-flight-scan:v1';
export const ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY = 'okyo:onboarding-v4-free-recipe-consumed:v1';

export type OnboardingV4InFlightScan = {
  scanSessionId: string;
  source: Exclude<ScanSource, 'mock'>;
  imageUri?: string;
  mealDescription?: string;
  startedAt: string;
};

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

export function normalizeInFlightScan(value: unknown): OnboardingV4InFlightScan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<OnboardingV4InFlightScan>;
  if (typeof candidate.scanSessionId !== 'string' || !candidate.scanSessionId.trim()) return null;
  if (candidate.source !== 'camera' && candidate.source !== 'photos' && candidate.source !== 'description') return null;
  if (typeof candidate.startedAt !== 'string' || !Number.isFinite(Date.parse(candidate.startedAt))) return null;
  const imageUri = typeof candidate.imageUri === 'string' ? candidate.imageUri.trim() : '';
  const mealDescription = typeof candidate.mealDescription === 'string' ? candidate.mealDescription.trim() : '';
  if (candidate.source === 'description' ? !mealDescription : !imageUri) return null;
  return {
    scanSessionId: candidate.scanSessionId.trim(),
    source: candidate.source,
    ...(candidate.source === 'description' ? { mealDescription } : { imageUri }),
    startedAt: candidate.startedAt,
  };
}

export function createOnboardingV4ScanPersistence(storage: Storage) {
  return {
    async writeInFlightScan(value: OnboardingV4InFlightScan) {
      const normalized = normalizeInFlightScan(value);
      if (!normalized) throw new Error('Invalid in-flight scan state.');
      await storage.setItem(ONBOARDING_V4_IN_FLIGHT_SCAN_KEY, JSON.stringify(normalized));
      return normalized;
    },
    async readInFlightScan(): Promise<OnboardingV4InFlightScan | null> {
      const raw = await storage.getItem(ONBOARDING_V4_IN_FLIGHT_SCAN_KEY);
      if (!raw) return null;
      try { return normalizeInFlightScan(JSON.parse(raw)); } catch { return null; }
    },
    async clearInFlightScan() { await storage.removeItem(ONBOARDING_V4_IN_FLIGHT_SCAN_KEY); },
    async readFreeRecipeConsumed() { return (await storage.getItem(ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY)) === 'true'; },
    async writeFreeRecipeConsumed(value: boolean) {
      await storage.setItem(ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY, value ? 'true' : 'false');
      return value;
    },
  };
}

export const onboardingV4ScanPersistence = createOnboardingV4ScanPersistence(AsyncStorage);
