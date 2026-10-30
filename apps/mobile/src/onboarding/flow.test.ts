import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canGoBack, clampStepToAnswers, isOnboardingStep, isTransientStep,
  nextStep, previousStep, resumeStep, showsProgress, stepPercent,
} from './flow';
import type { OnboardingAnswers } from './types';

const FULL: OnboardingAnswers = {
  problem: 'less_effort',
  followUp: { kind: 'friction', value: 'less_cleanup' },
  guidance: 'light',
};

test('walks the spine forward in order', () => {
  assert.equal(nextStep('intro'), 'overview');
  assert.equal(nextStep('overview'), 'problem');
  assert.equal(nextStep('problem'), 'followUp');
  assert.equal(nextStep('followUp'), 'guidance');
  assert.equal(nextStep('guidance'), 'diet');
  assert.equal(nextStep('diet'), 'setup');
  assert.equal(nextStep('setup'), 'example');
  assert.equal(nextStep('example'), 'scanEntry');
});

test('does not advance past the last step', () => {
  assert.equal(nextStep('paywall'), 'paywall');
});

test('walks backward through the questions', () => {
  assert.equal(previousStep('followUp'), 'problem');
  assert.equal(previousStep('guidance'), 'followUp');
  assert.equal(previousStep('diet'), 'guidance');
  assert.equal(previousStep('intro'), 'intro');
});

test('back from a transient step returns to scan entry, never into analysis', () => {
  assert.equal(previousStep('analyzing'), 'scanEntry');
  assert.equal(previousStep('result'), 'scanEntry');
  assert.equal(previousStep('paywall'), 'scanEntry');
});

test('intro and transient steps have no back action', () => {
  assert.equal(canGoBack('intro'), false);
  assert.equal(canGoBack('problem'), true);
  assert.equal(canGoBack('analyzing'), false);
  assert.equal(canGoBack('result'), false);
});

test('resume never lands in analysis, result or paywall', () => {
  for (const step of ['analyzing', 'result', 'paywall'] as const) {
    assert.equal(isTransientStep(step), true);
    assert.equal(resumeStep(step), 'scanEntry');
  }
});

test('resume falls back to intro for unknown or missing steps', () => {
  assert.equal(resumeStep(null), 'intro');
  assert.equal(resumeStep(undefined), 'intro');
  assert.equal(resumeStep('nonsense' as never), 'intro');
});

test('resume preserves a normal question step', () => {
  assert.equal(resumeStep('diet'), 'diet');
});

test('progress percentages match the approved designs', () => {
  assert.equal(stepPercent('intro'), 12);
  assert.equal(stepPercent('problem'), 37);
  assert.equal(stepPercent('followUp'), 50);
  assert.equal(stepPercent('guidance'), 62);
  assert.equal(stepPercent('diet'), 75);
  assert.equal(stepPercent('setup'), 87);
  assert.equal(stepPercent('example'), 100);
});

test('progress bar hidden on analysis and handoff screens', () => {
  assert.equal(showsProgress('diet'), true);
  assert.equal(showsProgress('analyzing'), false);
  assert.equal(showsProgress('paywall'), false);
});

test('step guard recognises only real steps', () => {
  assert.equal(isOnboardingStep('diet'), true);
  assert.equal(isOnboardingStep('weeklyGoal'), false);
  assert.equal(isOnboardingStep(7), false);
});

test('clamps a restored step back to what the answers support', () => {
  // Claims to be at setup but never answered the problem.
  assert.equal(clampStepToAnswers('setup', {}), 'problem');
  // Answered the problem only.
  assert.equal(clampStepToAnswers('setup', { problem: 'save_time' }), 'followUp');
  // Fully answered — stays put.
  assert.equal(clampStepToAnswers('setup', FULL), 'setup');
});

test('clamping a transient step rewinds and then validates', () => {
  assert.equal(clampStepToAnswers('analyzing', {}), 'problem');
  assert.equal(clampStepToAnswers('analyzing', FULL), 'scanEntry');
});
