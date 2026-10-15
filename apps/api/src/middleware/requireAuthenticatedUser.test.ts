import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { createRequireAuthenticatedUser } from './requireAuthenticatedUser.js';

test('Railway Development authenticates a Development Clerk session when NODE_ENV is production', async () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'development';
  process.env.CLERK_SECRET_KEY = 'sk_test_fixture';
  try {
    let status: number | undefined;
    let nextCalled = false;
    const response = {
      locals: {},
      status: (nextStatus: number) => {
        status = nextStatus;
        return response;
      },
      json: () => response,
    };
    const request = { get: (header: string) => header === 'authorization' ? 'Bearer development-session-token' : undefined };
    const middleware = createRequireAuthenticatedUser(async () => ({ sub: 'user_123ABC' }));

    await middleware(request as Request, response as unknown as Response, (() => { nextCalled = true; }) as NextFunction);

    assert.equal(status, undefined);
    assert.equal(nextCalled, true);
    assert.equal((response.locals as Record<string, unknown>).authenticatedUserId, 'user_123ABC');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
