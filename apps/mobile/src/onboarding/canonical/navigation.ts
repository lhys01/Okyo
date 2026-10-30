export type CanonicalPreviewNavigationIntent = {
  currentRoute: string;
  entryRoute: string;
};

export type CanonicalPreviewNavigationResult = { shouldExitHost: boolean };

/**
 * Preview branches share one host boundary: Back leaves a branch only from its
 * own entry route. All in-branch history remains the branch reducer’s job.
 */
export function resolveCanonicalPreviewNavigation(intent: CanonicalPreviewNavigationIntent): CanonicalPreviewNavigationResult {
  return { shouldExitHost: intent.currentRoute === intent.entryRoute };
}

export function shouldExitCanonicalPreviewBranch(currentStep: string, entryStep: string): boolean {
  return resolveCanonicalPreviewNavigation({ currentRoute: currentStep, entryRoute: entryStep }).shouldExitHost;
}
