import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyOnboardingV4Draft } from '../state/onboardingV4Draft';
import { buildOnboardingReveal, MACRO_TEACHING_EXAMPLE } from './onboardingRevealContent';

test('money reveal uses only the entered eating-out amount, never inferred home prices or banked savings', () => {
  const content = buildOnboardingReveal({ ...emptyOnboardingV4Draft, initialGoal: 'save_money', savingsAnswers: { takeoutFrequency: '2–3', spendPerMealDollars: 18 } });
  assert.equal(content.kind, 'money');
  if (content.kind !== 'money') return;
  assert.equal(content.eatingOut, '$18');
  assert.equal(content.home, "We'll calculate this from your recipe.");
  assert.match(content.note, /only a comparison/);
  assert.doesNotMatch(JSON.stringify(content), /You saved|a year|a month/);
});

test('missing comparison values stay missing', () => {
  const content = buildOnboardingReveal({ ...emptyOnboardingV4Draft, initialGoal: 'save_money' });
  assert.equal(content.kind, 'money');
  if (content.kind === 'money') assert.equal(content.eatingOut, 'Your comparison');
  assert.doesNotMatch(JSON.stringify(content), /\$\d/);
});

test('health reveal reflects both meaning and barrier without claiming the example is generated', () => {
  const content = buildOnboardingReveal({ ...emptyOnboardingV4Draft, initialGoal: 'eat_healthier', healthAnswers: { healthierDefinition: 'More vegetables', healthBarrier: 'Time' } });
  assert.equal(content.kind, 'health');
  if (content.kind !== 'health') return;
  assert.match(content.suggestion, /vegetables/);
  assert.match(content.summary, /time/);
  assert.match(content.note, /not your finished recipe/);
});

test('macro hero follows the chosen focus; own targets remain a separate daily reference', () => {
  for (const [macroFocus, metric] of [['Protein', 'protein'], ['Calories', 'calories'], ['Balanced macros', 'balanced']] as const) {
    const content = buildOnboardingReveal({ ...emptyOnboardingV4Draft, initialGoal: 'hit_macros', macroAnswers: { ...emptyOnboardingV4Draft.macroAnswers, macroFocus, targetPath: 'known', knownTargets: { proteinGrams: 120, calories: 2200 } } });
    assert.equal(content.kind, 'macros');
    if (content.kind !== 'macros') continue;
    assert.equal(content.metric, metric);
    assert.deepEqual(content.ownTargets, ['120g protein/day', '2200 calories/day']);
    assert.equal(content.note, MACRO_TEACHING_EXAMPLE.disclaimer);
    assert.match(content.note, /Illustrative/);
  }
});

test('no-target macro path is complete without requesting missing body data', () => {
  const content = buildOnboardingReveal({ ...emptyOnboardingV4Draft, initialGoal: 'hit_macros' });
  assert.equal(content.kind, 'macros');
  if (content.kind === 'macros') assert.deepEqual(content.ownTargets, []);
  assert.doesNotMatch(JSON.stringify(content), /finish.*details|starting range|calorie.*target/i);
});
