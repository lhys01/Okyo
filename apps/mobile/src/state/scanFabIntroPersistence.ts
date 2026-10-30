import AsyncStorage from '@react-native-async-storage/async-storage';

// Separate from the guided tour's own storage key — this is the one-time
// "+" button explainer bubble, shown even to users who skip or already
// finished the tour, so the button's purpose is never a mystery.
export const SCAN_FAB_INTRO_STORAGE_KEY = 'okyo:scan-fab-intro-seen:v1';

type IntroStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export function createScanFabIntroPersistence(storage: IntroStorage) {
  return {
    async hasSeenIntro(): Promise<boolean> {
      return (await storage.getItem(SCAN_FAB_INTRO_STORAGE_KEY)) === 'seen';
    },
    async markIntroSeen() {
      await storage.setItem(SCAN_FAB_INTRO_STORAGE_KEY, 'seen');
    },
  };
}

export const scanFabIntroPersistence = createScanFabIntroPersistence(AsyncStorage);
