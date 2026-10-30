import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

import { getRecipeDescription, getCookingCtaLabel } from './recipePresentation';

test('recipe descriptions preserve short and medium copy in full', () => {
  assert.equal(
    getRecipeDescription('A quick pasta with tomato and basil.'),
    'A quick pasta with tomato and basil.',
  );

  const medium = getRecipeDescription(
    'This is the first useful sentence. This is the second useful sentence. A third sentence should not appear.',
  );
  assert.equal(medium, 'This is the first useful sentence. This is the second useful sentence. A third sentence should not appear.');
});

test('long recipe descriptions remain complete and missing copy uses an honest fallback', () => {
  const longDescription =
    'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty.';
  assert.equal(getRecipeDescription(longDescription), longDescription);
  assert.equal(getRecipeDescription(''), 'A practical homemade take on this dish.');
});

test('recipe description screens render multiline copy without a line cap', () => {
  const detail = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
  const result = readFileSync(resolve(process.cwd(), 'src/screens/ResultSummaryScreen.tsx'), 'utf8');
  const recommendation = readFileSync(resolve(process.cwd(), 'src/components/RecommendationCard.tsx'), 'utf8');

  assert.match(detail, /<Text style=\{styles\.description\}>\{displayDescription\}<\/Text>/);
  assert.match(result, /<Text style=\{styles\.subtitle\}>\s*\{getRecipeDescription\(selectedRecipe\.description\)\}/);
  assert.match(recommendation, /<Text style=\{styles\.blurb\}>\{recipe\.blurb\}<\/Text>/);
  assert.doesNotMatch(detail, /<Text[^>]*numberOfLines=\{\d+\}[^>]*style=\{styles\.description\}/);
  assert.doesNotMatch(result, /<Text[^>]*numberOfLines=\{\d+\}[^>]*style=\{styles\.subtitle\}/);
  assert.doesNotMatch(recommendation, /<Text[^>]*numberOfLines=\{\d+\}[^>]*style=\{styles\.blurb\}/);
});

test('cooking CTA reflects active and completed recipe state', () => {
  assert.equal(getCookingCtaLabel({ id: 'recipe-1' }, null), 'Start Cooking');
  assert.equal(getCookingCtaLabel({ id: 'recipe-1' }, 'recipe-1'), 'Continue Cooking');
  assert.equal(
    getCookingCtaLabel({ id: 'recipe-1', completionState: 'completed' }, null),
    'Cook Again',
  );
});
