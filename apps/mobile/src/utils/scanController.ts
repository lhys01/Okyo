import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import type { Recipe } from '../mocks';
import { getSafeRecipeMode, isRecipeMode, type RecipeMode } from '../mocks';
import { useOkyoStore, type LatestScanFailure } from '../state/useOkyoStore';
import { hasFoodEvidence, isUsableScan, shouldRejectScan } from './scanDecision';
import { copyToDocuments } from './scanImageStorage';
import { getSafeTerminalScanStatus, isCurrentScanSession } from './scanControllerUtils';
import { uiLog } from './uiDebug';

type StartScanInput = {
  image?: ScanImageMetadata;
  mealDescription?: string;
  mode: RecipeMode;
  navigateToAnalysis: (scanSessionId: string) => void;
  reason: string;
  source: ScanSource;
  onSettled?: () => void;
};

// Non-persisted, in-memory cache of the last fully-prepared image (with dataUrl)
// per session. The store only ever holds the stripped preview (no dataUrl, to
// keep AsyncStorage small), but "Try again" needs the real bytes to re-submit
// without re-picking a photo.
let lastPreparedImage: { scanSessionId: string; image: ScanImageMetadata } | null = null;

export function getLastPreparedImage(scanSessionId: string): ScanImageMetadata | null {
  return lastPreparedImage?.scanSessionId === scanSessionId ? lastPreparedImage.image : null;
}

export async function startScan(input: StartScanInput) {
  const state = useOkyoStore.getState();
  const scanSessionId = createScanSessionId(input.source);
  const mealDescription = input.mealDescription ?? null;

  state.clearLatestScan({ reason: `${input.reason}.clearTemporaryState`, source: 'scanController' });
  const image = input.image && input.source !== 'description'
    ? await copyToDocuments(input.image)
    : input.image;
  if (image && input.source !== 'description') {
    lastPreparedImage = { scanSessionId, image };
  }
  const uploadedImage = isRealUploadedImage(input.source, image);
  state.beginLatestScanSession({
    scanSessionId,
    latestScanStatus: 'pending',
    latestScanFailure: null,
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: getPreviewImageMetadata(image),
    latestAiDebugMetadata: null,
    mealDescription,
    source: input.source,
    reason: input.reason,
  });
  track(analyticsEvents.SCAN_STARTED, { screen: 'scanController', source: input.source });
  if (uploadedImage) {
    track(analyticsEvents.PHOTO_UPLOADED, { screen: 'scanController', source: input.source });
  }
  uiLog('scanController', 'scan_started', { source: input.source, scanSessionId, uploadedImage });
  input.navigateToAnalysis(scanSessionId);

  void createMockScan({ image, mealDescription: input.mealDescription, mode: input.mode, source: input.source })
    .then((result) => {
      writeScanResult(scanSessionId, input.source, image, result, input.mode, mealDescription);
      input.onSettled?.();
    })
    .catch((error: unknown) => {
      writeScanError(scanSessionId, input.source, image, error, mealDescription);
      input.onSettled?.();
    });

  return scanSessionId;
}

function writeScanResult(scanSessionId: string, source: ScanSource, image: ScanImageMetadata | undefined, result: CreateScanResult, mode: StartScanInput['mode'], mealDescription: string | null) {
  if (!isActiveScanSession(scanSessionId)) return;
  const status = result.status ?? (result.scan && result.recipe ? 'success' : 'failed');
  const terminalStatus = getSafeTerminalScanStatus({ ...result, status });
  const recipes = getScanRecipes(result);
  const foodEvidence = hasFoodEvidence({ result, status });
  const usable = Boolean(result.scan && isUsableScan({ recipes, result, scan: result.scan, status }));
  if ((terminalStatus === 'success' || terminalStatus === 'partial') && usable && result.scan) {
    const selectedRecipe = getRecipeForMode(recipes, mode, result.recipe);
    const storedStatus = status === 'partial' ? 'partial' : selectedRecipe || foodEvidence ? 'success' : status;
    useOkyoStore.getState().writeLatestScanSession({
      scanSessionId, latestScanStatus: storedStatus, latestScanFailure: null, latestScanResult: result.scan,
      latestScanRecipe: selectedRecipe, selectedScanImage: getPreviewImageMetadata(result.image ?? image),
      latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.api_success',
    });
    if (isRecipeMode(result.recipe?.mode)) useOkyoStore.getState().setSelectedMode(getSafeRecipeMode(result.recipe.mode));
    return;
  }
  const failureStatus = terminalStatus === 'rejected' || shouldRejectScan({ result, status }) ? 'rejected' : 'failed';
  useOkyoStore.getState().writeLatestScanSession({
    scanSessionId, latestScanStatus: failureStatus, latestScanFailure: {
      status: failureStatus as LatestScanFailure['status'], rejectionType: result.rejectionType ?? 'ai_failed',
      rejectionReason: result.rejectionReason ?? 'Okyo could not complete this scan. Try again.',
    }, latestScanResult: null, latestScanRecipe: null, selectedScanImage: getPreviewImageMetadata(result.image ?? image),
    latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.api_failure',
  });
}

function writeScanError(scanSessionId: string, source: ScanSource, image: ScanImageMetadata | undefined, error: unknown, mealDescription: string | null) {
  if (!isActiveScanSession(scanSessionId)) return;
  const message = error instanceof Error && /too large/i.test(error.message)
    ? 'This photo was too large to scan. Try a smaller image.'
    : source === 'description'
      ? 'Okyo could not generate that recipe. Try describing the meal another way.'
      : 'Okyo had trouble scanning this photo. Try again in a second.';
  useOkyoStore.getState().writeLatestScanSession({
    scanSessionId, latestScanStatus: 'failed', latestScanFailure: { status: 'failed', rejectionType: 'ai_failed', rejectionReason: message },
    latestScanResult: null, latestScanRecipe: null, selectedScanImage: getPreviewImageMetadata(image), latestAiDebugMetadata: null,
    mealDescription, source, reason: 'scanController.api_error',
  });
}

function getScanRecipes(result: CreateScanResult) {
  return Array.isArray(result.recipes) && result.recipes.length > 0 ? result.recipes : result.recipe ? [result.recipe] : [];
}

function getRecipeForMode(recipes: Recipe[], mode: StartScanInput['mode'], fallback?: Recipe) {
  return recipes.find((recipe) => recipe.mode === mode) ?? fallback ?? recipes[0] ?? null;
}

function getAiDebugMetadata(result: CreateScanResult) {
  return result.aiSource ? {
    aiSource: result.aiSource, aiProvider: result.aiProvider, visionModel: result.visionModel,
    recipeModel: result.recipeModel, fallbackReason: result.fallbackReason, confidence: result.confidence,
  } : null;
}

function getPreviewImageMetadata(image: ScanImageMetadata | undefined) {
  if (!image) return null;
  const { dataUrl: _dataUrl, ...preview } = image;
  return preview;
}

function isRealUploadedImage(source: ScanSource, image?: ScanImageMetadata) {
  return source !== 'description' && source !== 'mock' && Boolean(image && !image.placeholder && (image.uri || image.dataUrl || image.fileName));
}

function isActiveScanSession(scanSessionId: string) {
  return isCurrentScanSession(useOkyoStore.getState().scanSessionId, scanSessionId);
}

function createScanSessionId(source: ScanSource) {
  return `scan-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
