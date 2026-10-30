import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CORRECTION_FAILURE_MESSAGE,
  checkAccountDeletionSession,
  correctScanRecipe,
  createMockScan,
  createTextRecipe,
  deleteAuthenticatedAccount,
  getAuthenticatedLibrary,
  getAccountCapabilities,
  normalizeRecipeApiRequestBody,
  parseApiResponse,
  setOptionalAuthTokenProvider,
} from './client';
import { CURRENT_RECIPE_MODES } from '../utils/recipeModes';

test('account session preflight verifies bearer auth without issuing a deletion', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; bearer: boolean; cache: RequestCache | undefined; noCache: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      bearer: String(new Headers(init?.headers).get('Authorization')).startsWith('Bearer '),
      cache: init?.cache,
      noCache: new Headers(init?.headers).get('Cache-Control'),
    });
    return new Response(JSON.stringify({ ok: true, data: { authenticated: true } }), { status: 200 });
  };
  try {
    await checkAccountDeletionSession('test-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests.length, 1);
  assert.match(requests[0]!.url, /\/v1\/account\/session$/);
  assert.equal(requests[0]!.method, 'GET');
  assert.equal(requests[0]!.bearer, true);
  assert.equal(requests[0]!.cache, 'no-store');
  assert.equal(requests[0]!.noCache, 'no-cache');
});

test('account deletion returns explicit Apple manual-revocation status after server confirmation', async () => {
  const originalFetch = globalThis.fetch;
  let method = '';
  globalThis.fetch = async (_input, init) => {
    method = init?.method ?? '';
    return new Response(JSON.stringify({ ok: true, data: { deleted: true, appleAuthorizationRevocation: 'manual_action_required' } }), { status: 200 });
  };
  try {
    assert.deepEqual(await deleteAuthenticatedAccount('test-token'), { appleAuthorizationRevocation: 'manual_action_required' });
    assert.equal(method, 'DELETE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('account deletion preserves only safe request diagnostics from API failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    error: {
      code: 'account_deletion_failed',
      message: 'Safe failure',
      details: { requestId: 'request-id-123', failureStep: 'server_data_cleanup' },
    },
  }), { status: 502 });
  try {
    await assert.rejects(deleteAuthenticatedAccount('test-token'), (error: unknown) =>
      Boolean(error && typeof error === 'object' && 'status' in error && error.status === 502 &&
        'details' in error && JSON.stringify(error.details) === JSON.stringify({ requestId: 'request-id-123', failureStep: 'server_data_cleanup' })));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a legacy 304 from the authenticated session check is not treated as an expired session', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 304 });
  try {
    await assert.doesNotReject(checkAccountDeletionSession('test-token'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('account session preflight stops before deletion when server authentication is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    methods.push(init?.method ?? 'GET');
    return new Response(JSON.stringify({ ok: false, error: { code: 'authentication_unavailable' } }), { status: 503 });
  };
  try {
    await assert.rejects(checkAccountDeletionSession('test-token'), (error: unknown) =>
      Boolean(error && typeof error === 'object' && 'status' in error && error.status === 503 && 'code' in error && error.code === 'authentication_unavailable'));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(methods, ['GET']);
});

test('API envelope parsing rejects HTML and malformed JSON without exposing parser errors', () => {
  assert.equal(parseApiResponse('<html>Not found</html>'), null);
  assert.equal(parseApiResponse('{not-json'), null);
  assert.equal(parseApiResponse(JSON.stringify({ ok: true })), null);
});

test('authenticated library requests send the Clerk session as a bearer token', async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders: HeadersInit | undefined;
  let requestMethod: string | undefined;
  globalThis.fetch = async (_input, init) => {
    requestHeaders = init?.headers;
    requestMethod = init?.method;
    return new Response(JSON.stringify({ ok: true, data: { recipes: [] } }), { status: 200 });
  };

  try {
    const result = await getAuthenticatedLibrary('clerk-session-token');
    assert.deepEqual(result, { recipes: [] });
    assert.equal(new Headers(requestHeaders).get('authorization'), 'Bearer clerk-session-token');
    assert.equal(requestMethod, 'GET');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('authenticated library requests fail closed when no Clerk token is available', async () => {
  await assert.rejects(
    getAuthenticatedLibrary(''),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'authentication_required',
  );
});

test('guest scan requests continue without a Clerk authorization header', async () => {
  const originalFetch = globalThis.fetch;
  let authorization: string | null = null;
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ ok: true, data: { status: 'success' } }), { status: 200 });
  };

  try {
    setOptionalAuthTokenProvider(null);
    await createMockScan({ source: 'camera', mode: 'Normal' });
    assert.equal(authorization, null);
  } finally {
    setOptionalAuthTokenProvider(null);
    globalThis.fetch = originalFetch;
  }
});

test('scan requests keep a safe request ID available for Development API correlation', async () => {
  const originalFetch = globalThis.fetch;
  let requestId: string | null = null;
  globalThis.fetch = async (_input, init) => {
    requestId = new Headers(init?.headers).get('x-okyo-request-id');
    return new Response(JSON.stringify({ ok: true, data: { status: 'success', source: 'photos' } }), { status: 201 });
  };
  try {
    await createMockScan(
      { source: 'photos', mode: 'Normal' },
      { requestId: 'scan-photos-safe-123', idempotencyKey: 'scan-photos-safe-123' },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requestId, 'scan-photos-safe-123');
});

test('signed-in scan attaches only a provider-supplied Clerk token without requiring sign-in for guests', async () => {
  const originalFetch = globalThis.fetch;
  let authorization: string | null = null;
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ ok: true, data: { status: 'success' } }), { status: 200 });
  };
  try {
    setOptionalAuthTokenProvider(async () => 'session.jwt_token');
    await createMockScan({ source: 'camera', mode: 'Normal' });
    assert.equal(authorization, 'Bearer session.jwt_token');
    setOptionalAuthTokenProvider(async () => 'token\r\nInjected: yes');
    await createMockScan({ source: 'camera', mode: 'Normal' });
    assert.equal(authorization, null);
    setOptionalAuthTokenProvider(async () => { throw new Error('session refresh unavailable'); });
    await createMockScan({ source: 'camera', mode: 'Normal' });
    assert.equal(authorization, null);
  } finally {
    setOptionalAuthTokenProvider(null);
    globalThis.fetch = originalFetch;
  }
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

test('createMockScan forwards cancellation to the active fetch request', async () => {
  const originalFetch = globalThis.fetch;
  const cancellation = new AbortController();
  let requestSignal: AbortSignal | undefined;
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    requestSignal = init?.signal as AbortSignal;
    requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });

  try {
    const request = createMockScan(
      { source: 'photos', mode: 'Normal' },
      { idempotencyKey: 'scan-session-1', signal: cancellation.signal },
    );
    assert.ok(requestSignal);
    assert.equal(requestSignal.aborted, false);

    cancellation.abort();

    assert.equal(requestSignal.aborted, true);
    await assert.rejects(request, (error: unknown) => error instanceof DOMException && error.name === 'AbortError');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recipe correction forwards cancellation to the active fetch request', async () => {
  const originalFetch = globalThis.fetch;
  const cancellation = new AbortController();
  let requestSignal: AbortSignal | undefined;
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    requestSignal = init?.signal as AbortSignal;
    requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });

  try {
    const request = correctScanRecipe('source-revision-1', {
      correctionNote: 'Make the recipe healthier',
      expectedSourceRecipeId: 'source-revision-1',
      mode: 'Normal',
    }, cancellation.signal);
    assert.ok(requestSignal);
    cancellation.abort();
    assert.equal(requestSignal.aborted, true);
    await assert.rejects(request);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('scan uploads omit local paths, original filenames, and original file sizes', () => {
  const request = normalizeRecipeApiRequestBody('/v1/scans', {
    source: 'photos',
    mode: 'Normal',
    image: {
      uri: 'file:///private/var/mobile/Media/DCIM/IMG_1234.HEIC',
      fileName: 'birthday-at-home.jpg',
      sizeBytes: 8_000_000,
      dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
      dataUrlSizeBytes: 27,
      mimeType: 'image/jpeg',
      width: 1280,
      height: 960,
      source: 'photos',
    },
  }) as { image: Record<string, unknown> };

  assert.deepEqual(request.image, {
    dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
    dataUrlSizeBytes: 27,
    mimeType: 'image/jpeg',
    width: 1280,
    height: 960,
    source: 'photos',
  });
});

test('admin capabilities require a session and fail closed for malformed server flags', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer verified-session');
    return new Response(JSON.stringify({ ok: true, data: { canManageOnboardingExperiments: 'true' } }), { status: 200 });
  };
  try {
    await assert.rejects(getAccountCapabilities(''));
    await assert.rejects(getAccountCapabilities('token\r\nInjected: yes'));
    assert.equal(calls, 0);
    assert.deepEqual(await getAccountCapabilities('verified-session'), { canManageOnboardingExperiments: false });
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: { canManageOnboardingExperiments: true } }), { status: 200 });
    assert.deepEqual(await getAccountCapabilities('verified-session'), { canManageOnboardingExperiments: true });
    globalThis.fetch = async () => new Response('{"ok":false}', { status: 401 });
    await assert.rejects(getAccountCapabilities('expired-session'));
  } finally { globalThis.fetch = original; }
});
