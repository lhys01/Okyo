import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyClerkPublishableKey, getSafeClerkErrorDiagnostics } from './clerkDiagnostics';

test('classifies development and production publishable keys without exposing them', () => {
  assert.equal(classifyClerkPublishableKey('pk_test_redacted'), 'development');
  assert.equal(classifyClerkPublishableKey('pk_live_redacted'), 'production');
  assert.equal(classifyClerkPublishableKey(''), 'unknown');
});

test('extracts only a sanitized nested Clerk API error code and status', () => {
  assert.deepEqual(
    getSafeClerkErrorDiagnostics({
      status: 400,
      errors: [{ code: 'strategy_not_enabled', message: 'private detail' }],
    }),
    { httpStatus: 400, code: 'strategy_not_enabled', category: 'api_error' },
  );
});

test('prefers a specific nested Clerk error code over the SDK wrapper code', () => {
  assert.deepEqual(
    getSafeClerkErrorDiagnostics({
      code: 'api_response_error',
      response: { status: 400, data: { errors: [{ code: 'redirect_url_not_allowed', message: 'private detail' }] } },
    }),
    { httpStatus: 400, code: 'redirect_url_not_allowed', category: 'api_error' },
  );
});

test('preserves the sanitized single-session conflict code for Development diagnosis', () => {
  assert.deepEqual(
    getSafeClerkErrorDiagnostics({
      status: 400,
      errors: [{ code: 'session_exists', message: 'private session details' }],
    }),
    { httpStatus: 400, code: 'session_exists', category: 'api_error' },
  );
});

test('never returns raw error text, tokens, or unsafe codes', () => {
  const diagnostics = getSafeClerkErrorDiagnostics({
    status: 400,
    errors: [{ code: 'bad code with spaces', message: 'authorization_code=private-value' }],
  });

  assert.deepEqual(diagnostics, { httpStatus: 400, code: 'unknown', category: 'api_error' });
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|authorization|spaces/);
});

test('extracts only safe Clerk metadata for an invalid native Apple strategy', () => {
  assert.deepEqual(getSafeClerkErrorDiagnostics({
    status: 422,
    clerkTraceId: '777f5f0e06c55bd36238dc3c2b522145',
    errors: [{ code: 'form_param_value_invalid', message: 'private Apple credential', meta: { paramName: 'strategy', sessionId: 'private' } }],
  }), {
    httpStatus: 422,
    code: 'form_param_value_invalid',
    category: 'api_error',
    rejectedParameter: 'strategy',
    requestId: '777f5f0e06c55bd36238dc3c2b522145',
  });
});

test('never echoes an unrecognized parameter or a credential-shaped trace field', () => {
  const diagnostics = getSafeClerkErrorDiagnostics({
    status: 422,
    errors: [{ code: 'form_param_value_invalid', meta: { param_name: 'private_credential', trace_id: 'identity-token-value' } }],
  });
  assert.equal(diagnostics.rejectedParameter, undefined);
  assert.equal(diagnostics.requestId, undefined);
});
