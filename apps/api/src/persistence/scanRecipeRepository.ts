import { z } from 'zod';

import {
  DatabaseGatewayError,
  type GeneratedRecipeRow,
  type ScanRecipeDatabaseGateway,
  type ScanSessionRow,
} from '../database/client.js';
import type { Recipe } from '../types.js';

const recipeSchema = z.object({
  id: z.string().uuid(),
  scanResultId: z.string().uuid(),
  title: z.string().min(1),
  mode: z.enum(['Restaurant Copy', 'Budget', 'Healthy']),
  description: z.string(),
  prepTimeMinutes: z.number().nonnegative(),
  cookTimeMinutes: z.number().nonnegative(),
  servings: z.number().positive(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  estimatedHomemadeCost: z.number().nonnegative(),
  estimatedSavings: z.number(),
  ingredients: z.array(z.object({
    name: z.string().min(1),
    quantity: z.string(),
  }).passthrough()).min(1),
  steps: z.array(z.string().min(1)).min(1),
  substitutions: z.array(z.string()),
  pantryNote: z.string(),
  confidenceNote: z.string(),
}).passthrough();

export class PersistenceUnavailableError extends Error {
  constructor() {
    super('Durable recipe storage is temporarily unavailable.');
    this.name = 'PersistenceUnavailableError';
  }
}

export class InvalidPersistedRecipeError extends Error {
  constructor() {
    super('Stored recipe data was invalid.');
    this.name = 'InvalidPersistedRecipeError';
  }
}

export type ScanRecipeRepository = {
  createScanSession(input: { id: string; userId: string }): Promise<void>;
  updateScanSession(input: {
    id: string;
    userId: string;
    status: ScanSessionRow['status'];
    provider?: string;
    model?: string;
    latencyMs?: number;
    failureCategory?: string;
    completedAt?: string;
  }): Promise<void>;
  createGeneratedRecipe(input: {
    id: string;
    userId: string;
    recipe: Recipe;
    expiresAt: string;
  }): Promise<void>;
  findOwnedRecipe(userId: string, recipeId: string): Promise<Recipe | null>;
  listOwnedRecipes(userId: string): Promise<Recipe[]>;
};

export function createScanRecipeRepository(
  database: ScanRecipeDatabaseGateway,
  options: { now?: () => Date } = {},
): ScanRecipeRepository {
  const now = options.now ?? (() => new Date());

  return {
    async createScanSession(input) {
      await runDatabaseOperation(() => database.insertScanSession({
        id: input.id,
        user_id: input.userId,
        status: 'pending',
      }));
    },

    async updateScanSession(input) {
      const updated = await runDatabaseOperation(() => database.updateOwnedScanSession(
        input.userId,
        input.id,
        {
          status: input.status,
          provider: input.provider,
          model: input.model,
          latency_ms: input.latencyMs,
          failure_category: input.failureCategory,
          completed_at: input.completedAt,
        },
      ));
      if (!updated) throw new PersistenceUnavailableError();
    },

    async createGeneratedRecipe(input) {
      const validatedRecipe = parseRecipe({
        id: input.id,
        user_id: input.userId,
        recipe: input.recipe,
        expires_at: input.expiresAt,
      });
      const existing = await this.findOwnedRecipe(input.userId, input.id);
      if (existing) {
        if (stableJson(existing) !== stableJson(validatedRecipe)) {
          throw new PersistenceUnavailableError();
        }
        return;
      }

      const row: GeneratedRecipeRow = {
        id: input.id,
        user_id: input.userId,
        recipe: validatedRecipe,
        expires_at: input.expiresAt,
      };
      try {
        await database.insertGeneratedRecipe(row);
      } catch (error) {
        if (error instanceof DatabaseGatewayError && error.duplicate) {
          const retryExisting = await this.findOwnedRecipe(input.userId, input.id);
          if (retryExisting && stableJson(retryExisting) === stableJson(validatedRecipe)) return;
        }
        throw new PersistenceUnavailableError();
      }
    },

    async findOwnedRecipe(userId, recipeId) {
      const row = await runDatabaseOperation(() => database.getOwnedGeneratedRecipe(
        userId,
        recipeId,
        now().toISOString(),
      ));
      return row ? parseRecipe(row) : null;
    },

    async listOwnedRecipes(userId) {
      const rows = await runDatabaseOperation(() => database.listOwnedGeneratedRecipes(
        userId,
        now().toISOString(),
      ));
      return rows.map(parseRecipe);
    },
  };
}

function parseRecipe(row: GeneratedRecipeRow): Recipe {
  const parsed = recipeSchema.safeParse(row.recipe);
  if (!parsed.success || parsed.data.id !== row.id || parsed.data.scanResultId !== row.id) {
    throw new InvalidPersistedRecipeError();
  }
  return parsed.data as Recipe;
}

async function runDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InvalidPersistedRecipeError || error instanceof PersistenceUnavailableError) {
      throw error;
    }
    throw new PersistenceUnavailableError();
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
