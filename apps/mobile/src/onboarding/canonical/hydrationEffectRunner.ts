import type { CanonicalHydrationResult } from './lifecycle';

export type CanonicalDeferredSplashCompletion = {
  elapsedMs: number;
  fontsLoaded: boolean;
};

/**
 * Mechanical hydration-effect callbacks. V3 supplies every policy decision:
 * whether it is mounted, what dispatch means, logging, and splash ownership.
 */
export type CanonicalHydrationEffectRunnerDependencies = {
  hydrate: () => Promise<CanonicalHydrationResult>;
  isMounted: () => boolean;
  dispatchHydration: (hydration: CanonicalHydrationResult) => void;
  logHydrationError: (error: unknown) => void;
  markHydrated: () => void;
  takeDeferredSplashCompletion: () => CanonicalDeferredSplashCompletion | null;
  dispatchDeferredSplashCompletion: (completion: CanonicalDeferredSplashCompletion) => void;
};

/**
 * Runs the promise sequencing formerly in V3's hydration effect. It deliberately
 * has no start-once state, React dependency, or route interpretation.
 */
export async function runCanonicalHydrationEffect(
  dependencies: CanonicalHydrationEffectRunnerDependencies,
): Promise<void> {
  try {
    const hydration = await dependencies.hydrate();
    if (!dependencies.isMounted()) return;
    dependencies.dispatchHydration(hydration);
  } catch (error: unknown) {
    // This intentionally happens even after unmount, matching the V3 effect.
    dependencies.logHydrationError(error);
  } finally {
    if (!dependencies.isMounted()) return;
    dependencies.markHydrated();
    const pending = dependencies.takeDeferredSplashCompletion();
    if (pending) dependencies.dispatchDeferredSplashCompletion(pending);
  }
}
