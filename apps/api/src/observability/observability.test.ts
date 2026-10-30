import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateCostUsd, findModelPrice } from './aiPricing.js';
import { getRequestContext, runWithRequestContext } from './requestContext.js';

// ─── AI pricing ─────────────────────────────────────────────────────────────

test('estimateCostUsd computes from the table for a known model', () => {
  // gpt-4o-mini: $0.15 / 1M in, $0.60 / 1M out
  const result = estimateCostUsd('openai/gpt-4o-mini', 1_000_000, 1_000_000);
  assert.equal(result.estimated, true);
  assert.equal(result.matchedModelKey, 'gpt-4o-mini');
  assert.equal(result.costUsd, 0.75);
});

test('estimateCostUsd resolves a bare model id without the provider prefix', () => {
  const result = estimateCostUsd('gpt-4o-mini', 500_000, 0);
  assert.equal(result.costUsd, 0.075);
});

test('estimateCostUsd returns null / not-estimated for an unknown model', () => {
  const result = estimateCostUsd('some/model-we-never-priced', 1000, 1000);
  assert.equal(result.costUsd, null);
  assert.equal(result.estimated, false);
});

test('estimateCostUsd returns null when token counts are missing (never fabricates)', () => {
  const result = estimateCostUsd('gpt-4o-mini', undefined, 100);
  assert.equal(result.costUsd, null);
  assert.equal(result.estimated, false);
});

test('a known free tier prices to a real zero, not "unknown"', () => {
  const result = estimateCostUsd('nvidia/nemotron-3-nano:free', 1000, 1000);
  assert.equal(result.costUsd, 0);
  assert.equal(result.estimated, true);
});

test('findModelPrice is case-insensitive', () => {
  assert.ok(findModelPrice('OpenAI/GPT-4O-MINI'));
});

// ─── request context ────────────────────────────────────────────────────────

test('runWithRequestContext exposes the id to nested calls', () => {
  runWithRequestContext({ requestId: 'req-123', anonId: 'anon-abc' }, () => {
    assert.equal(getRequestContext()?.requestId, 'req-123');
    assert.equal(getRequestContext()?.anonId, 'anon-abc');
  });
});

test('getRequestContext is undefined outside a request', () => {
  assert.equal(getRequestContext(), undefined);
});
