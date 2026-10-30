export type CanonicalDraftStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type VersionedDraftPersistenceOptions<Draft> = {
  storage: CanonicalDraftStorage;
  storageKey: string;
  normalize: (value: unknown) => Draft;
};

/**
 * Shared recoverable storage mechanics for the existing versioned preview
 * drafts. Each branch keeps its own key and normalizer, so this never
 * translates answers, changes schemas, or decides a resume route.
 */
export function createCanonicalVersionedDraftPersistence<Draft>({
  storage,
  storageKey,
  normalize,
}: VersionedDraftPersistenceOptions<Draft>) {
  return {
    async read(): Promise<Draft> {
      try {
        const raw = await storage.getItem(storageKey);
        return normalize(raw ? JSON.parse(raw) : null);
      } catch {
        return normalize(null);
      }
    },
    async write(value: unknown): Promise<Draft | null> {
      const draft = normalize(value);
      try {
        await storage.setItem(storageKey, JSON.stringify(draft));
        return draft;
      } catch {
        return null;
      }
    },
    async reset() {
      try {
        await storage.removeItem(storageKey);
      } catch {
        // Preview-draft storage is recoverable; preserve the V3 facade behavior.
      }
    },
  };
}
