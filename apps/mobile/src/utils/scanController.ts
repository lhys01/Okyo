import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import type { Recipe } from '../mocks';
import { getSafeRecipeMode, isRecipeMode, type RecipeMode } from '../mocks';
import { useOkyoStore, type LatestScanFailure } from '../state/useOkyoStore';
import { isUsableCanonicalRecipe } from '../state/canonicalRecipes';
import { shouldRejectScan } from './scanDecision';
import { copyToDocuments, discardUncommittedScanImage } from './scanImageStorage';
import { getSafeTerminalScanStatus, isCurrentScanSession } from './scanControllerUtils';
import { normalizeOutboundRecipeMode } from './recipeModes';
import { foodPreferencesPersistence, toApiFoodPreferences } from '../state/foodPreferences';
import { scanTraceLog, uiLog } from './uiDebug';
import { canCommitScanResult, createScanCancellation, type ScanCancellation } from './scanCancellation';
import { getScanPreviewImageMetadata } from './scanImageReference';
import { clearScanActivity, setScanActivity } from './scanActivity';
import { runScanRequestPipeline } from './scanRequestPipeline';

type StartScanInput = {
  image?: ScanImageMetadata;
  idempotencyKey?: string;
  prepareImage?: () => Promise<ScanImageMetadata>;
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
let lastPreparedScan: {
  scanSessionId: string;
  image?: ScanImageMetadata;
  idempotencyKey: string;
  reuseIdempotencyKey: boolean;
} | null = null;
type ActiveScanRequest = {
  cancellation: ScanCancellation;
  settle?: () => void;
};
const activeScanRequests = new Map<string, ActiveScanRequest>();

export function cancelScanSession(scanSessionId: string, reason: string): void {
  const request = activeScanRequests.get(scanSessionId);
  request?.cancellation.cancel();
  activeScanRequests.delete(scanSessionId);
  request?.settle?.();
  if (lastPreparedScan?.scanSessionId === scanSessionId) {
    lastPreparedScan = null;
  }

  if (isActiveScanSession(scanSessionId)) {
    useOkyoStore.getState().clearLatestScan({
      reason,
      source: 'scanController.cancel',
    });
  }

  uiLog('scanController', 'scan_cancelled', { scanSessionId, reason });
}

export function getLastPreparedImage(scanSessionId: string): ScanImageMetadata | null {
  return lastPreparedScan?.scanSessionId === scanSessionId ? lastPreparedScan.image ?? null : null;
}

export function getRetryScanIdempotencyKey(scanSessionId: string): string | undefined {
  return lastPreparedScan?.scanSessionId === scanSessionId && lastPreparedScan.reuseIdempotencyKey
    ? lastPreparedScan.idempotencyKey
    : undefined;
}

export async function startScan(input: StartScanInput) {
  const state = useOkyoStore.getState();
  const scanSessionId = createScanSessionId(input.source);
  const idempotencyKey = input.idempotencyKey ?? scanSessionId;
  const mealDescription = input.mealDescription ?? null;
  const mode = normalizeOutboundRecipeMode(input.mode);
  const previewImage = input.image;
  const cancellation = createScanCancellation();
  const activeRequest: ActiveScanRequest = { cancellation };

  for (const [previousSessionId, previousRequest] of activeScanRequests) {
    if (previousSessionId === scanSessionId) continue;
    previousRequest.cancellation.cancel();
    activeScanRequests.delete(previousSessionId);
    previousRequest.settle?.();
    if (lastPreparedScan?.scanSessionId === previousSessionId) lastPreparedScan = null;
  }

  state.clearLatestScan({
    preserveImageUri: previewImage?.uri,
    reason: `${input.reason}.clearTemporaryState`,
    source: 'scanController',
  });
  state.setSelectedMode(mode);
  track(analyticsEvents.SCAN_STARTED, { source: input.source });
  lastPreparedScan = { scanSessionId, idempotencyKey, reuseIdempotencyKey: false };
  state.beginLatestScanSession({
    scanSessionId,
    latestScanStatus: 'pending',
    latestScanFailure: null,
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: getScanPreviewImageMetadata(previewImage),
    latestAiDebugMetadata: null,
    mealDescription,
    source: input.source,
    reason: input.reason,
  });

  activeScanRequests.set(scanSessionId, activeRequest);
  setScanActivity(scanSessionId, input.prepareImage || previewImage ? 'preparing' : 'uploading');
  uiLog('scanController', 'scan_started', { source: input.source });
  scanTraceLog('session_started', { requestId: scanSessionId, source: input.source, stage: 'preparing' });
  input.navigateToAnalysis(scanSessionId);

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    if (activeScanRequests.get(scanSessionId) === activeRequest) {
      activeScanRequests.delete(scanSessionId);
    }
    clearScanActivity(scanSessionId);
    input.onSettled?.();
  };
  activeRequest.settle = settle;
  let uploadStarted = false;

  const pipelineResult = runScanRequestPipeline({
    prepare: async () => ({
      image: input.prepareImage ? await input.prepareImage() : previewImage,
      foodPreferences: await foodPreferencesPersistence.read(),
    }),
    persist: async (prepared) => ({
      ...prepared,
      image: prepared.image && input.source !== 'description'
        ? await copyToDocuments(prepared.image, scanSessionId)
        : prepared.image,
    }),
    upload: (prepared) => {
      uploadStarted = true;
      return createMockScan({
        image: prepared.image,
        mealDescription: input.mealDescription,
        mode,
        source: input.source,
        ...toApiFoodPreferences(prepared.foodPreferences),
      }, { idempotencyKey, requestId: scanSessionId, signal: cancellation.signal });
    },
    isCurrent: () => isActiveScanSession(scanSessionId) && activeScanRequests.get(scanSessionId) === activeRequest,
    signal: cancellation.signal,
    onPhase: (phase) => setScanActivity(scanSessionId, phase),
    onImageReady: (prepared) => {
      if (prepared.image && input.source !== 'description') {
        if (lastPreparedScan?.scanSessionId === scanSessionId) lastPreparedScan.image = prepared.image;
      }
      useOkyoStore.getState().writeLatestScanSession({
        scanSessionId,
        latestScanStatus: 'pending',
        latestScanFailure: null,
        latestScanResult: null,
        latestScanRecipe: null,
        selectedScanImage: getScanPreviewImageMetadata(prepared.image),
        latestAiDebugMetadata: null,
        mealDescription,
        source: input.source,
        reason: 'scanController.image_ready',
      });
    },
    onStaleImage: (prepared) => {
      if (prepared?.image) discardUncommittedScanImage(prepared.image, scanSessionId);
    },
  });

  void pipelineResult.then((result) => {
    if (result.kind === 'stale') {
      scanTraceLog('pipeline_stale', { requestId: scanSessionId, source: input.source, stage: 'commit' });
      return;
    }
    if (result.kind === 'failure') {
      if (lastPreparedScan?.scanSessionId === scanSessionId) {
        lastPreparedScan.reuseIdempotencyKey = uploadStarted;
      }
      scanTraceLog('pipeline_failure', { requestId: scanSessionId, source: input.source, stage: 'upload' });
      writeScanError(scanSessionId, input.source, result.image?.image ?? previewImage, result.error, mealDescription, cancellation);
      return;
    }
    if (lastPreparedScan?.scanSessionId === scanSessionId) lastPreparedScan.reuseIdempotencyKey = false;
    scanTraceLog('pipeline_success', { requestId: scanSessionId, source: input.source, stage: 'response' });
    writeScanResult(scanSessionId, input.source, result.image.image, result.result, mode, mealDescription, cancellation);
  }).finally(settle);

  return scanSessionId;
}

function writeScanResult(scanSessionId: string, source: ScanSource, image: ScanImageMetadata | undefined, result: CreateScanResult, mode: StartScanInput['mode'], mealDescription: string | null, cancellation: ScanCancellation) {
  if (lastPreparedScan?.scanSessionId === scanSessionId) lastPreparedScan.reuseIdempotencyKey = false;
  if (!canCommitScanResult({
    activeScanSessionId: useOkyoStore.getState().scanSessionId,
    incomingScanSessionId: scanSessionId,
    signal: cancellation.signal,
  })) return;
  const status = result.status ?? (result.scan && result.recipe ? 'success' : 'failed');
  const terminalStatus = getSafeTerminalScanStatus({ ...result, status });
  const recipes = getScanRecipes(result);
  const selectedRecipe = getRecipeForMode(recipes, mode, result.recipe);
  scanTraceLog('result_validation', {
    requestId: scanSessionId,
    source,
    status: status ?? 'missing',
    hasScan: Boolean(result.scan),
    hasRecipe: Boolean(result.recipe),
    hasSelectedRecipe: Boolean(selectedRecipe),
    recipesLength: recipes.length,
    stage: 'controller',
  });
  if (
    status === 'success' &&
    terminalStatus === 'success' &&
    result.scan &&
    isUsableCanonicalRecipe(selectedRecipe)
  ) {
    track(analyticsEvents.SCAN_SUCCEEDED, { source, result: 'success' });
    if (source === 'mock') {
      useOkyoStore.getState().writeLatestScanSession({
        scanSessionId, latestScanStatus: 'success', latestScanFailure: null, latestScanResult: result.scan,
        latestScanRecipe: selectedRecipe, selectedScanImage: getScanPreviewImageMetadata(image, result.image),
        latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.demo_success',
      });
      return;
    }
    const committed = useOkyoStore.getState().commitSuccessfulScanSession({
      scanSessionId, latestScanStatus: 'success', latestScanFailure: null, latestScanResult: result.scan,
      latestScanRecipe: selectedRecipe, selectedScanImage: getScanPreviewImageMetadata(image, result.image),
      latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.api_success',
    });
    scanTraceLog('canonical_commit', {
      requestId: scanSessionId,
      source,
      status: committed ? 'success' : 'failed',
      committed,
      failureCode: committed ? undefined : 'canonical_commit_rejected',
      stage: 'store',
    });
    if (!committed) {
      if (lastPreparedScan?.scanSessionId === scanSessionId) lastPreparedScan.reuseIdempotencyKey = true;
      useOkyoStore.getState().writeLatestScanSession({
        scanSessionId, latestScanStatus: 'failed',
        latestScanFailure: { status: 'failed', rejectionType: 'ai_failed', rejectionReason: 'Okyo couldn’t finish saving this recipe. Try again.' },
        latestScanResult: null, latestScanRecipe: null, selectedScanImage: getScanPreviewImageMetadata(image, result.image),
        latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.canonical_commit_failed',
      });
      return;
    }
    if (isRecipeMode(result.recipe?.mode)) useOkyoStore.getState().setSelectedMode(getSafeRecipeMode(result.recipe.mode));
    return;
  }
  if (status === 'partial') {
    track(analyticsEvents.SCAN_SUCCEEDED, { source, result: 'partial' });
    useOkyoStore.getState().writeLatestScanSession({
      scanSessionId, latestScanStatus: 'partial', latestScanFailure: null, latestScanResult: result.scan ?? null,
      latestScanRecipe: null, selectedScanImage: getScanPreviewImageMetadata(image, result.image),
      latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.api_partial',
    });
    return;
  }
  track(analyticsEvents.SCAN_FAILED, { source, result: 'failure', reason: 'unknown' });
  const failureStatus = terminalStatus === 'rejected' || shouldRejectScan({ result, status }) ? 'rejected' : 'failed';
  useOkyoStore.getState().writeLatestScanSession({
    scanSessionId, latestScanStatus: failureStatus, latestScanFailure: {
      status: failureStatus as LatestScanFailure['status'], rejectionType: result.rejectionType ?? 'ai_failed',
      rejectionReason: result.rejectionReason ?? 'Okyo could not complete this scan. Try again.',
    }, latestScanResult: null, latestScanRecipe: null, selectedScanImage: getScanPreviewImageMetadata(image, result.image),
    latestAiDebugMetadata: getAiDebugMetadata(result), mealDescription, source, reason: 'scanController.api_failure',
  });
}

function writeScanError(scanSessionId: string, source: ScanSource, image: ScanImageMetadata | undefined, error: unknown, mealDescription: string | null, cancellation: ScanCancellation) {
  if (!canCommitScanResult({
    activeScanSessionId: useOkyoStore.getState().scanSessionId,
    incomingScanSessionId: scanSessionId,
    signal: cancellation.signal,
  })) return;
  const message = error instanceof Error && /too large/i.test(error.message)
    ? 'This photo was too large to scan. Try a smaller image.'
    : source === 'description'
      ? 'Okyo could not generate that recipe. Try describing the meal another way.'
      : 'Okyo had trouble scanning this photo. Try again in a second.';
  track(analyticsEvents.SCAN_FAILED, { source, result: 'failure', reason: 'unknown' });
  scanTraceLog('result_error', { requestId: scanSessionId, source, status: 'failed', stage: 'controller', failureCode: 'request_or_commit_failure' });
  useOkyoStore.getState().writeLatestScanSession({
    scanSessionId, latestScanStatus: 'failed', latestScanFailure: { status: 'failed', rejectionType: 'ai_failed', rejectionReason: message },
    latestScanResult: null, latestScanRecipe: null, selectedScanImage: getScanPreviewImageMetadata(image), latestAiDebugMetadata: null,
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

function isActiveScanSession(scanSessionId: string) {
  return isCurrentScanSession(useOkyoStore.getState().scanSessionId, scanSessionId);
}

function createScanSessionId(source: ScanSource) {
  return `scan-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
