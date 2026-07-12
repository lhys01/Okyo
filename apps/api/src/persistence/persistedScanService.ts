import { randomUUID } from 'node:crypto';

import type { AiScanSuccessResult } from '../services/aiService.js';
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
  idFactory?: () => string;
  now?: () => number;
}): Promise<AiScanSuccessResult> {
  const id = (options.idFactory ?? randomUUID)();
  const now = options.now ?? Date.now;
  const startedAt = now();
  let sessionCreated = false;

  try {
    await options.repository.createScanSession({ id, userId: options.userId });
    sessionCreated = true;
    await options.repository.updateScanSession({
      id,
      userId: options.userId,
      status: 'processing',
    });

    const generated = normalizePersistentIds(await options.generate(id), id);
    if (!generated.recipe) {
      throw new PersistenceUnavailableError();
    }

    await options.repository.createGeneratedRecipe({
      id,
      userId: options.userId,
      recipe: generated.recipe,
      expiresAt: new Date(startedAt + generatedRecipeTtlMs).toISOString(),
    });
    await options.repository.updateScanSession({
      id,
      userId: options.userId,
      status: 'succeeded',
      provider: generated.aiProvider,
      model: generated.visionModel,
      latencyMs: Math.max(0, now() - startedAt),
      completedAt: new Date(now()).toISOString(),
    });
    return generated;
  } catch (error) {
    if (sessionCreated) {
      const failure = sanitizeScanFailure(error);
      try {
        await options.repository.updateScanSession({
          id,
          userId: options.userId,
          status: failure.status,
          failureCategory: failure.category,
          latencyMs: Math.max(0, now() - startedAt),
          completedAt: new Date(now()).toISOString(),
        });
      } catch {
        // Preserve the original failure; never include database/provider details.
      }
    }
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
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('AI_UNAVAILABLE:')) return { status: 'failed', category: 'ai_unavailable' };
  if (message.startsWith('IMAGE_NOT_AVAILABLE:')) return { status: 'failed', category: 'image_unavailable' };
  if (message.startsWith('RECIPE_GENERATION_FAILED:')) return { status: 'failed', category: 'recipe_generation_failed' };
  if (message.startsWith('RECIPE_MISSING:')) return { status: 'failed', category: 'recipe_missing' };
  return { status: 'failed', category: 'scan_failed' };
}
