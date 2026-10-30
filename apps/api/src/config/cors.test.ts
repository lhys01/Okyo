import assert from 'node:assert/strict';
import test from 'node:test';

import { isCorsOriginAllowed, readConfiguredOrigins } from './cors.js';

test('CORS production allowlist accepts only exact configured browser origins and native requests', () => {
  const previous = { environment: process.env.NODE_ENV, origins: process.env.CORS_ALLOWED_ORIGINS };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ALLOWED_ORIGINS = 'https://app.okyo.example, https://admin.okyo.example';
  try {
    assert.equal(isCorsOriginAllowed(undefined), true, 'native clients have no Origin header');
    assert.equal(isCorsOriginAllowed('https://app.okyo.example'), true);
    assert.equal(isCorsOriginAllowed('https://app.okyo.example.evil.test'), false);
    assert.equal(isCorsOriginAllowed('http://app.okyo.example'), false);
    assert.equal(isCorsOriginAllowed('null'), false);
  } finally {
    if (previous.environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.environment;
    if (previous.origins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previous.origins;
  }
});

test('CORS production fails closed for browser origins without a valid allowlist', () => {
  const previous = { environment: process.env.NODE_ENV, origins: process.env.CORS_ALLOWED_ORIGINS };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ALLOWED_ORIGINS = 'https://okyo.example/path, http://, not-a-url';
  try {
    assert.deepEqual([...readConfiguredOrigins()], []);
    assert.equal(isCorsOriginAllowed('https://app.okyo.example'), false);
  } finally {
    if (previous.environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.environment;
    if (previous.origins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previous.origins;
  }
});
