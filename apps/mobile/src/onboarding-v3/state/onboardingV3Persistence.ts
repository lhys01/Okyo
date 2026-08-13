import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAttributionSource, type AttributionSource } from './attribution';
import { normalizeDietarySelection, type DietarySelection } from './dietary';
import { EMPTY_FOOD_PREFERENCES } from '../../state/foodPreferences';
import { sanitizeMascotName } from './mascotName';
import {
  normalizePersonalizedProfile,
  type PersonalizedOnboardingProfile,
} from './personalizedOnboarding';

export const MASCOT_NAME_STORAGE_KEY = 'okyo:mascot-name:v1';
export const ATTRIBUTION_STORAGE_KEY = 'okyo:onboarding-attribution:v1';
export const DIETARY_STORAGE_KEY = 'okyo:dietary:v1';
export const PERSONALIZED_PROFILE_STORAGE_KEY = 'okyo:personalized-onboarding-profile:v1';
export const PERSONALIZED_PROGRESS_STORAGE_KEY = 'okyo:personalized-onboarding-progress:v1';

type OnboardingV3Storage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

export function createOnboardingV3Persistence(storage: OnboardingV3Storage) {
  return {
    async readMascotName() {
      return sanitizeMascotName(await storage.getItem(MASCOT_NAME_STORAGE_KEY));
    },
    async writeMascotName(value: string) {
      const mascotName = sanitizeMascotName(value);
      await storage.setItem(MASCOT_NAME_STORAGE_KEY, mascotName);
      return mascotName;
    },
    async readAttribution(): Promise<AttributionSource | null> {
      const value = await storage.getItem(ATTRIBUTION_STORAGE_KEY);
      return isAttributionSource(value) ? value : null;
    },
    async writeAttribution(value: AttributionSource | null) {
      if (value === null) {
        await storage.removeItem(ATTRIBUTION_STORAGE_KEY);
      } else {
        await storage.setItem(ATTRIBUTION_STORAGE_KEY, value);
      }
    },
    async readDietary(): Promise<DietarySelection> {
      const raw = await storage.getItem(DIETARY_STORAGE_KEY);
      if (!raw) return { ...EMPTY_FOOD_PREFERENCES };
      try {
        return normalizeDietarySelection(JSON.parse(raw));
      } catch {
        return { ...EMPTY_FOOD_PREFERENCES };
      }
    },
    async writeDietary(value: unknown): Promise<DietarySelection> {
      const dietary = normalizeDietarySelection(value);
      await storage.setItem(DIETARY_STORAGE_KEY, JSON.stringify(dietary));
      return dietary;
    },
    async readPersonalizedProfile(): Promise<PersonalizedOnboardingProfile> {
      const raw = await storage.getItem(PERSONALIZED_PROFILE_STORAGE_KEY);
      if (!raw) return normalizePersonalizedProfile(null);
      try {
        return normalizePersonalizedProfile(JSON.parse(raw));
      } catch {
        return normalizePersonalizedProfile(null);
      }
    },
    async writePersonalizedProfile(value: PersonalizedOnboardingProfile) {
      const profile = normalizePersonalizedProfile(value);
      await storage.setItem(PERSONALIZED_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      return profile;
    },
    async readPersonalizedProgress() {
      return (await storage.getItem(PERSONALIZED_PROGRESS_STORAGE_KEY)) ?? null;
    },
    async writePersonalizedProgress(step: string) {
      await storage.setItem(PERSONALIZED_PROGRESS_STORAGE_KEY, step);
    },
    async reset() {
      await Promise.all([
        storage.removeItem(MASCOT_NAME_STORAGE_KEY),
        storage.removeItem(ATTRIBUTION_STORAGE_KEY),
        storage.removeItem(DIETARY_STORAGE_KEY),
        storage.removeItem(PERSONALIZED_PROFILE_STORAGE_KEY),
        storage.removeItem(PERSONALIZED_PROGRESS_STORAGE_KEY),
      ]);
    },
  };
}

export const onboardingV3Persistence = createOnboardingV3Persistence(AsyncStorage);
