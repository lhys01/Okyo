import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildQuery,
  queryLadder,
  scorePhoto,
  readRecipes,
} from './fetch-recipe-images.mjs';

const photo = (alt, w = 1200, h = 800) => ({ alt, width: w, height: h });

test('strips appliance and method noise that would match hardware photos', () => {
  assert.equal(buildQuery('Air Fryer Crispy Chicken Wings'), 'crispy chicken wings');
  assert.equal(buildQuery('Sheet Pan Lemon Chicken'), 'lemon chicken');
  assert.equal(buildQuery('Slow Cooker Pulled Pork'), 'pulled pork');
  assert.equal(buildQuery('30-Minute Weeknight Beef Tacos'), 'beef tacos');
});

test('drops trailing filler words that carry no visual meaning', () => {
  assert.equal(buildQuery('Baked Ziti Dinner'), 'baked ziti');
});

test('never degrades a query to a single generic ingredient', () => {
  // "beef" alone would match any beef photo on Pexels.
  for (const title of ['Beef and Barley Stew', 'Chicken and Rice Casserole']) {
    for (const q of queryLadder(title)) {
      assert.ok(
        q.split(' ').length >= 2,
        `"${title}" produced too-generic rung "${q}"`,
      );
    }
  }
});

test('query ladder goes specific -> general and never empty', () => {
  const ladder = queryLadder('Split Pea Soup with Ham');
  assert.deepEqual(ladder, ['split pea soup with ham', 'split pea soup', 'pea soup']);

  for (const { title } of readRecipes({ includeDrafts: true })) {
    assert.ok(queryLadder(title).length > 0, `empty ladder for "${title}"`);
  }
});

test('scores an on-topic photo above an off-topic one', () => {
  const q = 'chicken noodle soup';
  const good = scorePhoto(photo('a bowl of chicken noodle soup on a table'), q);
  const bad = scorePhoto(photo('a red sports car parked outside'), q);
  assert.ok(good > bad, `expected ${good} > ${bad}`);
  assert.ok(good >= 0.5, 'on-topic photo should clear the 0.5 acceptance bar');
});

test('an unrelated photo cannot clear the final-rung bar of 0.34', () => {
  const off = scorePhoto(photo('portrait of a woman smiling'), 'beef stew');
  assert.ok(off < 0.34, `unrelated photo scored ${off}, would ship a wrong image`);
});

test('photos with no alt text are rejected outright', () => {
  assert.equal(scorePhoto(photo(''), 'clam chowder'), -1);
});

test('landscape is preferred over portrait for equal relevance', () => {
  const q = 'greek salad';
  const wide = scorePhoto(photo('a greek salad', 1200, 800), q);
  const tall = scorePhoto(photo('a greek salad', 800, 1200), q);
  assert.ok(wide > tall);
});

test('parses every recipe out of the source of truth', () => {
  const all = readRecipes({ includeDrafts: true });
  assert.equal(all.length, 618);
  assert.ok(all.every((r) => r.id && r.title));
  assert.equal(new Set(all.map((r) => r.id)).size, all.length, 'ids must be unique');
});

test('never fetches photos for unfinished draft recipes', () => {
  // A real photo on a placeholder recipe makes it look trustworthy.
  const fetchable = readRecipes();
  assert.ok(fetchable.every((r) => !r.draft), 'a draft slipped into the fetch list');
  assert.ok(
    fetchable.length < readRecipes({ includeDrafts: true }).length,
    'drafts are not being excluded at all',
  );
});

test('bare ingredient queries are biased toward prepared food', () => {
  const ladder = queryLadder('Air Fryer Salmon');
  assert.equal(ladder[0], 'salmon dish', 'should search prepared food first');
  assert.ok(ladder.includes('salmon'), 'plain word kept as fallback');
});

test('search hint words do not dilute relevance scoring', () => {
  // "dish" is absent from this alt text but must not count against the match.
  const s = scorePhoto({ alt: 'grilled salmon on a wooden board', width: 1200, height: 800 }, 'salmon dish');
  assert.ok(s >= 0.5, `hint word dragged score down to ${s}`);
});
