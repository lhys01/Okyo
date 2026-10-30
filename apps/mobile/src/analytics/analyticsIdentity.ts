import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidV4 } from './uuid';

export const ANALYTICS_ID_STORAGE_KEY = 'okyo:analytics-id:v1';
type IdStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

let cachedId: string | null = null;
let pendingId: Promise<string> | null = null;
let identityRevision = 0;

/** Anonymous analytics-only identifier; never derived from an auth/session ID. */
export function getAnalyticsIdentityRevision(): number {
  return identityRevision;
}

export function getAnalyticsDistinctIdSync(): string | null {
  return cachedId;
}

export async function getAnalyticsDistinctId(storage: IdStorage = AsyncStorage): Promise<string> {
  if (cachedId) return cachedId;
  if (pendingId) return pendingId;
  const requestRevision = identityRevision;
  pendingId = (async () => {
    try {
      const existing = await storage.getItem(ANALYTICS_ID_STORAGE_KEY);
      if (requestRevision !== identityRevision) return cachedId ?? uuidV4();
      if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
        cachedId = existing;
        return existing;
      }
      const created = uuidV4();
      cachedId = created;
      await storage.setItem(ANALYTICS_ID_STORAGE_KEY, created);
      if (requestRevision !== identityRevision) return cachedId ?? created;
      return created;
    } catch {
      if (requestRevision !== identityRevision) return cachedId ?? uuidV4();
      cachedId ??= uuidV4();
      return cachedId;
    } finally {
      pendingId = null;
    }
  })();
  return pendingId;
}

/** Rotate and persist a fresh anonymous identifier after account deletion. */
export async function resetAnalyticsDistinctId(storage: IdStorage = AsyncStorage): Promise<void> {
  identityRevision += 1;
  const nextId = uuidV4();
  cachedId = nextId;
  pendingId = Promise.resolve(nextId);
  try {
    await storage.setItem(ANALYTICS_ID_STORAGE_KEY, nextId);
  } catch {
    // Keep the fresh in-memory ID; analytics must not interrupt deletion.
  }
}

export function resetAnalyticsIdentityForTests(): void {
  cachedId = null;
  pendingId = null;
  identityRevision = 0;
}
