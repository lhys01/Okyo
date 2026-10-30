/** Separates synchronous in-memory reset from the existing unawaited completion-flag cleanup. */
export type OnboardingResetSessionDependencies = {
  resetMemory: () => void;
  resetCompletionFlag: () => Promise<void>;
  logCompletionFlagResetError: (error: unknown) => void;
};

export async function resetOnboardingSession(dependencies: OnboardingResetSessionDependencies): Promise<void> {
  try {
    await dependencies.resetCompletionFlag();
  } catch (error: unknown) {
    dependencies.logCompletionFlagResetError(error);
  }
  dependencies.resetMemory();
}
