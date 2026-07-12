import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createQuotaRepository } from './quotaRepository.js';

test('quota repository calls only the approved RPC signature and finalizes its existing event', async () => {
  let rpcName = '';
  let rpcArgs: Record<string, unknown> = {};
  let tableName = '';
  let updatePatch: Record<string, unknown> = {};
  const filters: Array<[string, string]> = [];

  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcName = name;
      rpcArgs = args;
      return {
        single: async () => ({
          data: { allowed: true, reason: null, spend_event_id: 'event-1' },
          error: null,
        }),
      };
    },
    from(name: string) {
      tableName = name;
      return {
        update(patch: Record<string, unknown>) {
          updatePatch = patch;
          const chain = {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return chain;
            },
            select() { return chain; },
            maybeSingle: async () => ({ data: { id: 'event-1' }, error: null }),
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;

  const repository = createQuotaRepository(client);
  const reservation = await repository.reserve({
    userId: '11111111-1111-4111-8111-111111111111',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    requestCategory: 'request:vision:reserved',
    userDailyCap: 20,
    globalDailyCap: 200,
  });
  assert.deepEqual(reservation, { allowed: true, reason: null, spendEventId: 'event-1' });
  assert.equal(rpcName, 'reserve_scan_capacity');
  assert.deepEqual(Object.keys(rpcArgs).sort(), [
    'p_global_daily_cap',
    'p_model',
    'p_provider',
    'p_request_category',
    'p_user_daily_cap',
    'p_user_id',
  ]);

  await repository.complete({
    userId: '11111111-1111-4111-8111-111111111111',
    spendEventId: 'event-1',
    spend: {
      requestCategory: 'request:vision:success',
      inputTokens: 100,
      outputTokens: 20,
      estimatedCostUsd: 0.0003,
    },
  });
  assert.equal(tableName, 'provider_spend_events');
  assert.deepEqual(updatePatch, {
    request_category: 'request:vision:success',
    input_tokens: 100,
    output_tokens: 20,
    estimated_cost_usd: 0.0003,
  });
  assert.deepEqual(filters, [
    ['id', 'event-1'],
    ['user_id', '11111111-1111-4111-8111-111111111111'],
  ]);
});
