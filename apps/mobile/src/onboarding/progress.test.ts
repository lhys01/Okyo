import assert from 'node:assert/strict';
import test from 'node:test';

import { createProgress, parseProgress, serializeProgress, ONBOARDING_PROGRESS_VERSION } from './progress';
import type { OnboardingAnswers } from './types';

const ANSWERS: OnboardingAnswers = {
  problem: 'less_effort',
  followUp: { kind: 'friction', value: 'less_cleanup' },
  guidance: 'light',
  dietPattern: 'vegetarian',
  avoid: ['dairy'],
  recipePriority: 'speed',
};
const STAMP = '2026-07-28T04:11:09.000Z';

test('round-trips a full progress record', () => {
  const raw = serializeProgress(createProgress('diet', ANSWERS, STAMP));
  const parsed = parseProgress(raw);
  assert.ok(parsed);
  assert.equal(parsed.currentStep, 'diet');
  assert.equal(parsed.version, ONBOARDING_PROGRESS_VERSION);
  assert.equal(parsed.updatedAt, STAMP);
  assert.deepEqual(parsed.answers, ANSWERS);
});

test('answers survive a backward move and re-save', () => {
  const raw = serializeProgress(createProgress('guidance', ANSWERS, STAMP));
  assert.deepEqual(parseProgress(raw)?.answers, ANSWERS);
});

test('rejects a missing or empty payload', () => {
  assert.equal(parseProgress(null), null);
  assert.equal(parseProgress(undefined), null);
  assert.equal(parseProgress(''), null);
});

test('rejects corrupt JSON instead of throwing', () => {
  assert.equal(parseProgress('{not json'), null);
  assert.equal(parseProgress('null'), null);
  assert.equal(parseProgress('"a string"'), null);
});

test('rejects a future or unknown version', () => {
  const raw = JSON.stringify({ version: 99, currentStep: 'diet', answers: {}, updatedAt: STAMP });
  assert.equal(parseProgress(raw), null);
});

test('rejects an unknown step name', () => {
  const raw = JSON.stringify({ version: 1, currentStep: 'weeklyGoal', answers: {}, updatedAt: STAMP });
  assert.equal(parseProgress(raw), null);
});

test('never restores a transient step', () => {
  for (const step of ['analyzing', 'result', 'paywall']) {
    const raw = JSON.stringify({ version: 1, currentStep: step, answers: ANSWERS, updatedAt: STAMP });
    assert.equal(parseProgress(raw)?.currentStep, 'scanEntry', `${step} must rewind`);
  }
});

test('clamps a step the stored answers cannot support', () => {
  const raw = JSON.stringify({ version: 1, currentStep: 'example', answers: {}, updatedAt: STAMP });
  assert.equal(parseProgress(raw)?.currentStep, 'problem');
});

test('strips unrecognised answer values rather than trusting them', () => {
  const raw = JSON.stringify({
    version: 1,
    currentStep: 'diet',
    answers: {
      problem: 'not_a_problem',
      guidance: 'telepathy',
      dietPattern: 'carnivore',
      avoid: ['gluten', 'shellfish'],
      recipePriority: 'free',
      followUp: { kind: 'friction', value: 'invented' },
    },
    updatedAt: STAMP,
  });
  const parsed = parseProgress(raw);
  assert.ok(parsed);
  assert.deepEqual(parsed.answers, { avoid: ['gluten'] }, 'only the valid exclusion survives');
});

test('a malformed maxMinutes value is dropped, not coerced', () => {
  const raw = JSON.stringify({
    version: 1, currentStep: 'diet',
    answers: { problem: 'save_time', followUp: { kind: 'maxMinutes', value: 22 } },
    updatedAt: STAMP,
  });
  assert.equal(parseProgress(raw)?.answers.followUp, undefined);
});

test('missing updatedAt degrades to an empty string, not a crash', () => {
  const raw = JSON.stringify({ version: 1, currentStep: 'intro', answers: {} });
  assert.equal(parseProgress(raw)?.updatedAt, '');
});
