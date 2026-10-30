import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Stable anonymous device identity used for API correlation and, before sign-in,
 * RevenueCat's app user ID. Analytics has a separate, ephemeral session ID.
 *
 * It is NOT a security token: it only ties a device's analytics events
 * together, so a non-crypto uuid is acceptable.
 */

import { uuidV4 } from './uuid';

export { uuidV4 } from './uuid';

export const ANON_ID_STORAGE_KEY = 'okyo:anon-id:v1';

type IdStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

let cachedAnonId: string | null = null;
let inFlight: Promise<string> | null = null;

/**
 * Returns the persisted anonymous id, creating and storing one on first call.
 * Concurrent callers share a single read/create. Never throws — a storage
 * failure falls back to an in-memory id for the current process.
 */
export async function getAnonymousId(storage: IdStorage = AsyncStorage): Promise<string> {
  if (cachedAnonId) return cachedAnonId;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const existing = await storage.getItem(ANON_ID_STORAGE_KEY);
      if (existing && existing.length > 0) {
        cachedAnonId = existing;
        return existing;
      }
      const created = uuidV4();
      await storage.setItem(ANON_ID_STORAGE_KEY, created);
      cachedAnonId = created;
      return created;
    } catch {
      const fallback = cachedAnonId ?? uuidV4();
      cachedAnonId = fallback;
      return fallback;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Synchronous best-effort accessor. Null until getAnonymousId() has resolved once. */
export function getAnonymousIdSync(): string | null {
  return cachedAnonId;
}

/** Forget the cached identifier after a user deletes local Okyo data. */
export function resetAnonymousIdCache(): void {
  cachedAnonId = null;
  inFlight = null;
}

/** Test-only alias retained for existing tests. */
export function resetAnonymousIdCacheForTests(): void {
  resetAnonymousIdCache();
}
