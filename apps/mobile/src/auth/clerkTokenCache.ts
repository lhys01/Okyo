/**
 * Clerk needs somewhere durable to keep the session token between launches.
 * It must be the device keychain (expo-secure-store), never AsyncStorage —
 * AsyncStorage is plain, unencrypted storage, and a leaked session token is
 * a full account takeover.
 *
 * Every method fails soft: if the keychain is unavailable (locked device,
 * wiped entry) the user is treated as signed out and re-prompted, which is
 * the safe direction to fail in.
 */
export interface ClerkTokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, value: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

interface SecureStoreLike {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

/**
 * Loaded lazily rather than imported at module scope: `expo-secure-store`
 * pulls in the React Native runtime, which would make this file (and the
 * pure cache logic in it) impossible to unit test under plain Node.
 */
function getSecureStore(): SecureStoreLike {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-secure-store') as SecureStoreLike;
}

export function createClerkTokenCache(store?: SecureStoreLike): ClerkTokenCache {
  const resolveStore = (): SecureStoreLike => store ?? getSecureStore();
  return {
    getToken: async (key: string) => {
      try {
        return await resolveStore().getItemAsync(key);
      } catch {
        // A failed read must read as "signed out", never as a crash.
        return null;
      }
    },
    saveToken: async (key: string, value: string) => {
      try {
        await resolveStore().setItemAsync(key, value);
      } catch {
        // Losing the token only costs the user a re-sign-in.
      }
    },
    clearToken: (key: string) => {
      try {
        void resolveStore().deleteItemAsync(key).catch(() => undefined);
      } catch {
        // Nothing to clear if the keychain is unavailable.
      }
    },
  };
}

export const clerkTokenCache = createClerkTokenCache();
