import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosisCopy, finalPlanMessage, targetSummary } from './macrosBranchCopy';

test('acknowledgement copy changes with the selected goal and obstacle', () => {
  assert.deepEqual(diagnosisCopy({ macroFocus: 'low_protein', macroBarrier: 'planning' }), { title: 'You shouldn’t have to calculate every meal yourself.', body: 'We’ll lead with one useful recommendation and keep the details available when you want them.' });
  assert.deepEqual(diagnosisCopy({ macroFocus: 'calorie_inconsistency', macroBarrier: 'hunger' }), { title: 'Meals should fit your calories and still feel filling.', body: 'We’ll keep portions and satisfying ingredients easy to see.' });
});

test('target summary is explicit about units and supports partial targets', () => {
  assert.equal(targetSummary({ proteinTargetGrams: 150, calorieTarget: 2200, carbTargetGrams: 240, fatTargetGrams: 70 }), '2,200 cal/day • 150g protein • 240g carbs • 70g fat');
  assert.equal(targetSummary({ proteinTargetGrams: 150, calorieTarget: null }), '150g protein');
});

test('plan copy stays food-first and avoids clinical claims', () => {
  const copy = finalPlanMessage({ macroFocus: 'low_protein', macroBarrier: 'hunger' });
  assert.match(copy, /satisfying/i); assert.doesNotMatch(copy, /weight loss|BMI|deficit|guarantee/i);
});
