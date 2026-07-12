import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseDatabaseConfig } from '../database/config.js';

export type CapacityReservation = {
  allowed: boolean;
  reason: string | null;
  spendEventId: string | null;
};

export type ProviderSpendCompletion = {
  requestCategory: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
};

export type QuotaRepository = {
  reserve(input: {
    userId: string;
    provider: string;
    model: string;
    requestCategory: string;
    userDailyCap: number;
    globalDailyCap: number;
  }): Promise<CapacityReservation>;
  complete(input: {
    userId: string;
    spendEventId: string;
    spend: ProviderSpendCompletion;
  }): Promise<void>;
};

let repository: QuotaRepository | null = null;

export function getQuotaRepository(): QuotaRepository {
  if (!repository) {
    const config = getSupabaseDatabaseConfig();
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    repository = createQuotaRepository(client);
  }
  return repository;
}

export function createQuotaRepository(client: SupabaseClient): QuotaRepository {
  return {
    async reserve(input) {
      const { data, error } = await client.rpc('reserve_scan_capacity', {
        p_user_id: input.userId,
        p_provider: input.provider,
        p_model: input.model,
        p_request_category: input.requestCategory,
        p_user_daily_cap: input.userDailyCap,
        p_global_daily_cap: input.globalDailyCap,
      }).single();
      if (error || !data || typeof data !== 'object') {
        throw new QuotaRepositoryError();
      }

      const row = data as Record<string, unknown>;
      if (typeof row.allowed !== 'boolean') {
        throw new QuotaRepositoryError();
      }
      return {
        allowed: row.allowed,
        reason: typeof row.reason === 'string' ? row.reason : null,
        spendEventId: typeof row.spend_event_id === 'string' ? row.spend_event_id : null,
      };
    },

    async complete(input) {
      const patch = {
        request_category: input.spend.requestCategory,
        input_tokens: input.spend.inputTokens,
        output_tokens: input.spend.outputTokens,
        estimated_cost_usd: input.spend.estimatedCostUsd,
      };
      const { data, error } = await client
        .from('provider_spend_events')
        .update(patch)
        .eq('id', input.spendEventId)
        .eq('user_id', input.userId)
        .select('id')
        .maybeSingle();
      if (error || !data) {
        throw new QuotaRepositoryError();
      }
    },
  };
}

export class QuotaRepositoryError extends Error {
  constructor() {
    super('Persistent quota operation failed.');
    this.name = 'QuotaRepositoryError';
  }
}
