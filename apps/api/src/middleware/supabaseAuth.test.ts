import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import {
  AccessTokenVerificationError,
  type AccessTokenVerifier,
} from '../auth/verifier.js';
import { mountV1Authentication } from './supabaseAuth.js';

const verifiedUserId = '162b7af3-e489-4cc9-8f11-09913a4b142a';

test('/health succeeds without authentication and bypasses the verifier', async () => {
  let verifierCalls = 0;
  const app = createTestApp({
    async verify() {
      verifierCalls += 1;
      throw new Error('should not run');
    },
  });

  const response = await request(app).get('/health').expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(verifierCalls, 0);
});

test('the /v1 boundary rejects a missing Authorization header', async () => {
  const response = await request(createTestApp(validVerifier()))
    .post('/v1/probe')
    .expect(401);
  assert.equal(response.body.error.code, 'authentication_required');
});

test('the /v1 boundary rejects malformed Bearer authorization', async () => {
  const response = await request(createTestApp(validVerifier()))
    .post('/v1/probe')
    .set('Authorization', 'Basic definitely-not-bearer')
    .expect(401);
  assert.equal(response.body.error.code, 'authentication_required');
});

test('an invalid verified token is rejected with a sanitized response', async () => {
  const verifier: AccessTokenVerifier = {
    async verify() {
      throw new AccessTokenVerificationError('invalid_token');
    },
  };
  const response = await request(createTestApp(verifier))
    .post('/v1/probe')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: 'invalid_auth_token',
      message: 'A valid authenticated session is required.',
    },
  });
});

test('a valid verified token reaches the route with trusted auth context', async () => {
  const response = await request(createTestApp(validVerifier()))
    .post('/v1/probe')
    .set('Authorization', 'Bearer valid-token')
    .expect(200);
  assert.equal(response.body.userId, verifiedUserId);
});

test('a client-supplied user ID cannot override the verified user ID', async () => {
  const response = await request(createTestApp(validVerifier()))
    .post('/v1/probe')
    .set('Authorization', 'Bearer valid-token')
    .send({ userId: '00000000-0000-4000-8000-000000000000' })
    .expect(200);
  assert.equal(response.body.userId, verifiedUserId);
});

test('verifier infrastructure failures return a sanitized 503', async () => {
  const verifier: AccessTokenVerifier = {
    async verify() {
      throw new AccessTokenVerificationError('verifier_unavailable');
    },
  };
  const response = await request(createTestApp(verifier))
    .post('/v1/probe')
    .set('Authorization', 'Bearer valid-looking-token')
    .expect(503);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: 'auth_verifier_unavailable',
      message: 'Authentication is temporarily unavailable.',
    },
  });
});

test('logs contain neither tokens nor authorization-header values', async () => {
  const logged: unknown[] = [];
  const secretToken = 'token-that-must-never-appear';
  const verifier: AccessTokenVerifier = {
    async verify() {
      throw new AccessTokenVerificationError('invalid_token');
    },
  };
  const app = createTestApp(verifier, {
    warn(event, context) {
      logged.push(event, context);
    },
  });

  await request(app)
    .post('/v1/probe?authorization=also-not-logged')
    .set('Authorization', `Bearer ${secretToken}`)
    .expect(401);

  const serialized = JSON.stringify(logged);
  assert.equal(serialized.includes(secretToken), false);
  assert.equal(serialized.includes('also-not-logged'), false);
  assert.equal(serialized.toLowerCase().includes('authorization'), false);
});

function createTestApp(
  verifier: AccessTokenVerifier,
  logger?: { warn(event: string, context: { category: string; route: string; status: number }): void },
) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_request, response) => response.json({ ok: true }));
  mountV1Authentication(app, verifier, logger);
  app.post('/v1/probe', (incoming, response) => {
    response.json({ userId: incoming.auth?.userId });
  });
  return app;
}

function validVerifier(): AccessTokenVerifier {
  return {
    async verify() {
      return { userId: verifiedUserId };
    },
  };
}
