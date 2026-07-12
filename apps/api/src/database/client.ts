import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseDatabaseConfig } from './config.js';

export type ScanSessionRow = {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'partial' | 'rejected' | 'failed' | 'cancelled';
  provider?: string | null;
  model?: string | null;
  latency_ms?: number | null;
  failure_category?: string | null;
  completed_at?: string | null;
};

export type GeneratedRecipeRow = {
  id: string;
  user_id: string;
  recipe: unknown;
  created_at?: string;
  expires_at: string;
};

export class DatabaseGatewayError extends Error {
  readonly duplicate: boolean;

  constructor(options: { duplicate?: boolean } = {}) {
    super('Supabase database operation failed.');
    this.name = 'DatabaseGatewayError';
    this.duplicate = options.duplicate ?? false;
  }
}

export type ScanRecipeDatabaseGateway = {
  insertScanSession(row: ScanSessionRow): Promise<void>;
  updateOwnedScanSession(userId: string, scanId: string, patch: Partial<ScanSessionRow>): Promise<boolean>;
  insertGeneratedRecipe(row: GeneratedRecipeRow): Promise<void>;
  getOwnedGeneratedRecipe(userId: string, recipeId: string, nowIso: string): Promise<GeneratedRecipeRow | null>;
  listOwnedGeneratedRecipes(userId: string, nowIso: string): Promise<GeneratedRecipeRow[]>;
};

let gateway: ScanRecipeDatabaseGateway | null = null;

export function getScanRecipeDatabaseGateway() {
  if (!gateway) {
    const config = getSupabaseDatabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    gateway = createScanRecipeDatabaseGateway(client);
  }
  return gateway;
}

export function createScanRecipeDatabaseGateway(client: SupabaseClient): ScanRecipeDatabaseGateway {
  return {
    async insertScanSession(row) {
      const { error } = await client.from('scan_sessions').insert(row);
      throwIfDatabaseError(error);
    },

    async updateOwnedScanSession(userId, scanId, patch) {
      const { data, error } = await client
        .from('scan_sessions')
        .update(patch)
        .eq('id', scanId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      throwIfDatabaseError(error);
      return Boolean(data);
    },

    async insertGeneratedRecipe(row) {
      const { error } = await client.from('generated_recipes').insert(row);
      throwIfDatabaseError(error);
    },

    async getOwnedGeneratedRecipe(userId, recipeId, nowIso) {
      const { data, error } = await client
        .from('generated_recipes')
        .select('id,user_id,recipe,created_at,expires_at')
        .eq('id', recipeId)
        .eq('user_id', userId)
        .gt('expires_at', nowIso)
        .maybeSingle();
      throwIfDatabaseError(error);
      return data as GeneratedRecipeRow | null;
    },

    async listOwnedGeneratedRecipes(userId, nowIso) {
      const { data, error } = await client
        .from('generated_recipes')
        .select('id,user_id,recipe,created_at,expires_at')
        .eq('user_id', userId)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });
      throwIfDatabaseError(error);
      return (data ?? []) as GeneratedRecipeRow[];
    },
  };
}

function throwIfDatabaseError(error: { code?: string } | null) {
  if (error) {
    throw new DatabaseGatewayError({ duplicate: error.code === '23505' });
  }
}
