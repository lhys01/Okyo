import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreferences, buildPreferencesOrUndefined, buildPromises, buildSummaryLine } from './personalization';
import type { OnboardingAnswers } from './types';

test('empty answers produce no preferences payload at all', () => {
  assert.deepEqual(buildPreferences({}), {});
  assert.equal(buildPreferencesOrUndefined({}), undefined,
    'absent rather than an empty object, so the request field is omitted');
});

test('problem becomes priority', () => {
  assert.equal(buildPreferences({ problem: 'less_effort' }).priority, 'less_effort');
});

test('friction follow-up becomes frictionDetail', () => {
  const p = buildPreferences({ followUp: { kind: 'friction', value: 'less_cleanup' } });
  assert.equal(p.frictionDetail, 'less_cleanup');
});

test('spoil-first follow-up becomes spoilFirst', () => {
  const p = buildPreferences({ followUp: { kind: 'spoilFirst', value: 'produce' } });
  assert.equal(p.spoilFirst, 'produce');
});

test('time follow-up becomes a hard maxMinutes ceiling', () => {
  const p = buildPreferences({ followUp: { kind: 'maxMinutes', value: 30 } });
  assert.equal(p.maxMinutes, 30);
});

test('"It depends" imposes no false time ceiling', () => {
  const p = buildPreferences({ followUp: { kind: 'maxMinutesUnknown' } });
  assert.equal('maxMinutes' in p, false);
});

test('cooking for others becomes servings', () => {
  const p = buildPreferences({ followUp: { kind: 'servings', value: 4 } });
  assert.equal(p.servings, 4);
});

test('recipePriority is carried into the payload', () => {
  assert.equal(buildPreferences({ recipePriority: 'speed' }).recipePriority, 'speed');
  assert.equal(buildPreferences({ recipePriority: 'lowest_cost' }).recipePriority, 'lowest_cost');
});

test('diet pattern and exclusions travel separately', () => {
  const p = buildPreferences({ dietPattern: 'vegan', avoid: ['gluten', 'nuts'] });
  assert.equal(p.dietPattern, 'vegan');
  assert.deepEqual(p.avoid, ['gluten', 'nuts']);
});

test('a full answer set maps every field', () => {
  const answers: OnboardingAnswers = {
    problem: 'less_effort',
    followUp: { kind: 'friction', value: 'less_cleanup' },
    guidance: 'light',
    dietPattern: 'vegetarian',
    avoid: ['dairy'],
    recipePriority: 'speed',
  };
  assert.deepEqual(buildPreferences(answers), {
    priority: 'less_effort',
    guidance: 'light',
    dietPattern: 'vegetarian',
    avoid: ['dairy'],
    recipePriority: 'speed',
    frictionDetail: 'less_cleanup',
  });
});

test('promises are capped at four and led by the most specific answer', () => {
  const promises = buildPromises({
    problem: 'less_effort',
    followUp: { kind: 'friction', value: 'less_cleanup' },
    guidance: 'step_by_step',
    avoid: ['dairy'],
  });
  assert.ok(promises.length <= 4);
  assert.equal(promises[0], 'Low cleanup');
});

test('time answer surfaces the actual number in the promise', () => {
  const promises = buildPromises({ problem: 'save_time', followUp: { kind: 'maxMinutes', value: 15 } });
  assert.ok(promises.includes('Recipes under 15 minutes'));
});

test('no answers means no invented promises', () => {
  assert.deepEqual(buildPromises({}), []);
  assert.match(buildSummaryLine({}), /whatever you photograph/);
});

test('summary line reflects the answers given', () => {
  const line = buildSummaryLine({
    problem: 'less_effort',
    followUp: { kind: 'friction', value: 'less_cleanup' },
  });
  assert.match(line, /low cleanup/);
});

test('summary line uses the chosen fox name or an unnamed fallback', () => {
  const answers = { problem: 'less_effort' as const };
  assert.match(buildSummaryLine(answers, 'Luna'), /Luna will write recipes/);
  assert.match(buildSummaryLine(answers), /your fox will write recipes/);
});
