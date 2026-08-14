import * as FileSystem from 'expo-file-system/legacy';

import { ApiClientError } from '../../api/client';
import type { AnalyzeScanResult, CreateScanRequest, GenerateRecipeFromAnalysisResult, ScanImageMetadata, ScanRejectionType } from '../../api/types';
import type { Recipe } from '../../mocks';
import { getCanonicalScanRecipeId, isUsableCanonicalRecipe } from '../../state/canonicalRecipes';
import { foodPreferencesPersistence, toApiFoodPreferences } from '../../state/foodPreferences';
import { useOkyoStore } from '../../state/useOkyoStore';
import { copyToDocuments } from '../../utils/scanImageStorage';
import { buildGoalContext } from '../state/goalContext';
import { onboardingV3Persistence } from '../state/onboardingV3Persistence';
import { onboardingV4ScanPersistence, type OnboardingV4InFlightScan } from '../state/onboardingV4ScanPersistence';
import { runOnboardingAnalysis, runOnboardingRecipeGeneration } from './onboardingV3Requests';
import { createIdempotentFirstScanTransactionRunner, FirstScanTransactionError } from './onboardingV4FirstScanTransaction';

export type FirstScanPhase = 'analysis' | 'recipe';
export type FirstScanFailure = { kind: 'rejected' | 'failed'; message: string; rejectionType: ScanRejectionType };

type Dependencies = {
  analyze: typeof runOnboardingAnalysis;
  generate: typeof runOnboardingRecipeGeneration;
  loadImage: (scan: OnboardingV4InFlightScan) => Promise<ScanImageMetadata | null>;
  onPhase: (phase: FirstScanPhase) => void;
  onPersisted: () => void;
};

const defaults: Dependencies = {
  analyze: runOnboardingAnalysis,
  generate: runOnboardingRecipeGeneration,
  loadImage: loadPersistedScanImage,
  onPhase: () => undefined,
  onPersisted: () => undefined,
};
const runTransaction = createIdempotentFirstScanTransactionRunner();

export function createOnboardingV4ScanSession(source: OnboardingV4InFlightScan['source'], input: string): OnboardingV4InFlightScan {
  return {
    scanSessionId: `onboarding-v4-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source,
    ...(source === 'description' ? { mealDescription: input.trim() } : { imageUri: input }),
    startedAt: new Date().toISOString(),
  };
}

export async function runOnboardingV4FirstScan(scan: OnboardingV4InFlightScan, signal?: AbortSignal, overrides: Partial<Dependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };
  return runTransaction<ScanImageMetadata | null, AnalyzeScanResult, GenerateRecipeFromAnalysisResult>(scan, {
    writeInFlightScan: async (value) => { await onboardingV4ScanPersistence.writeInFlightScan(value); },
    readFreeRecipeConsumed: () => onboardingV4ScanPersistence.readFreeRecipeConsumed(),
    writeFreeRecipeConsumed: async () => { await onboardingV4ScanPersistence.writeFreeRecipeConsumed(true); },
    clearInFlightScan: () => onboardingV4ScanPersistence.clearInFlightScan(),
    findCommittedRecipe: (scanSessionId) => {
      const recipeId = getCanonicalScanRecipeId(scanSessionId);
      return isUsableCanonicalRecipe(useOkyoStore.getState().recipesById[recipeId]) ? recipeId : null;
    },
    loadInput: async () => {
      const image = await dependencies.loadImage(scan);
      if (scan.source !== 'description' && !image) throw new Error('The selected photo is no longer available. Please choose it again.');
      beginCanonicalSession(scan, image);
      dependencies.onPhase('analysis');
      return image;
    },
    analyze: (image) => dependencies.analyze({ source: scan.source, mode: 'Normal', ...(image ? { image } : {}), ...(scan.mealDescription ? { mealDescription: scan.mealDescription } : {}) }, signal),
    generate: async (analysis, image) => {
      dependencies.onPhase('recipe');
      const preferences = await foodPreferencesPersistence.read();
      const profile = await onboardingV3Persistence.readPersonalizedProfile();
      const dietary = toApiFoodPreferences(preferences);
      const fallbackRequest: CreateScanRequest = { source: scan.source, mode: 'Normal', ...(image ? { image } : {}), ...(scan.mealDescription ? { mealDescription: scan.mealDescription } : {}), ...dietary, goalContext: buildGoalContext(profile) };
      return dependencies.generate({ analysisId: analysis.analysisId, fallbackRequest, request: { mode: 'Normal', ...dietary, recipeRequestId: `onboarding-v4-recipe-${scan.scanSessionId}`, goalContext: buildGoalContext(profile) } }, signal);
    },
    commitUsableRecipe: async (result, analysis, image) => commitResult(scan, analysis, result, image ? await copyToDocuments(image) : null),
    onPersisted: dependencies.onPersisted,
  });
}

export function getOnboardingV4ScanFailure(error: unknown): FirstScanFailure {
  const surfaced = error instanceof FirstScanTransactionError && error.cause ? error.cause : error;
  if (surfaced instanceof ApiClientError) {
    if (surfaced.code === 'ingredients_only') return { kind: 'rejected', rejectionType: 'ingredients_only', message: "Scan a prepared dish you'd like to recreate." };
    if (surfaced.code === 'no_food_detected') return { kind: 'rejected', rejectionType: 'not_food', message: "This doesn't look like a meal yet. Try another photo." };
    if (surfaced.code === 'unclear_food') return { kind: 'rejected', rejectionType: 'unclear_image', message: 'Try a clearer photo with the whole dish visible.' };
    if (surfaced.status === 413) return { kind: 'failed', rejectionType: 'ai_failed', message: 'This photo was too large to scan. Try a smaller image.' };
    if (surfaced.status === 429) return { kind: 'failed', rejectionType: 'ai_failed', message: 'Okyo has reached its daily scan limit. Try again later.' };
  }
  const message = surfaced instanceof Error && surfaced.message.includes('no longer available') ? surfaced.message : 'Okyo had trouble finishing this recipe. Try again.';
  return { kind: 'failed', rejectionType: 'ai_failed', message };
}

async function loadPersistedScanImage(scan: OnboardingV4InFlightScan): Promise<ScanImageMetadata | null> {
  if (!scan.imageUri) return null;
  const data = await FileSystem.readAsStringAsync(scan.imageUri, { encoding: FileSystem.EncodingType.Base64 });
  const extension = scan.imageUri.split('?')[0].split('.').pop()?.toLowerCase();
  const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri: scan.imageUri, dataUrl: `data:${mimeType};base64,${data}`, mimeType, source: scan.source };
}

function beginCanonicalSession(scan: OnboardingV4InFlightScan, image: ScanImageMetadata | null) {
  const store = useOkyoStore.getState();
  store.clearLatestScan({ preserveImageUri: image?.uri, reason: 'OnboardingV4.beginSession', source: 'OnboardingV4' });
  store.setSelectedMode('Normal');
  store.beginLatestScanSession({ scanSessionId: scan.scanSessionId, latestScanStatus: 'pending', latestScanFailure: null, latestScanResult: null, latestScanRecipe: null, selectedScanImage: preview(image), latestAiDebugMetadata: null, mealDescription: scan.mealDescription ?? null, source: scan.source, reason: 'OnboardingV4.analysis_started' });
}

function commitResult(scan: OnboardingV4InFlightScan, analysis: AnalyzeScanResult, result: GenerateRecipeFromAnalysisResult, image: ScanImageMetadata | null) {
  const recipe = getResultRecipe(result);
  if (result.status && result.status !== 'success') throw new Error('Recipe response was not successful.');
  if (!result.scan || !isUsableCanonicalRecipe(recipe)) throw new Error('Recipe response was incomplete.');
  const committed = useOkyoStore.getState().commitSuccessfulScanSession({ scanSessionId: scan.scanSessionId, latestScanStatus: 'success', latestScanFailure: null, latestScanResult: result.scan, latestScanRecipe: recipe, selectedScanImage: preview(image), latestAiDebugMetadata: result.aiSource ? { aiSource: result.aiSource, aiProvider: result.aiProvider, visionModel: result.visionModel, recipeModel: result.recipeModel, fallbackReason: result.fallbackReason, confidence: result.confidence ?? analysis.confidence } : null, mealDescription: scan.mealDescription ?? null, source: scan.source, reason: 'OnboardingV4.recipe_ready' });
  if (!committed) throw new Error('Canonical onboarding recipe could not be stored.');
  return getCanonicalScanRecipeId(scan.scanSessionId);
}

function getResultRecipe(result: GenerateRecipeFromAnalysisResult): Recipe | null {
  const recipes = Array.isArray(result.recipes) ? result.recipes : [];
  return recipes.find((recipe) => recipe.mode === 'Normal') ?? result.recipe ?? recipes[0] ?? null;
}
function preview(image: ScanImageMetadata | null) { if (!image) return null; const { dataUrl: _dataUrl, ...value } = image; return value; }
