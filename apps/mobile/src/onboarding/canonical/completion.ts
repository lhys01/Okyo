export type CanonicalCompletionRequest = {
  activateApp: () => void;
  writeCompletion: () => Promise<void>;
  prepareTour?: () => Promise<void>;
};

export type CanonicalCompletionResult = { completed: true };
/** @deprecated Use CanonicalCompletionRequest. Kept for compatibility. */
export type CanonicalCompletionDependencies = CanonicalCompletionRequest;

/** Writes durable completion before allowing the app shell to leave onboarding. */
export async function commitCanonicalOnboardingCompletion(request: CanonicalCompletionRequest): Promise<CanonicalCompletionResult> {
  if (request.prepareTour) await request.prepareTour();
  await request.writeCompletion();
  request.activateApp();
  return { completed: true };
}
