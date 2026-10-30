import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { CreateScanRequest, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { sampleFoodImageUrls } from '../data/sampleFoodImages';
import { getSafeRecipeMode, type Recipe, type RecipeMode } from '../mocks';
import { useOkyoStore, type LatestScanFailure } from '../state/useOkyoStore';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { buildGoalContext } from '../onboarding-v3/state/goalContext';
import { foodPreferencesPersistence, toApiFoodPreferences } from '../state/foodPreferences';
import { getPreviewImageMetadata } from '../utils/imagePrep';
import { hasFoodEvidence, isUsableScan, shouldRejectScan } from '../utils/scanDecision';
import { createScanSessionId } from '../utils/scanSessionId';

export { createScanSessionId };

// Shared scan lifecycle: session-id generation, the API call, stale-session-guarded
// store writes. This alternate implementation is not currently mounted: the
// active product uses utils/scanController and active V3 has its own controller.

/**
 * Read the active onboarding profile and canonical dietary storage. Direction C
 * answers have no production store/API contract yet and remain in their own module.
 */
async function currentPreferences() {
  const [profile, dietary] = await Promise.all([
    onboardingV3Persistence.readPersonalizedProfile(),
    foodPreferencesPersistence.read(),
  ]);
  return { goalContext: buildGoalContext(profile), ...toApiFoodPreferences(dietary) };
}

export function startImageScan(params: { source: 'camera' | 'photos'; image: ScanImageMetadata; mode: RecipeMode }): string {
  const scanSessionId = createScanSessionId(params.source);
  launchScan({
    scanSessionId,
    source: params.source,
    request: { source: params.source, mode: params.mode, image: params.image },
    previewImage: getPreviewImageMetadata(params.image),
  });

  return scanSessionId;
}

export function startDescriptionScan(params: { description: string; mode: RecipeMode }): string {
  const scanSessionId = createScanSessionId('description');
  launchScan({
    scanSessionId,
    source: 'description',
    request: { source: 'description', mode: params.mode, mealDescription: params.description },
    previewImage: null,
  });

  return scanSessionId;
}

function isActiveScanSession(scanSessionId: string) {
  return useOkyoStore.getState().scanSessionId === scanSessionId;
}

function launchScan(params: {
  scanSessionId: string;
  source: ScanSource;
  request: CreateScanRequest;
  previewImage: ScanImageMetadata | null;
}) {
  const { scanSessionId, source, request, previewImage } = params;
  const store = useOkyoStore.getState();

  
  store.beginLatestScanSession({
    scanSessionId,
    latestScanStatus: 'pending',
    latestScanFailure: null,
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: previewImage,
    latestAiDebugMetadata: null,
    mealDescription: request.mealDescription ?? null,
    source,
    reason: 'scanController.startScan',
  });

  currentPreferences().then((preferences) => createMockScan({ ...request, ...preferences }))
    .then((result) => handleScanSuccess({ scanSessionId, source, request, result }))
    .catch((error: unknown) => handleScanError({ scanSessionId, source, request, error }));
}

function handleScanSuccess(params: {
  scanSessionId: string;
  source: ScanSource;
  request: CreateScanRequest;
  result: CreateScanResult;
}) {
  const { scanSessionId, source, request, result } = params;
  if (!isActiveScanSession(scanSessionId)) {
    return;
  }

  const store = useOkyoStore.getState();
  const status = result.status ?? 'success';
  // Prefer the user's original uploaded photo over the API-returned image: the API
  // may echo back image:{placeholder:true} on a conversion error, which would make
  // downstream screens think there's no real photo even though the user's URI is fine.
  const imageForStorage = (!request.image?.placeholder && request.image?.uri) ? request.image : (result.image ?? request.image);
  const responseImage = getPreviewImageMetadata(imageForStorage);
  const aiDebugMetadata = getAiDebugMetadata(result);
  const foodEvidence = hasFoodEvidence({ result, status });
  const scanRecipes = getScanRecipes(result);
  const shouldUseSuccessPath = Boolean(
    result.scan &&
    isUsableScan({ recipes: scanRecipes, result, scan: result.scan, status }),
  );

  if (shouldUseSuccessPath && result.scan) {
    const selectedRecipe = getScanRecipeForMode(scanRecipes, request.mode ?? 'Normal', result.recipe);
    const storedStatus = status === 'partial'
      ? 'partial'
      : selectedRecipe || foodEvidence
        ? 'success'
        : status;
    store.writeLatestScanSession({
      scanSessionId,
      latestScanStatus: storedStatus,
      latestScanFailure: null,
      latestScanResult: result.scan,
      latestScanRecipe: selectedRecipe,
      selectedScanImage: responseImage,
      latestAiDebugMetadata: aiDebugMetadata,
      mealDescription: request.mealDescription ?? null,
      source,
      reason: 'scanController.api_success',
    });
    if (result.recipe?.mode) {
      store.setSelectedMode(getSafeRecipeMode(result.recipe.mode));
    }
    return;
  }

  const failureStatus = shouldRejectScan({ result, status }) ? 'rejected' : 'failed';
  const failure: LatestScanFailure = {
    status: failureStatus,
    rejectionType: result.rejectionType ?? 'ai_failed',
    rejectionReason: result.rejectionReason ?? result.fallbackReason ?? '',
  };
  store.writeLatestScanSession({
    scanSessionId,
    latestScanStatus: failureStatus,
    latestScanFailure: failure,
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: responseImage,
    latestAiDebugMetadata: aiDebugMetadata,
    mealDescription: request.mealDescription ?? null,
    source,
    reason: 'scanController.api_failure',
  });
}

function handleScanError(params: {
  scanSessionId: string;
  source: ScanSource;
  request: CreateScanRequest;
  error: unknown;
}) {
  const { scanSessionId, source, request, error } = params;
  if (!isActiveScanSession(scanSessionId)) {
    return;
  }

  

  const store = useOkyoStore.getState();
  const failure: LatestScanFailure = {
    status: 'failed',
    rejectionType: 'ai_failed',
    rejectionReason: error instanceof Error ? error.message : 'Unknown scan error.',
  };
  store.writeLatestScanSession({
    scanSessionId,
    latestScanStatus: 'failed',
    latestScanFailure: failure,
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: getPreviewImageMetadata(request.image),
    latestAiDebugMetadata: { aiSource: 'fallback_ai', fallbackReason: 'mobile_api_unavailable', confidence: 0 },
    mealDescription: request.mealDescription ?? null,
    source,
    reason: 'scanController.api_error',
  });
}

function getAiDebugMetadata(result: CreateScanResult) {
  if (!result.aiSource) {
    return null;
  }

  return {
    aiSource: result.aiSource,
    aiProvider: result.aiProvider,
    confidence: result.confidence,
    fallbackReason: result.fallbackReason,
    recipeModel: result.recipeModel,
    visionModel: result.visionModel,
  };
}

function getScanRecipes(result: CreateScanResult) {
  const decorateRecipe = shouldUseSampleRecipeImages(result) ? addSampleImageUrl : (recipe: Recipe) => recipe;

  if (Array.isArray(result.recipes) && result.recipes.length > 0) {
    return result.recipes.map(decorateRecipe);
  }

  return result.recipe ? [decorateRecipe(result.recipe)] : [];
}

function shouldUseSampleRecipeImages(result: CreateScanResult) {
  return result.source === 'mock' || result.image?.placeholder === true;
}

function addSampleImageUrl(recipe: Recipe): Recipe {
  if (recipe.imageUrl || recipe.imageUri) {
    return recipe;
  }

  return { ...recipe, imageStatus: 'ready', imageUrl: getSampleImageUrlForDish(recipe.title) };
}

function getSampleImageUrlForDish(dishName: string) {
  const normalized = dishName.toLowerCase();
  if (normalized.includes('pasta') || normalized.includes('rigatoni') || normalized.includes('noodle') || normalized.includes('spaghetti')) {
    return sampleFoodImageUrls.pasta;
  }
  if (normalized.includes('burger') || normalized.includes('sandwich') || normalized.includes('biscuit')) {
    return sampleFoodImageUrls.burger;
  }
  if (normalized.includes('salad')) {
    return sampleFoodImageUrls.salad;
  }
  if (normalized.includes('cake') || normalized.includes('cookie') || normalized.includes('dessert')) {
    return sampleFoodImageUrls.dessert;
  }
  if (normalized.includes('egg') || normalized.includes('toast') || normalized.includes('breakfast')) {
    return sampleFoodImageUrls.breakfast;
  }

  return sampleFoodImageUrls.bowl;
}

function getScanRecipeForMode(recipes: Recipe[], mode: RecipeMode, fallbackRecipe: Recipe | null | undefined = null) {
  return recipes.find((recipe) => recipe.mode === mode) ?? fallbackRecipe ?? null;
}
