import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  CONSENT_LEDGER_STORAGE_KEY,
  getLatestConsent,
  hasGrantedConsent,
  readConsentLedger,
  recordConsent,
} from './consentLedger';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
  };
}

const at = (iso: string) => () => new Date(iso);

test('no consent is assumed — an unasked purpose reads as refused', async () => {
  const storage = createMemoryStorage();
  const ledger = await readConsentLedger(storage);

  assert.deepEqual(ledger, []);
  assert.equal(hasGrantedConsent(ledger, 'camera'), false);
  assert.equal(hasGrantedConsent(ledger, 'photos'), false);
  assert.equal(hasGrantedConsent(ledger, 'notifications'), false);
  assert.equal(getLatestConsent(ledger, 'camera'), null);
});

test('a recorded choice keeps the purpose, the notice version, the timestamp and the jurisdiction', async () => {
  const storage = createMemoryStorage();

  const ledger = await recordConsent('camera', 'granted', {
    noticeVersion: '2026-08-24.1',
    now: at('2026-08-24T10:00:00.000Z'),
    storage,
  });

  assert.equal(ledger.length, 1);
  assert.deepEqual(ledger[0], {
    purpose: 'camera',
    choice: 'granted',
    noticeVersion: '2026-08-24.1',
    recordedAt: '2026-08-24T10:00:00.000Z',
    jurisdiction: 'unknown',
  });
});

test('purposes are recorded separately — granting one never grants another', async () => {
  const storage = createMemoryStorage();

  await recordConsent('camera', 'granted', { now: at('2026-08-24T10:00:00.000Z'), storage });
  const ledger = await recordConsent('notifications', 'refused', { now: at('2026-08-24T10:01:00.000Z'), storage });

  assert.equal(hasGrantedConsent(ledger, 'camera'), true);
  assert.equal(hasGrantedConsent(ledger, 'notifications'), false);
  assert.equal(hasGrantedConsent(ledger, 'photos'), false, 'a purpose never asked about stays refused');
});

test('withdrawal supersedes an earlier grant, and the history is kept', async () => {
  const storage = createMemoryStorage();

  await recordConsent('notifications', 'granted', { now: at('2026-08-24T10:00:00.000Z'), storage });
  const ledger = await recordConsent('notifications', 'withdrawn', { now: at('2026-08-25T09:00:00.000Z'), storage });

  assert.equal(ledger.length, 2, 'the earlier grant must remain visible next to the withdrawal');
  assert.equal(getLatestConsent(ledger, 'notifications')?.choice, 'withdrawn');
  assert.equal(hasGrantedConsent(ledger, 'notifications'), false);
});

test('a renewed choice after a notice-version change is recorded as a new entry', async () => {
  const storage = createMemoryStorage();

  await recordConsent('photos', 'granted', { noticeVersion: '2026-08-24.1', now: at('2026-08-24T10:00:00.000Z'), storage });
  const ledger = await recordConsent('photos', 'granted', { noticeVersion: '2027-01-01.1', now: at('2027-01-02T10:00:00.000Z'), storage });

  assert.equal(ledger.length, 2);
  assert.equal(getLatestConsent(ledger, 'photos')?.noticeVersion, '2027-01-01.1');
});

test('a corrupt or hostile ledger value degrades to "no consent", never to "consented"', async () => {
  const storage = createMemoryStorage();

  storage.values.set(CONSENT_LEDGER_STORAGE_KEY, 'not json at all');
  assert.deepEqual(await readConsentLedger(storage), []);

  storage.values.set(CONSENT_LEDGER_STORAGE_KEY, JSON.stringify([{ purpose: 'camera', choice: 'granted' }]));
  assert.deepEqual(await readConsentLedger(storage), [], 'an entry missing required fields must be discarded, not trusted');
});

test('a storage failure never blocks the user from making a choice', async () => {
  const failing = {
    async getItem() { return null; },
    async setItem() { throw new Error('disk full'); },
  };

  const ledger = await recordConsent('camera', 'granted', { storage: failing });
  assert.equal(ledger.length, 1, 'the choice is still returned to the caller even when it cannot be persisted');
});

test('the ledger is cleared by "delete my data" — no record survives the user asking Okyo to forget', () => {
  const deletion = read('src/state/dietaryDeletion.ts');
  assert.match(deletion, /CONSENT_LEDGER_STORAGE_KEY/);
});

test('Okyo ships no optional tracking, so no blanket consent screen exists', () => {
  // A consent control for processing that does not happen would be theatre.
  const analytics = read('src/analytics/track.ts');
  assert.match(analytics, /const shouldLogAnalytics = false;/, 'analytics must remain non-transmitting');

  const packageJson = read('package.json');
  const forbiddenSdks = [
    'firebase', 'amplitude', 'mixpanel', 'segment', '@sentry', 'bugsnag',
    'posthog', 'appsflyer', 'adjust', 'branch-sdk', 'facebook-sdk',
    'react-native-google-mobile-ads', 'expo-tracking-transparency',
  ];
  for (const sdk of forbiddenSdks) {
    assert.doesNotMatch(
      packageJson,
      new RegExp(sdk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${sdk} would introduce optional processing that requires a real consent control — see SDK_AND_PERMISSION_CHANGE_GATE.md`,
    );
  }

  // And no consent UI pretends otherwise.
  const screens = readdirSync(resolve(process.cwd(), 'src/screens'));
  assert.ok(
    !screens.some((file) => /consent/i.test(file)),
    'no consent screen should exist while there is no optional processing to consent to',
  );
});
