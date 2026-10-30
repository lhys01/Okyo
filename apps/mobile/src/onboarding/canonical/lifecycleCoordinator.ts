import type { AttributionSource } from '../../onboarding-v3/state/attribution';
import type { PersonalizedOnboardingProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import type { FoodPreferences } from '../../state/foodPreferences';
import {
  createCanonicalHydrationResult,
  createCanonicalProfileSnapshotRequest,
  type CanonicalHydrationResult,
  type CanonicalProfileSnapshotRequest,
} from './lifecycle';
import type { CanonicalOnboardingSnapshot } from './types';

/**
 * I/O boundary for the lifecycle work shared by the mounted V3 controller.
 * Route policy, dispatching, and effect scheduling deliberately stay with V3.
 */
export type CanonicalLifecycleCoordinatorDependencies = {
  readSnapshot: () => Promise<CanonicalOnboardingSnapshot>;
  readMascotName: () => Promise<string>;
  readAttribution: () => Promise<AttributionSource | null>;
  readDietaryPreferences: () => Promise<FoodPreferences>;
  writeSnapshot: (snapshot: Omit<CanonicalOnboardingSnapshot, 'schemaVersion'>) => Promise<void>;
};

export type CanonicalLifecycleCoordinator = {
  hydrate: () => Promise<CanonicalHydrationResult>;
  persistProfileSnapshot: (request: CanonicalProfileSnapshotRequest) => Promise<void>;
};

/**
 * Composes the existing canonical lifecycle contracts with persistence I/O.
 * It has no React or V3-machine dependency and does not interpret routes.
 */
export function createCanonicalLifecycleCoordinator(
  dependencies: CanonicalLifecycleCoordinatorDependencies,
): CanonicalLifecycleCoordinator {
  return {
    async hydrate() {
      const [snapshot, mascotName, attribution, dietaryPreferences] = await Promise.all([
        dependencies.readSnapshot(),
        dependencies.readMascotName(),
        dependencies.readAttribution(),
        dependencies.readDietaryPreferences(),
      ]);
      return createCanonicalHydrationResult({ snapshot, mascotName, attribution, dietaryPreferences });
    },

    async persistProfileSnapshot(request) {
      await dependencies.writeSnapshot(createCanonicalProfileSnapshotRequest(request));
    },
  };
}
