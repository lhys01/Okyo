import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { createHealthGoal } from '../state/onboardingGoal';
import { healthReducer, initialHealthDraft } from '../state/healthBranch';
import { createHealthBranchPersistence } from '../state/healthBranchPersistence';

const branchScreen = readFileSync(join(__dirname, 'HealthBranchScreen.tsx'), 'utf8');
const planScreen = readFileSync(join(__dirname, 'BranchPersonalizedPlanScreen.tsx'), 'utf8');

test('Health questions hand off one durable reveal draft to the shared plan route', async () => {
  const draft = {
    ...initialHealthDraft,
    currentStep: 'solutionValue' as const,
    healthProblem: 'too_much_takeout' as const,
    healthBarrier: 'not_enough_time' as const,
    mealToImprove: 'dinner' as const,
    cookingFrequency: 'one_to_two_week' as const,
    healthDefinition: 'less_takeout' as const,
    mealPriority: 'tastes_good' as const,
    foodStyles: ['comfort_food' as const],
    flexibleCommitment: 'one_meal_daily' as const,
    healthGoal: 'one_daily' as const,
    healthGoalType: 'healthier_meals' as const,
    goalTargetCount: 1,
    goalDurationWeeks: 2,
    goal: createHealthGoal('One healthier meal each day', 1, 14),
  };
  const reveal = healthReducer(draft, { type: 'NEXT_PRESSED' });
  assert.equal(reveal.currentStep, 'reveal');
  assert.equal(reveal.branchCompleted, false);

  const values = new Map<string, string>();
  const persistence = createHealthBranchPersistence({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  });
  assert.ok(await persistence.write(reveal));
  const restored = await persistence.read();
  assert.equal(restored.currentStep, 'reveal');
  assert.equal(restored.goal?.displayTitle, draft.goal.displayTitle);
  assert.equal(healthReducer(restored, { type: 'BACK_PRESSED' }).currentStep, 'solutionValue');
  assert.match(branchScreen, /await persistDraft\(\{ \.\.\.draft, branchCompleted: false, currentStep: 'reveal' \}\)/);
  assert.match(branchScreen, /await onComplete\?\.\(\)/);
  assert.match(planScreen, /<HealthPlanSummary goal=\{plan\.draft\.goal\}/);
  assert.doesNotMatch(branchScreen, /<HealthPlanSummary/);
});

test('failed handoff can retry and rapid taps do not complete twice', () => {
  assert.match(branchScreen, /if \(completionStarted\.current\) return/);
  assert.match(branchScreen, /completionStarted\.current = true/);
  assert.match(branchScreen, /setCompletionError\(true\)/);
  assert.match(branchScreen, /completionStarted\.current = false/);
  assert.match(branchScreen, /if \(hydrated && isFinalPlan && !completionError\) void finish\(state\)/);
});
