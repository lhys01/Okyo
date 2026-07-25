import type { CreateScanResult, ScanImageMetadata } from '../api/types';

export type OnboardingScanStartDecision =
  | { canStart: true; image: ScanImageMetadata }
  | { canStart: false; reason: 'scan_already_submitting' | 'missing_image' | 'placeholder_image' | 'missing_image_uri' };

export type OnboardingPlanScreen = 'weeklyGoal' | 'reminder' | 'loading' | 'scan';

export type OnboardingScanLoadingState = {
  activeScanSessionId: string | null | undefined;
  activeScanStatus: string | null | undefined;
  loadingScanSessionId: string | null | undefined;
  screenKey: string;
};

export function getNextOnboardingPlanScreen(screen: OnboardingPlanScreen): OnboardingPlanScreen {
  if (screen === 'weeklyGoal') {
    return 'reminder';
  }
  if (screen === 'reminder') {
    return 'loading';
  }
  return 'scan';
}

export function getOnboardingResultFallbackScreen() {
  return 'scan' as const;
}

export function getOnboardingUploadUri(processedUri: string | null | undefined, originalUri: string) {
  return typeof processedUri === 'string' && processedUri.trim().length > 0
    ? processedUri.trim()
    : originalUri;
}

export function getOnboardingScanStartDecision(
  isSubmitting: boolean,
  image: ScanImageMetadata | null | undefined,
): OnboardingScanStartDecision {
  if (isSubmitting) {
    return { canStart: false, reason: 'scan_already_submitting' };
  }
  if (!image) {
    return { canStart: false, reason: 'missing_image' };
  }
  if (image.placeholder) {
    return { canStart: false, reason: 'placeholder_image' };
  }
  if (!getRealOnboardingImageUri(image)) {
    return { canStart: false, reason: 'missing_image_uri' };
  }

  return { canStart: true, image };
}

export function getRealOnboardingImageUri(image: ScanImageMetadata | null | undefined) {
  return typeof image?.uri === 'string' && image.uri.trim().length > 0 && !image.placeholder
    ? image.uri.trim()
    : null;
}

export function getOnboardingResponseImage(
  selectedImage: ScanImageMetadata,
  result: Pick<CreateScanResult, 'image'>,
) {
  return selectedImage.placeholder ? result.image : selectedImage;
}

export function isCurrentOnboardingScanSession(
  activeScanSessionId: string | null | undefined,
  scanSessionId: string,
) {
  return activeScanSessionId === scanSessionId;
}

export function shouldKeepOnboardingScanLoading({
  activeScanSessionId,
  activeScanStatus,
  loadingScanSessionId,
  screenKey,
}: OnboardingScanLoadingState) {
  return (
    screenKey === 'loading' &&
    activeScanStatus === 'pending' &&
    Boolean(loadingScanSessionId) &&
    activeScanSessionId === loadingScanSessionId
  );
}

export function getOnboardingScanResolutionScreen({
  activeScanSessionId,
  completedScanSessionId,
  outcome,
}: {
  activeScanSessionId: string | null | undefined;
  completedScanSessionId: string;
  outcome: 'success' | 'failure';
}) {
  if (activeScanSessionId !== completedScanSessionId) {
    return null;
  }

  return outcome === 'success' ? ('firstResult' as const) : ('scan' as const);
}

export function canUseScanStateForRoute(
  routeScanSessionId: string | null | undefined,
  activeScanSessionId: string | null | undefined,
  latestScanSessionId: string | null | undefined,
) {
  if (!routeScanSessionId) {
    return true;
  }

  return activeScanSessionId === routeScanSessionId || latestScanSessionId === routeScanSessionId;
}

export function getMissingOnboardingImageError() {
  return 'Okyo could not find that photo anymore. Choose another image and try again.';
}
