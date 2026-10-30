export type CanonicalProfilePersistenceEligibility = {
  hydrated: boolean;
  currentRoute: string;
};

/** Matches the existing V3 effect's complete set of persistence guards. */
export function canRunCanonicalProfilePersistence({
  hydrated,
  currentRoute,
}: CanonicalProfilePersistenceEligibility): boolean {
  return hydrated && currentRoute !== 'splash' && currentRoute !== 'complete';
}

/**
 * Non-React mechanics for a single eligible V3 persistence-effect invocation.
 * The caller owns eligibility timing, route policy, snapshot inputs, and logging.
 */
export type CanonicalProfilePersistenceEffectRunnerDependencies = {
  persistProfileSnapshot: () => Promise<void>;
  logPersistenceError: (error: unknown) => void;
};

export async function runCanonicalProfilePersistenceEffect(
  dependencies: CanonicalProfilePersistenceEffectRunnerDependencies,
): Promise<void> {
  try {
    // Keep V3's existing one-item Promise.all boundary and its microtask shape.
    await Promise.all([dependencies.persistProfileSnapshot()]);
  } catch (error: unknown) {
    dependencies.logPersistenceError(error);
  }
}
