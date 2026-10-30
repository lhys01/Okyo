import assert from 'node:assert/strict';
import test from 'node:test';

import { createHealthGoal } from './onboardingGoal';
import { getHealthGoalSummary, initialHealthDraft } from './healthBranch';

test('a completed five-meal plan keeps its weekly count and two-week duration on Home', () => {
  const summary = getHealthGoalSummary({
    ...initialHealthDraft,
    branchCompleted: true,
    goalTargetCount: 5,
    goalDurationWeeks: 2,
    goal: createHealthGoal('Build 5 balanced meals', 5, 14, '2026-10-16', 'meals_per_week'),
  });
  assert.deepEqual(summary, { title: 'Build 5 balanced meals', detail: '5 meals per week · 2 weeks' });
});

test('an unfinished health branch does not publish a Home goal summary', () => {
  const draft = {
    ...initialHealthDraft,
    goalTargetCount: 5,
    goalDurationWeeks: 2,
    goal: createHealthGoal('Build 5 balanced meals', 5, 14, '2026-10-16', 'meals_per_week'),
  };
  assert.equal(getHealthGoalSummary(draft), null);
});
