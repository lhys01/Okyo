import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import { createOptionalAuthenticatedUser, createRequireAuthenticatedUser, requireAiUser } from './requireAuthenticatedUser.js';
import { areAuthorizedPartiesValid } from '../services/accountDeletion.js';
import { getRequestContext, runWithRequestContext } from '../observability/requestContext.js';

function harness(authorization?: string) {
  const result: { status?: number; body?: unknown; userId?: string; next?: boolean } = {};
  const request = { get: (name: string) => name.toLowerCase() === 'authorization' ? authorization : undefined } as Request;
  const response = {
    locals: {},
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  const next = () => { result.next = true; result.userId = response.locals.authenticatedUserId; };
  return { request, response, next, result };
}

test('authenticated user middleware derives identity from the verified session token', async () => {
  const previous = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'sk_test_only';
  try {
    const middleware = createRequireAuthenticatedUser(async (token, options) => {
      assert.equal(token, 'session-token');
      assert.equal(options.secretKey, 'sk_test_only');
      return { sub: 'user_123ABC' };
    });
    const h = harness('Bearer session-token');
    await middleware(h.request, h.response, h.next as never);
    assert.equal(h.result.next, true);
    assert.equal(h.result.userId, 'user_123ABC');
  } finally {
    if (previous === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previous;
  }
});

test('middleware rejects missing credentials and invalid verified identities', async () => {
  const previous = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'sk_test_only';
  try {
    const missing = harness();
    await createRequireAuthenticatedUser()(missing.request, missing.response, missing.next as never);
    assert.equal(missing.result.status, 401);

    const invalid = harness('Bearer session-token');
    await createRequireAuthenticatedUser(async () => ({ sub: 'attacker-chosen-id' }))(
      invalid.request, invalid.response, invalid.next as never,
    );
    assert.equal(invalid.result.status, 401);
    assert.equal(invalid.result.next, undefined);

    const expired = harness('Bearer expired-session-token');
    await createRequireAuthenticatedUser(async () => {
      throw new Error('signature expired');
    })(expired.request, expired.response, expired.next as never);
    assert.equal(expired.result.status, 401);
    assert.equal(expired.result.next, undefined);
  } finally {
    if (previous === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previous;
  }
});

test('production Clerk authorized parties must be explicit and valid', async () => {
  assert.equal(areAuthorizedPartiesValid([]), false);
  assert.equal(areAuthorizedPartiesValid(['*']), false);
  assert.equal(areAuthorizedPartiesValid(['http://app.example.invalid']), false);
  assert.equal(areAuthorizedPartiesValid(['https://app.example.invalid']), true);
  assert.equal(areAuthorizedPartiesValid(['okyo://callback']), true);

  const previous = {
    nodeEnv: process.env.NODE_ENV,
    secret: process.env.CLERK_SECRET_KEY,
    parties: process.env.CLERK_AUTHORIZED_PARTIES,
  };
  process.env.NODE_ENV = 'production';
  process.env.CLERK_SECRET_KEY = 'sk_test_only';
  process.env.CLERK_AUTHORIZED_PARTIES = '*';
  try {
    const h = harness('Bearer session-token');
    await createRequireAuthenticatedUser(async () => ({ sub: 'user_123ABC' }))(
      h.request, h.response, h.next as never,
    );
    assert.equal(h.result.status, 503);
    assert.equal(h.result.next, undefined);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.secret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previous.secret;
    if (previous.parties === undefined) delete process.env.CLERK_AUTHORIZED_PARTIES;
    else process.env.CLERK_AUTHORIZED_PARTIES = previous.parties;
  }
});

test('production authentication rejects a development Clerk secret even with valid parties', async () => {
  const previous = { nodeEnv: process.env.NODE_ENV, secret: process.env.CLERK_SECRET_KEY, parties: process.env.CLERK_AUTHORIZED_PARTIES };
  process.env.NODE_ENV = 'production';
  process.env.CLERK_SECRET_KEY = 'sk_test_only';
  process.env.CLERK_AUTHORIZED_PARTIES = 'https://app.example.invalid';
  try {
    const h = harness('Bearer session-token');
    await createRequireAuthenticatedUser(async () => ({ sub: 'user_123ABC' }))(
      h.request, h.response, h.next as never,
    );
    assert.equal(h.result.status, 503);
    assert.equal(h.result.next, undefined);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.secret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previous.secret;
    if (previous.parties === undefined) delete process.env.CLERK_AUTHORIZED_PARTIES;
    else process.env.CLERK_AUTHORIZED_PARTIES = previous.parties;
  }
});

test('optional AI identity keeps guests anonymous and uses only a verified Clerk subject', async () => {
  const previous = { secret: process.env.CLERK_SECRET_KEY, nodeEnv: process.env.NODE_ENV };
  process.env.CLERK_SECRET_KEY = 'sk_test_only';
  process.env.NODE_ENV = 'test';
  try {
    let verifies = 0;
    const middleware = createOptionalAuthenticatedUser(async () => {
      verifies++;
      return { sub: 'user_abc123' };
    });
    const guest = harness();
    await runWithRequestContext({ requestId: 'guest-test', anonId: null, ownerKey: 'guest:127.0.0.1' }, async () => {
      await middleware(guest.request, guest.response, guest.next as never);
      assert.equal(getRequestContext()?.ownerKey, 'guest:127.0.0.1');
    });
    assert.equal(guest.result.next, true);
    assert.equal(verifies, 0);

    const signedIn = harness('Bearer valid-session');
    await runWithRequestContext({ requestId: 'user-test', anonId: null, ownerKey: 'guest:127.0.0.1' }, async () => {
      await middleware(signedIn.request, signedIn.response, signedIn.next as never);
      assert.equal(getRequestContext()?.ownerKey, 'user:user_abc123');
    });
    assert.equal(signedIn.result.next, true);
    assert.equal(signedIn.result.userId, 'user_abc123');
  } finally {
    if (previous.secret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previous.secret;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
  }
});

test('production AI rejects guests, malformed tokens, and unavailable authentication', async () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = 'production';
  try {
    for (const authorization of [undefined, '', 'Bearer bad token', 'Basic untrusted']) {
      const h = harness(authorization);
      await requireAiUser(h.request, h.response, h.next as never);
      assert.equal(h.result.status, 401);
      assert.equal(h.result.next, undefined);
    }
    process.env.CLERK_SECRET_KEY = '';
    const unavailable = harness('Bearer session-token');
    await requireAiUser(unavailable.request, unavailable.response, unavailable.next as never);
    assert.equal(unavailable.result.status, 503);
    assert.equal(unavailable.result.next, undefined);
  } finally { process.env = saved; }
});

test('local development still supports guest AI requests', async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const h = harness();
    await requireAiUser(h.request, h.response, h.next as never);
    assert.equal(h.result.next, true);
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});
