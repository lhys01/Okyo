import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { scanRateLimitMiddleware } from './costControls.js';

test('persistent quota work leaves the existing per-IP scan limiter active', () => {
  const previousMax = process.env.SCAN_RATE_LIMIT_MAX;
  const previousWindow = process.env.SCAN_RATE_LIMIT_WINDOW_MS;
  process.env.SCAN_RATE_LIMIT_MAX = '1';
  process.env.SCAN_RATE_LIMIT_WINDOW_MS = '60000';

  const request = {
    ip: '203.0.113.246',
    socket: {},
    scanContext: Object.freeze({
      requestId: 'scan-rate-limit-test',
      ingressStartedAt: Date.now(),
    }),
  } as Request;
  let nextCalls = 0;
  let status: number | undefined;
  let payload: unknown;
  const response = {
    status(value: number) {
      status = value;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  const next = (() => { nextCalls += 1; }) as NextFunction;

  try {
    scanRateLimitMiddleware(request, response, next);
    scanRateLimitMiddleware(request, response, next);
    assert.equal(nextCalls, 1);
    assert.equal(status, 429);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many scan requests. Please wait a moment before trying again.',
      },
    });
  } finally {
    restoreEnv('SCAN_RATE_LIMIT_MAX', previousMax);
    restoreEnv('SCAN_RATE_LIMIT_WINDOW_MS', previousWindow);
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
