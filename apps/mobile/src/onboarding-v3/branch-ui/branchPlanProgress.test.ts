import assert from 'node:assert/strict';
import test from 'node:test';

import { getFinalBranchPlanProgress } from './branchPlanProgress';

test('the Savings plan is the completed fifth step and fills the whole progress bar', () => {
  const progress = getFinalBranchPlanProgress('save_money');
  assert.deepEqual(progress, { answered: 5, total: 5, displayedStep: 5 });
  assert.equal(`${progress.displayedStep}/${progress.total}`, '5/5');
  assert.equal(progress.answered / progress.total, 1);
});

test('Health and Macro plans retain their branch-specific final progress', () => {
  assert.deepEqual(getFinalBranchPlanProgress('eat_healthier'), { answered: 8, total: 8, displayedStep: 8 });
  assert.deepEqual(getFinalBranchPlanProgress('hit_macros'), { answered: 7, total: 7, displayedStep: 7 });
});

// A shortened branch must retain its denominator when it enters the shared plan.
test('all assigned branch variants finish at their own visible total', () => {
  const totals = { save_money: [5, 5, 4], eat_healthier: [8, 5, 3], hit_macros: [7, 5, 4] } as const;
  for (const branch of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    (['A', 'B', 'C'] as const).forEach((variant, index) => {
      const progress = getFinalBranchPlanProgress(branch, variant);
      assert.equal(progress.total, totals[branch][index]);
      assert.equal(progress.answered, progress.total);
      assert.equal(progress.displayedStep, progress.total);
    });
  }
});
