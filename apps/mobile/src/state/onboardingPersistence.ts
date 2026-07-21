import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_COMPLETED_STORAGE_KEY = 'okyo:onboarding-completed:v1';

type OnboardingStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

export function createOnboardingPersistence(storage: OnboardingStorage) {
  return {
    async readCompleted() {
      return (await storage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY)) === 'true';
    },
    async writeCompleted() {
      await storage.setItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
    },
    async resetCompleted() {
      await storage.removeItem(ONBOARDING_COMPLETED_STORAGE_KEY);
    },
  };
}

export const onboardingPersistence = createOnboardingPersistence(AsyncStorage);
