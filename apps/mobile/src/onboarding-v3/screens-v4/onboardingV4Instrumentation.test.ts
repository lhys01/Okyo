import assert from 'node:assert/strict';
import test from 'node:test';

import {
  onboardingV4AnswerSubmittedEvent,
  onboardingV4GoalSelectedEvent,
  onboardingV4FirstRecipeRevealedEvent,
  onboardingV4InsightViewedEvent,
  onboardingV4ScreenViewedEvent,
  onboardingV4MeaningfulActionSelectedEvent,
  onboardingV4PaywallViewedEvent,
  onboardingV4PurchaseEvent,
  onboardingV4StartedEvent,
} from './onboardingV4Instrumentation';

test('onboardingV4StartedEvent always reports onboarding_started with no sensitive properties', () => {
  const event = onboardingV4StartedEvent();
  assert.equal(event.name, 'onboarding_started');
  assert.deepEqual(event.properties, { screen: 'splash' });
});

test('Step 09 recipe analytics contain only branch and selected action metadata', () => {
  assert.deepEqual(onboardingV4FirstRecipeRevealedEvent('save_money'), { name: 'first_recipe_revealed', properties: { screen: 'recipe', branch: 'save_money' } });
  assert.deepEqual(onboardingV4MeaningfulActionSelectedEvent('cook', 'hit_macros'), { name: 'meaningful_action_selected', properties: { screen: 'recipe', branch: 'hit_macros', actionType: 'cook' } });
});

test('Step 10 analytics use only taxonomy events and non-sensitive source/action metadata', () => {
  assert.deepEqual(onboardingV4PaywallViewedEvent('customize', 'eat_healthier'), { name: 'paywall_viewed', properties: { screen: 'paywall', source: 'first_recipe', branch: 'eat_healthier', actionType: 'customize' } });
  assert.deepEqual(onboardingV4PurchaseEvent('purchase_started', 'cook', 'save_money'), { name: 'purchase_started', properties: { screen: 'paywall', source: 'first_recipe', branch: 'save_money', actionType: 'cook' } });
  assert.deepEqual(onboardingV4PurchaseEvent('purchase_succeeded', 'customize', 'hit_macros'), { name: 'purchase_succeeded', properties: { screen: 'paywall', source: 'first_recipe', branch: 'hit_macros', actionType: 'customize' } });
  assert.deepEqual(onboardingV4PurchaseEvent('purchase_failed', 'cook', 'save_money', 'request_failed').properties.errorKind, 'request_failed');
  for (const event of [onboardingV4PaywallViewedEvent('customize', 'eat_healthier'), onboardingV4PurchaseEvent('purchase_restored', 'customize', 'eat_healthier')]) {
    assert.doesNotMatch(JSON.stringify(event), /less spicy|recipe text|photo|receipt|allergy|user name/i);
  }
});

test('onboardingV4ScreenViewedEvent fires once per distinct step, never for a repeat of the same step (no duplicate emissions)', () => {
  const first = onboardingV4ScreenViewedEvent('promise', null);
  assert.deepEqual(first, { name: 'onboarding_screen_viewed', properties: { screen: 'promise' } });

  const repeat = onboardingV4ScreenViewedEvent('promise', 'promise');
  assert.equal(repeat, null);

  const advanced = onboardingV4ScreenViewedEvent('primaryGoal', 'promise');
  assert.deepEqual(advanced, { name: 'onboarding_screen_viewed', properties: { screen: 'primaryGoal' } });
});

test('onboardingV4GoalSelectedEvent reports the goal as the branch property only, for all four goals', () => {
  for (const goal of ['save_money', 'eat_healthier', 'hit_macros', 'not_sure'] as const) {
    const event = onboardingV4GoalSelectedEvent(goal);
    assert.equal(event.name, 'primary_goal_selected');
    assert.deepEqual(event.properties, { branch: goal });
  }
});

test('onboardingV4AnswerSubmittedEvent reports only the field name (actionType) and step (screen) — never the answer value', () => {
  const event = onboardingV4AnswerSubmittedEvent('branchQ1', 'takeoutFrequency');
  assert.equal(event.name, 'onboarding_answer_submitted');
  assert.deepEqual(event.properties, { screen: 'branchQ1', actionType: 'takeoutFrequency' });
  // Sensitive-looking field names (a body measurement's *name*, not its
  // value) still only ever appear as the field id, never a captured value.
  const macroEvent = onboardingV4AnswerSubmittedEvent('macroDetails', 'calculatorInputs');
  assert.deepEqual(macroEvent.properties, { screen: 'macroDetails', actionType: 'calculatorInputs' });
  assert.equal(Object.keys(macroEvent.properties).length, 2);
});

test('onboardingV4InsightViewedEvent reports the resolved branch only, for all three real goals', () => {
  for (const branch of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    const event = onboardingV4InsightViewedEvent(branch);
    assert.equal(event.name, 'personal_insight_viewed');
    assert.deepEqual(event.properties, { screen: 'personalInsight', branch });
  }
});
