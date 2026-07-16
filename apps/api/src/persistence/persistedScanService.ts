import { randomUUID } from 'node:crypto';

import type { AiScanSuccessResult } from '../services/aiService.js';
import {
  ScanCancelledError,
  ScanDeadlineExceededError,
  throwIfScanCancelled,
} from '../services/scanDeadline.js';
import {
  RecipeGenerationError,
  RecipeValidationError,
} from '../services/recipeGenerationError.js';
import { logScanMetric, measureScanStage } from '../telemetry/scanTelemetry.js';
import type { Recipe } from '../types.js';
import {
  PersistenceUnavailableError,
  type ScanRecipeRepository,
} from './scanRecipeRepository.js';

const generatedRecipeTtlMs = 24 * 60 * 60 * 1000;

export async function runPersistedScan(options: {
  userId: string;
  repository: ScanRecipeRepository;
  generate: (scanId: string) => Promise<AiScanSuccessResult>;
  requestId?: string;
  signal?: AbortSignal;
  deadlineAt?: number;
  idFactory?: () => string;
  now?: () => number;
}): Promise<AiScanSuccessResult> {
  const id = (options.idFactory ?? randomUUID)();
  const now = options.now ?? Date.now;
  const startedAt = now();
  const requestId = options.requestId ?? id;
  let sessionCreated = false;

  try {
    throwIfScanCancelled(options.signal, options.deadlineAt);
    await measureScanStage({
      requestId,
      stage: 'scan_persistence_create',
      run: () => options.repository.createScanSession({ id, userId: options.userId }),
    });
    sessionCreated = true;
    throwIfScanCancelled(options.signal, options.deadlineAt);
    await measureScanStage({
      requestId,
      stage: 'scan_persistence_processing',
      run: () => options.repository.updateScanSession({
        id,
        userId: options.userId,
        status: 'processing',
      }),
    });

    throwIfScanCancelled(options.signal, options.deadlineAt);
    const generated = normalizePersistentIds(await measureScanStage({
      requestId,
      stage: 'scan_generation',
      run: () => options.generate(id),
    }), id);
    if (!generated.recipe) {
      throw new PersistenceUnavailableError();
    }
    const recipe = generated.recipe;

    throwIfScanCancelled(options.signal, options.deadlineAt);
    await measureScanStage({
      requestId,
      stage: 'final_persistence_recipe',
      run: () => options.repository.createGeneratedRecipe({
        id,
        userId: options.userId,
        recipe,
        expiresAt: new Date(startedAt + generatedRecipeTtlMs).toISOString(),
      }),
    });
    throwIfScanCancelled(options.signal, options.deadlineAt);
    await measureScanStage({
      requestId,
      stage: 'final_persistence_status',
      run: () => options.repository.updateScanSession({
        id,
        userId: options.userId,
        status: 'succeeded',
        provider: generated.aiProvider,
        model: generated.visionModel,
        latencyMs: Math.max(0, now() - startedAt),
        completedAt: new Date(now()).toISOString(),
      }),
    });
    logScanMetric({ requestId, stage: 'persisted_scan_total', durationMs: now() - startedAt });
    return generated;
  } catch (error) {
    if (sessionCreated) {
      const failure = sanitizeScanFailure(error);
      try {
        await measureScanStage({
          requestId,
          stage: 'final_persistence_failure',
          run: () => options.repository.updateScanSession({
            id,
            userId: options.userId,
            status: failure.status,
            failureCategory: failure.category,
            latencyMs: Math.max(0, now() - startedAt),
            completedAt: new Date(now()).toISOString(),
          }),
        });
      } catch {
        // Preserve the original failure; never include database/provider details.
      }
    }
    logScanMetric({
      requestId,
      stage: 'persisted_scan_total',
      durationMs: now() - startedAt,
      status: 'failure',
      details: { reason: sanitizeScanFailure(error).category },
    });
    throw error;
  }
}

function normalizePersistentIds(result: AiScanSuccessResult, id: string): AiScanSuccessResult {
  const recipe: Recipe | undefined = result.recipe
    ? sanitizePersistedRecipe(result.recipe, id)
    : undefined;
  return {
    ...result,
    recipe,
    scan: {
      ...result.scan,
      id,
      recipeId: id,
      groceryListId: `grocery-${id}`,
      shareCardId: `share-${id}`,
    },
    groceryList: result.groceryList
      ? { ...result.groceryList, id: `grocery-${id}`, recipeId: id }
      : undefined,
    shareCard: result.shareCard
      ? { ...result.shareCard, id: `share-${id}`, scanResultId: id }
      : undefined,
  };
}

function sanitizePersistedRecipe(source: Recipe, id: string): Recipe {
  const {
    userId: _userId,
    ownerId: _ownerId,
    installationOwner: _installationOwner,
    image: _image,
    imageDataUrl: _imageDataUrl,
    dataUrl: _dataUrl,
    rawProviderResponse: _rawProviderResponse,
    providerPrompt: _providerPrompt,
    authorization: _authorization,
    jwt: _jwt,
    ...recipe
  } = source as Recipe & Record<string, unknown>;
  return { ...recipe, id, scanResultId: id } as Recipe;
}

function sanitizeScanFailure(error: unknown): {
  status: 'rejected' | 'failed';
  category: string;
} {
  if (
    error && typeof error === 'object' &&
    'rejectionType' in error &&
    (error.rejectionType === 'no_food_detected' || error.rejectionType === 'unclear_food')
  ) {
    return { status: 'rejected', category: error.rejectionType };
  }
  if (error instanceof PersistenceUnavailableError) {
    return { status: 'failed', category: 'persistence_unavailable' };
  }
  if (error instanceof ScanDeadlineExceededError) {
    return { status: 'failed', category: 'scan_timeout' };
  }
  if (error instanceof ScanCancelledError) {
    return { status: 'failed', category: 'scan_cancelled' };
  }
  if (error instanceof RecipeValidationError) {
    return { status: 'failed', category: 'recipe_validation_failed' };
  }
  if (error instanceof RecipeGenerationError) {
    return { status: 'failed', category: 'recipe_generation_failed' };
  }
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('AI_UNAVAILABLE:')) return { status: 'failed', category: 'ai_unavailable' };
  if (message.startsWith('IMAGE_NOT_AVAILABLE:')) return { status: 'failed', category: 'image_unavailable' };
  if (message.startsWith('RECIPE_GENERATION_FAILED:')) return { status: 'failed', category: 'recipe_generation_failed' };
  if (message.startsWith('RECIPE_MISSING:')) return { status: 'failed', category: 'recipe_missing' };
  return { status: 'failed', category: 'scan_failed' };
}
