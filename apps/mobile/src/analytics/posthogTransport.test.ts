import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { sendToPostHog } from './posthogTransport';

const input = {
  event: 'app_opened' as const,
  distinctId: '8a41e1e0-1aa3-4b6e-8d03-8d2c6d1132ad',
  properties: { environment: 'development', platform: 'ios', email: 'private@example.com', photo: 'private-photo' },
};
const config = { posthogKey: 'public-test-key', posthogHost: 'https://us.i.posthog.com' };

test('capture sends an explicit safe event to the configured US host', async () => {
  let requestedUrl = '';
  let requestBody = '';
  const sent = await sendToPostHog(input, {
    enabled: true,
    config,
    fetchImpl: async (url, init) => {
      requestedUrl = url;
      requestBody = String(init.body);
      return { ok: true };
    },
  });
  assert.equal(sent, true);
  assert.equal(requestedUrl, 'https://us.i.posthog.com/capture/');
  const payload = JSON.parse(requestBody);
  assert.equal(payload.event, 'app_opened');
  assert.deepEqual(payload.properties, {
    environment: 'development', platform: 'ios', distinct_id: input.distinctId,
    $process_person_profile: false, $ip: 0,
  });
  assert.doesNotMatch(requestBody, /private@example|private-photo/);
});

test('disabled analytics does not make a network request', async () => {
  let calls = 0;
  const sent = await sendToPostHog(input, { enabled: false, config, fetchImpl: async () => { calls += 1; return { ok: true }; } });
  assert.equal(sent, false);
  assert.equal(calls, 0);
});

test('PostHog rejection and offline network failures are dropped without throwing', async () => {
  assert.equal(await sendToPostHog(input, { enabled: true, config, fetchImpl: async () => ({ ok: false }) }), false);
  assert.equal(await sendToPostHog(input, { enabled: true, config, fetchImpl: async () => { throw new TypeError('offline'); } }), false);
});

test('transport source has no logging, retry queue, or automatic capture integration', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(resolve(process.cwd(), 'src/analytics/posthogTransport.ts'), 'utf8');
  assert.doesNotMatch(source, /console\.(log|info|warn|error)|session_id|\$session_id|posthog-js|posthog-react-native/i);
  assert.match(source, /catch \{/);
});
