import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { accountDeletionFailure } from './accountDeletionFeedback';

test('Development deletion service outage is identified without claiming success', () => {
  const result = accountDeletionFailure({ status: 503, code: 'account_deletion_unavailable' });
  assert.equal(result.title, 'Account deletion is unavailable');
  assert.equal(result.canRetry, true);
  assert.match(result.message, /not confirmed deleted/);
});

test('server authentication configuration outage is not mislabeled as an expired session', () => {
  const result = accountDeletionFailure({ status: 503, code: 'authentication_unavailable' });
  assert.equal(result.title, 'Account deletion is unavailable');
  assert.equal(result.canRetry, true);
});

test('expired or invalid session requires signing in again before retry', () => {
  for (const error of [{ status: 401, code: 'authentication_required' }, { status: 401, code: 'invalid_token' }]) {
    const result = accountDeletionFailure(error);
    assert.equal(result.title, 'Sign in again');
    assert.equal(result.canRetry, false);
  }
});

test('timeout and failed server response never imply the account was deleted', () => {
  const timeout = accountDeletionFailure({ status: 0, code: 'network_or_parse_failure' });
  assert.match(timeout.title, /uncertain/);
  assert.match(timeout.message, /may still be active/);
  const server = accountDeletionFailure({ status: 502, code: 'account_deletion_failed' });
  assert.match(server.message, /may still be active/);
  assert.doesNotMatch(server.message, /session has expired/i);
  assert.equal(server.canRetry, true);
});

test('provider error text, tokens, and personal data never enter deletion feedback', () => {
  const privateMarker = 'private-marker';
  const result = accountDeletionFailure({ status: 502, code: 'account_deletion_failed', message: privateMarker, token: privateMarker });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(privateMarker));
});

test('screen retains two confirmations, single-flight guard, and no false success on API failure', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/PrivacyDataScreen.tsx'), 'utf8');
  assert.match(source, /deletingAccountRef\.current/);
  assert.match(source, /'This cannot be undone'/);
  assert.match(source, /'Delete account', style: 'destructive'/);
  assert.match(source, /const deletion = await deleteAuthenticatedAccount\(token\);\s*accountDeleted = true/);
  assert.match(source, /accountDeletionFailure\(caught\)/);
  assert.match(source, /failure\.canRetry \? \[\{ text: 'Retry', onPress: confirmAccountDeletion/);
  assert.match(source, /cleanupDeletedAccountDeviceData\(\)/);
  assert.match(source, /await deleteAuthenticatedAccount\(token\)/);
  assert.match(source, /manual_action_required/);
  assert.match(source, /'Retry device cleanup', onPress: \(\) => void retryDeviceCleanup\(\)/);
});
