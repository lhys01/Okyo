export type CanonicalResetRequest = {
  resetCanonicalPersistence: () => Promise<void>;
  resetSession: () => void | Promise<void>;
  resetTour: () => Promise<void>;
  onError: (scope: 'persistence' | 'tour', error: unknown) => void;
};

export type CanonicalResetResult = { reset: boolean };
/** @deprecated Use CanonicalResetRequest. Kept for compatibility. */
export type CanonicalResetDependencies = CanonicalResetRequest;

/**
 * Clears persistent onboarding state before switching the app shell back to a
 * fresh session. This prevents the mounted onboarding controller from reading
 * a stale branch draft during the reset window.
 */
export async function resetCanonicalOnboarding(request: CanonicalResetRequest): Promise<CanonicalResetResult> {
  try {
    await request.resetCanonicalPersistence();
  } catch (error: unknown) {
    request.onError('persistence', error);
    return { reset: false };
  }
  try {
    await request.resetTour();
  } catch (error: unknown) {
    request.onError('tour', error);
  }
  await request.resetSession();
  return { reset: true };
}
