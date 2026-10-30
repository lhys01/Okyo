import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExample, EXAMPLE_CHIPS, PLACEHOLDER_NOTICE } from './example';

test('base example is internally consistent', () => {
  const e = buildExample({});
  assert.equal(e.totalMinutes, 15);
  assert.equal(e.steps.length, 3);
  assert.equal(e.ingredients.length, 7);
  assert.match(e.title, /15-Minute/);
  assert.match(e.estimatedCost, /^\$/);
  assert.ok(e.costCaveat.length > 0, 'cost is always labelled an estimate');
});

test('title time matches the stated total time', () => {
  const e = buildExample({});
  assert.ok(e.title.includes(String(e.totalMinutes)));
});

test('fewer-ingredients answer actually shortens the list', () => {
  const e = buildExample({ followUp: { kind: 'friction', value: 'fewer_ingredients' } });
  assert.equal(e.ingredients.length, 5);
  assert.equal(e.emphasis, 'Five ingredients');
});

test('cleanup answer emphasises the pan count truthfully', () => {
  const e = buildExample({ followUp: { kind: 'friction', value: 'less_cleanup' } });
  assert.equal(e.pansToWash, 1);
  assert.equal(e.emphasis, 'One pan to wash');
});

test('substitution answer offers a real swap', () => {
  const e = buildExample({ followUp: { kind: 'friction', value: 'needs_substitutions' } });
  assert.match(String(e.emphasis), /yoghurt|skip/);
});

test('each spoil-first answer names its own category', () => {
  const produce = buildExample({ followUp: { kind: 'spoilFirst', value: 'produce' } });
  const leftovers = buildExample({ followUp: { kind: 'spoilFirst', value: 'leftovers' } });
  assert.notEqual(produce.emphasis, leftovers.emphasis);
  assert.match(String(leftovers.emphasis), /leftover/i);
});

test('recipePriority changes the example', () => {
  assert.match(String(buildExample({ recipePriority: 'lowest_cost' }).emphasis), /Cheapest/);
  assert.equal(buildExample({ recipePriority: 'fewest_ingredients' }).ingredients.length, 5);
});

test('uncertain chips are marked, not hidden', () => {
  const unsure = EXAMPLE_CHIPS.filter((c) => !c.certain);
  assert.ok(unsure.length >= 1, 'at least one honest guess is shown');
  assert.ok(unsure.every((c) => c.label.includes('?')), 'guesses carry a question mark');
});

test('placeholder notice states the production gate', () => {
  assert.match(PLACEHOLDER_NOTICE, /production acceptance blocked/i);
});
