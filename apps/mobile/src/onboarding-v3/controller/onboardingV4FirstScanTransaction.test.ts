import assert from 'node:assert/strict';
import test from 'node:test';

import { createIdempotentFirstScanTransactionRunner, FirstScanTransactionError, runOnboardingV4FirstScanTransaction } from './onboardingV4FirstScanTransaction';
import type { OnboardingV4InFlightScan } from '../state/onboardingV4ScanPersistence';

const descriptionScan: OnboardingV4InFlightScan = { scanSessionId: 'stable-session', source: 'description', mealDescription: 'Exact spicy tofu bowl', startedAt: '2026-08-13T10:00:00.000Z' };
const photoScan: OnboardingV4InFlightScan = { scanSessionId: 'stable-photo', source: 'photos', imageUri: 'file:///cached.jpg', startedAt: '2026-08-13T10:00:00.000Z' };

function harness() {
  const state = { inFlight: null as OnboardingV4InFlightScan | null, consumed: false, canonical: new Map<string, string>(), calls: [] as string[], failWrite: false, failConsume: false, failClear: false, unavailablePhoto: false, unusable: false, failCommit: false };
  const dependencies = {
    writeInFlightScan: async (scan: OnboardingV4InFlightScan) => { state.calls.push('write-in-flight'); if (state.failWrite) throw new Error('storage down'); state.inFlight = scan; },
    readFreeRecipeConsumed: async () => { state.calls.push('read-consumed'); return state.consumed; },
    writeFreeRecipeConsumed: async () => { state.calls.push('write-consumed'); if (state.failConsume) throw new Error('storage down'); state.consumed = true; },
    clearInFlightScan: async () => { state.calls.push('clear-in-flight'); if (state.failClear) throw new Error('storage down'); state.inFlight = null; },
    findCommittedRecipe: (sessionId: string) => state.canonical.get(sessionId) ?? null,
    loadInput: async (scan: OnboardingV4InFlightScan) => { state.calls.push(`load:${scan.mealDescription ?? scan.imageUri}`); if (state.unavailablePhoto) throw new Error('The selected photo is no longer available. Please choose it again.'); return scan.mealDescription ?? scan.imageUri ?? ''; },
    analyze: async (input: string) => { state.calls.push(`analyze:${input}`); return `analysis:${input}`; },
    generate: async (analysis: string) => { state.calls.push(`generate:${analysis}`); return state.unusable ? 'unusable' : 'usable'; },
    commitUsableRecipe: async (generated: string) => { state.calls.push(`commit:${generated}`); if (state.failCommit) throw new Error('commit failed'); if (generated !== 'usable') throw new Error('Recipe response was incomplete.'); const id = `recipe-${descriptionScan.scanSessionId}`; state.canonical.set(descriptionScan.scanSessionId, id); return id; },
  };
  return { state, dependencies };
}

async function expectTransactionError(run: Promise<unknown>, preserveInFlight: boolean) {
  await assert.rejects(run, (error) => error instanceof FirstScanTransactionError && error.preserveInFlight === preserveInFlight);
}

test('in-flight persistence failure prevents analysis and generation from starting', async () => {
  const { state, dependencies } = harness(); state.failWrite = true;
  await expectTransactionError(runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), false);
  assert.deepEqual(state.calls, ['write-in-flight']);
});

test('analysis success alone never writes consumption', async () => {
  const { state, dependencies } = harness(); dependencies.generate = async () => { state.calls.push('generate'); throw new Error('generation failed'); };
  await expectTransactionError(runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), false);
  assert.equal(state.consumed, false); assert.equal(state.calls.includes('write-consumed'), false); assert.equal(state.inFlight, null);
});

test('unusable generated recipe and canonical commit failure never consume', async () => {
  for (const mode of ['unusable', 'commit'] as const) {
    const { state, dependencies } = harness(); if (mode === 'unusable') state.unusable = true; else state.failCommit = true;
    await expectTransactionError(runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), false);
    assert.equal(state.consumed, false); assert.equal(state.calls.includes('write-consumed'), false); assert.equal(state.inFlight, null);
  }
});

test('consumption-write failure after commit remains recoverable and restart reuses the stable canonical recipe', async () => {
  const { state, dependencies } = harness(); state.failConsume = true;
  await expectTransactionError(runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), true);
  assert.equal(state.canonical.get(descriptionScan.scanSessionId), `recipe-${descriptionScan.scanSessionId}`); assert.deepEqual(state.inFlight, descriptionScan);
  const generationCalls = state.calls.filter((call) => call.startsWith('generate')).length;
  state.failConsume = false;
  const id = await runOnboardingV4FirstScanTransaction(descriptionScan, dependencies);
  assert.equal(id, `recipe-${descriptionScan.scanSessionId}`); assert.equal(state.consumed, true); assert.equal(state.inFlight, null);
  assert.equal(state.calls.filter((call) => call.startsWith('generate')).length, generationCalls);
});

test('successful consumption followed by clear failure resumes without granting another recipe', async () => {
  const { state, dependencies } = harness(); state.failClear = true;
  await expectTransactionError(runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), true);
  assert.equal(state.consumed, true); assert.deepEqual(state.inFlight, descriptionScan);
  const generationCalls = state.calls.filter((call) => call.startsWith('generate')).length;
  state.failClear = false;
  assert.equal(await runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), `recipe-${descriptionScan.scanSessionId}`);
  assert.equal(state.calls.filter((call) => call.startsWith('generate')).length, generationCalls);
});

test('repeated sequential resume calls are idempotent and cannot duplicate the canonical recipe', async () => {
  const { state, dependencies } = harness();
  const first = await runOnboardingV4FirstScanTransaction(descriptionScan, dependencies);
  const second = await runOnboardingV4FirstScanTransaction(descriptionScan, dependencies);
  assert.equal(first, second); assert.equal(state.canonical.size, 1); assert.equal(state.calls.filter((call) => call.startsWith('commit:')).length, 1);
});

test('concurrent duplicate resume calls share one transaction and one canonical commit', async () => {
  const { state, dependencies } = harness();
  const run = createIdempotentFirstScanTransactionRunner();
  const [first, second] = await Promise.all([run(descriptionScan, dependencies), run(descriptionScan, dependencies)]);
  assert.equal(first, second);
  assert.equal(state.calls.filter((call) => call.startsWith('generate')).length, 1);
  assert.equal(state.calls.filter((call) => call.startsWith('commit:')).length, 1);
  assert.equal(state.canonical.size, 1);
});

test('unavailable restarted photo clears the failed attempt honestly without consumption', async () => {
  const { state, dependencies } = harness(); state.unavailablePhoto = true;
  await assert.rejects(runOnboardingV4FirstScanTransaction(photoScan, dependencies), /no longer available/);
  assert.equal(state.consumed, false); assert.equal(state.inFlight, null); assert.equal(state.calls.includes('analyze'), false);
});

test('description resume sends the exact persisted description to analysis', async () => {
  const { state, dependencies } = harness();
  await runOnboardingV4FirstScanTransaction(descriptionScan, dependencies);
  assert.equal(state.calls.includes('analyze:Exact spicy tofu bowl'), true);
});

test('terminal service failures clear in-flight, while partial-success persistence failures preserve it', async () => {
  const { state, dependencies } = harness(); dependencies.analyze = async () => { throw new Error('analysis failed'); };
  await expectTransactionError(runOnboardingV4FirstScanTransaction(descriptionScan, dependencies), false);
  assert.equal(state.inFlight, null); assert.equal(state.calls.filter((call) => call === 'clear-in-flight').length, 1);
});

test('transaction has no paywall or entitlement dependency', () => {
  const keys = Object.keys(harness().dependencies).join(' ');
  assert.doesNotMatch(keys, /paywall|entitlement|purchase/i);
});
