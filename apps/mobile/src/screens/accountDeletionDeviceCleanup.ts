export type AccountDeletionDeviceCleanupDependencies = {
  clearLocalData: () => Promise<void>;
  resetRevenueCatIdentity: () => Promise<void>;
  resetAnalyticsIdentity: () => void | Promise<void>;
  signOut: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

/** Runs only after server deletion is confirmed; safe to repeat without calling the server. */
export async function cleanupDeletedAccountDevice(dependencies: AccountDeletionDeviceCleanupDependencies): Promise<void> {
  const failures: unknown[] = [];
  const attempt = async (operation: () => void | Promise<void>) => {
    try { await operation(); } catch (error) { failures.push(error); }
  };

  // Keep going so one storage failure cannot leave a deleted Clerk session
  // active or skip the fresh route. A retry repeats only idempotent device work.
  await attempt(dependencies.clearLocalData);
  await attempt(dependencies.resetRevenueCatIdentity);
  await attempt(dependencies.resetAnalyticsIdentity);
  // Flip the root route before Clerk sign-out can make AuthGate render sign-in.
  await attempt(dependencies.resetOnboarding);
  await attempt(dependencies.signOut);
  if (failures.length > 0) throw new Error('Device cleanup did not fully complete.');
}
