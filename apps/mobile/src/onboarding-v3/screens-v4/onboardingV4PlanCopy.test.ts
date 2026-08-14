import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyHealthBranchAnswers, emptyMacroBranchAnswers, emptyNotSureBranchAnswers, emptySavingsBranchAnswers } from '../state/branchContracts';
import { buildHealthPlanContent, buildMacrosPlanContent, buildNotSurePlanContent, buildSavingsPlanContent, withDietarySummary } from './onboardingV4PlanCopy';

function allText(content: { headline: string; cards: readonly { title: string; body: string }[] }): string {
  return [content.headline, ...content.cards.flatMap((c) => [c.title, c.body])].join(' ');
}

test('every plan builder returns exactly three cards titled What you told us / What Okyo will prioritize / Your first action', () => {
  const savings = buildSavingsPlanContent({ takeoutFrequency: '2–3', spendPerMealDollars: 20 });
  const health = buildHealthPlanContent({ healthierDefinition: 'More vegetables', healthBarrier: 'Time' });
  const macros = buildMacrosPlanContent({ ...emptyMacroBranchAnswers, macroFocus: 'Protein', targetPath: 'known', knownTargets: { proteinGrams: 150 } }, 30);
  const notSure = buildNotSurePlanContent({ universalNeed: 'Spend less', preferredTransformation: 'cheaper' }, 'save_money');

  for (const content of [savings, health, macros, notSure]) {
    assert.equal(content.cards.length, 3);
    assert.deepEqual(content.cards.map((c) => c.title), ['What you told us', 'What Okyo will prioritize', 'Your first action']);
    for (const card of content.cards) assert.ok(card.body.length > 0);
  }
});

test('savings plan uses "Eating out" and never "Restaurant estimate", and labels figures as estimates', () => {
  const content = buildSavingsPlanContent({ takeoutFrequency: '2–3', spendPerMealDollars: 20 });
  const text = allText(content);
  assert.doesNotMatch(text, /restaurant estimate/i);
  assert.match(content.cards[2].body, /estimated eating-out cost/i);
  assert.match(content.cards[2].body, /estimated make-at-home cost/i);
});

test('savings first-action card reflects estimated eating-out minus estimated make-at-home, not weekly/annual totals', () => {
  const content = buildSavingsPlanContent({ takeoutFrequency: '2–3', spendPerMealDollars: 20 });
  assert.match(content.cards[2].body, /\$20/); // the entered per-order eating-out cost
  assert.match(content.cards[2].body, /\$\d+(\.\d+)?/); // a make-at-home figure is present too
  assert.match(content.cards[2].body, /estimated savings: about \$14\.00 per meal/i);
});

test('dietary summary is derived into What you told us while the plan remains exactly three cards', () => {
  const content = withDietarySummary(
    buildHealthPlanContent({ healthierDefinition: 'More vegetables', healthBarrier: 'Time' }),
    { allergies: ['Peanuts'], restrictions: ['Vegetarian'], dislikes: ['Cilantro'], noneOfThese: false, completed: true },
  );
  assert.equal(content.cards.length, 3);
  assert.match(content.cards[0].body, /Allergies: Peanuts/);
  assert.match(content.cards[0].body, /Restrictions: Vegetarian/);
  assert.match(content.cards[0].body, /Dislikes: Cilantro/);
});

test('an explicit empty dietary selection is summarized honestly', () => {
  const content = withDietarySummary(
    buildSavingsPlanContent({ takeoutFrequency: '1', spendPerMealDollars: 20 }),
    { allergies: [], restrictions: [], dislikes: [], noneOfThese: true, completed: true },
  );
  assert.match(content.cards[0].body, /No allergies, restrictions, or dislikes selected/);
});

test('savings plan for zero-frequency (already cooking) never claims a spend comparison', () => {
  const content = buildSavingsPlanContent({ ...emptySavingsBranchAnswers, takeoutFrequency: '0', spendPerMealDollars: 20 });
  assert.match(content.cards[0].body, /already cooking/i);
});

test('health plan carries the selected focus and barrier, with no clinical or weight-loss claims', () => {
  const content = buildHealthPlanContent({ healthierDefinition: 'Lower calories', healthBarrier: 'Cravings' });
  const text = allText(content).toLowerCase();
  assert.match(content.cards[0].body, /lower calories/i);
  assert.doesNotMatch(text, /guarantee/);
  assert.doesNotMatch(text, /weight loss/);
  assert.doesNotMatch(text, /cure|diagnos|treat/);
});

test('macros plan for a minor uses the safe redirect and never presents a calorie/weight-loss target', () => {
  const content = buildMacrosPlanContent({ ...emptyMacroBranchAnswers, macroFocus: 'Calories', targetPath: 'estimate' }, 15);
  const text = allText(content).toLowerCase();
  assert.doesNotMatch(text, /weight.?loss target/);
  assert.match(content.cards[0].body, /guardian|clinician|own targets/i);
});

test('macros plan with a calculated range presents it as a starting point, never a fixed weight-loss target', () => {
  const content = buildMacrosPlanContent(
    { macroFocus: 'Calories', targetPath: 'estimate', knownTargets: {}, calculatorInputs: { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'male', activityLevel: 'active', trainingDaysPerWeek: 3 } },
    30,
  );
  assert.match(content.cards[0].body, /starting point|starting range/i);
  assert.doesNotMatch(content.cards[0].body.toLowerCase(), /weight loss/);
});

test('not_sure plan uses resolvedPrimaryGoal for priority while echoing the originally-selected transformation', () => {
  const content = buildNotSurePlanContent({ universalNeed: 'Recreate food I see', preferredTransformation: 'more_protein' }, 'hit_macros');
  assert.match(content.cards[0].body, /higher-protein/i);
  assert.match(content.cards[1].body, /protein/i);
});

test('not_sure plan resolves priority from the transformation chip even if resolvedPrimaryGoal was not passed explicitly', () => {
  const content = buildNotSurePlanContent({ universalNeed: 'Spend less', preferredTransformation: 'cheaper' }, null);
  assert.match(content.cards[1].body, /cost down/i);
});

test('every plan builder\'s firstScanPriorityEcho is a non-empty string usable on the scan-entry screen', () => {
  assert.ok(buildSavingsPlanContent(emptySavingsBranchAnswers).firstScanPriorityEcho.length > 0);
  assert.ok(buildHealthPlanContent(emptyHealthBranchAnswers).firstScanPriorityEcho.length > 0);
  assert.ok(buildMacrosPlanContent(emptyMacroBranchAnswers, null).firstScanPriorityEcho.length > 0);
  assert.ok(buildNotSurePlanContent(emptyNotSureBranchAnswers, null).firstScanPriorityEcho.length > 0);
});
