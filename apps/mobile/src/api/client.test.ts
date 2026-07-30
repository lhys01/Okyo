import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CORRECTION_FAILURE_MESSAGE,
  correctScanRecipe,
  createMockScan,
  createTextRecipe,
  normalizeRecipeApiRequestBody,
  parseApiResponse,
} from './client';
import { CURRENT_RECIPE_MODES } from '../utils/recipeModes';

test('API envelope parsing rejects HTML and malformed JSON without exposing parser errors', () => {
  assert.equal(parseApiResponse('<html>Not found</html>'), null);
  assert.equal(parseApiResponse('{not-json'), null);
  assert.equal(parseApiResponse(JSON.stringify({ ok: true })), null);
});

test('correction failures use one recoverable user-safe message', async () => {
  const originalFetch = globalThis.fetch;
  const failures = [
    () => Promise.resolve(new Response('<html>Not found</html>', { status: 404 })),
    () => Promise.resolve(new Response(JSON.stringify({
      ok: false,
      error: { code: 'recipe_not_found', message: 'Recipe endpoint is missing.' },
    }), { status: 404 })),
    () => Promise.resolve(new Response('{malformed', { status: 500 })),
    () => Promise.resolve(new Response(JSON.stringify({
      ok: false,
      error: { code: 'server_error', message: 'raw provider detail' },
    }), { status: 500 })),
    () => Promise.resolve(new Response(JSON.stringify({
      ok: false,
      error: { code: 'recipe_correction_failed', message: 'provider ignored the correction' },
    }), { status: 422 })),
    () => Promise.reject(new DOMException('request timed out', 'AbortError')),
    () => Promise.reject(new TypeError('network internals')),
  ];

  try {
    for (const failure of failures) {
      globalThis.fetch = failure;
      await assert.rejects(
        correctScanRecipe('recipe-1', {
          correctionNote: 'This is a vegetable pizza.',
          mode: 'Normal',
        }),
        (error: unknown) => error instanceof Error && error.message === CORRECTION_FAILURE_MESSAGE,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('scan, description, and correction boundaries normalize legacy or malformed modes', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      ok: true,
      data: { source: 'photos' },
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    await createMockScan({ source: 'photos', mode: 'Budget' as never });
    await createTextRecipe('A warm grain bowl', 'Restaurant Copy' as never);
    await correctScanRecipe('source-revision-1', {
      correctionNote: 'Adjust the seasoning',
      expectedSourceRecipeId: 'source-revision-1',
      mode: 'Budget' as never,
    });
    await createMockScan({ source: 'camera', mode: 'unknown-mode' as never });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requestBodies.map((body) => body.mode), [
    'Normal',
    'Normal',
    'Normal',
    'Normal',
  ]);
});

test('all four current outbound modes pass through unchanged', () => {
  for (const mode of CURRENT_RECIPE_MODES) {
    assert.deepEqual(
      normalizeRecipeApiRequestBody('/v1/scans', { source: 'photos', mode }),
      { source: 'photos', mode },
    );
    assert.deepEqual(
      normalizeRecipeApiRequestBody('/v1/recipes/revision-1/correct', {
        correctionNote: 'Adjust this recipe',
        mode,
      }),
      { correctionNote: 'Adjust this recipe', mode },
    );
  }
});

test('every scan and correction request serializes a supported mode', () => {
  for (const mode of [undefined, null, '', 'Budget', 'Restaurant Copy', 'anything else']) {
    for (const path of ['/v1/scans', '/v1/recipes/revision-1/correct']) {
      const body = normalizeRecipeApiRequestBody(path, { mode }) as { mode: unknown };
      assert.ok(CURRENT_RECIPE_MODES.includes(body.mode as never));
    }
  }
});
