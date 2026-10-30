import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the user has already been shown the end-of-onboarding sign-in
 * screen. Deliberately separate from both onboarding completion and the
 * guided tour's key, so resetting one never silently resets another.
 *
 * This stores only "have we asked?" — never identity, never a token. It is
 * NOT an auth check: whether the user is actually signed in always comes
 * from Clerk's own session, never from this flag.
 */
export const AUTH_PROMPT_SEEN_STORAGE_KEY = 'okyo:auth-prompt-seen:v1';

type PromptStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export function createAuthPromptPersistence(storage: PromptStorage = AsyncStorage) {
  return {
    /** True once the user has either signed in or explicitly chosen "Maybe later". */
    readSeen: async (): Promise<boolean> => {
      try {
        return (await storage.getItem(AUTH_PROMPT_SEEN_STORAGE_KEY)) === 'true';
      } catch {
        // Fail toward showing the prompt again rather than silently skipping
        // it — an extra prompt is recoverable, a never-shown one is not.
        return false;
      }
    },
    markSeen: async (): Promise<void> => {
      try {
        await storage.setItem(AUTH_PROMPT_SEEN_STORAGE_KEY, 'true');
      } catch {
        // Worst case the user sees the prompt once more.
      }
    },
    reset: async (): Promise<void> => {
      try {
        await storage.removeItem(AUTH_PROMPT_SEEN_STORAGE_KEY);
      } catch {
        // Non-fatal for a dev-only reset.
      }
    },
  };
}

export const authPromptPersistence = createAuthPromptPersistence();
