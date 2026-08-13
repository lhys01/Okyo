import assert from 'node:assert/strict';
import test from 'node:test';

import { getCompactRecipeDescription, getCookingCtaLabel } from './recipePresentation';

test('recipe descriptions stay concise and preserve complete short copy', () => {
  assert.equal(
    getCompactRecipeDescription('A quick pasta with tomato and basil.'),
    'A quick pasta with tomato and basil.',
  );

  const compact = getCompactRecipeDescription(
    'This is the first useful sentence. This is the second useful sentence. A third sentence should not appear.',
  );
  assert.equal(compact, 'This is the first useful sentence.');
});

test('recipe descriptions cap long copy and keep an honest fallback', () => {
  const compact = getCompactRecipeDescription(
    'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty.',
  );
  assert.ok(compact.split(/\s+/).length <= 18);
  assert.ok(!compact.includes('…'));
  assert.equal(getCompactRecipeDescription(''), 'A practical homemade take on this dish.');
});

test('cooking CTA reflects active and completed recipe state', () => {
  assert.equal(getCookingCtaLabel({ id: 'recipe-1' }, null), 'Start Cooking');
  assert.equal(getCookingCtaLabel({ id: 'recipe-1' }, 'recipe-1'), 'Continue Cooking');
  assert.equal(
    getCookingCtaLabel({ id: 'recipe-1', completionState: 'completed' }, null),
    'Cook Again',
  );
});
