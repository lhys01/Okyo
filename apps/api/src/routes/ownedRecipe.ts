import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { ScanRecipeRepository } from '../persistence/scanRecipeRepository.js';
import type { ApiFailure, ApiResponse, Recipe } from '../types.js';

export function createOwnedRecipeGetHandler(options: {
  getRepository: () => ScanRecipeRepository;
  getEditorialRecipe: (recipeId: string) => Recipe | null | undefined;
}): RequestHandler {
  return async function ownedRecipeGetHandler(request, response, next) {
    try {
      const recipe = await findOwnedOrEditorialRecipe({
        userId: getAuthenticatedUserId(request),
        recipeId: request.params.recipeId,
        repository: options.getRepository(),
        getEditorialRecipe: options.getEditorialRecipe,
      });
      if (!recipe) {
        const payload: ApiFailure = {
          ok: false,
          error: { code: 'recipe_not_found', message: 'Recipe was not found.' },
        };
        response.status(404).json(payload);
        return;
      }
      const payload: ApiResponse<{ recipe: Recipe }> = { ok: true, data: { recipe } };
      response.json(payload);
    } catch (error) {
      next(error);
    }
  };
}

export async function findOwnedOrEditorialRecipe(options: {
  userId: string;
  recipeId: string;
  repository: ScanRecipeRepository;
  getEditorialRecipe: (recipeId: string) => Recipe | null | undefined;
}) {
  if (isUuid(options.recipeId)) {
    return options.repository.findOwnedRecipe(options.userId, options.recipeId);
  }
  return options.getEditorialRecipe(options.recipeId) ?? null;
}

export function getAuthenticatedUserId(request: Request) {
  if (!request.auth?.userId) {
    throw new Error('Authenticated request context was missing.');
  }
  return request.auth.userId;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
