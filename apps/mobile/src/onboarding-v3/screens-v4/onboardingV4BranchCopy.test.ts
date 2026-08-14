import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyHealthBranchAnswers, emptyMacroBranchAnswers, emptySavingsBranchAnswers, HEALTHIER_DEFINITIONS, HEALTH_BARRIERS } from '../state/branchContracts';
import {
  buildHealthInsight,
  buildMacroInsight,
  buildNotSureInsight,
  buildSavingsInsight,
  MACRO_Q2_OPTIONS,
  NOT_SURE_Q2_OPTIONS,
} from './onboardingV4BranchCopy';

// --- Savings insight ---------------------------------------------------------

test('zero frequency shows a nonjudgmental insight, never a $0 reveal or fabricated savings claim', () => {
  const insight = buildSavingsInsight({ takeoutFrequency: '0', spendPerMealDollars: 20 });
  assert.equal(insight.isZeroFrequency, true);
  assert.doesNotMatch(insight.headline, /\$0/);
  assert.doesNotMatch(insight.formulaNote, /\$0/);
  assert.ok(insight.formulaNote.length > 0);
});

test('a real frequency produces labeled weekly/monthly/yearly range lines with a formula note', () => {
  const insight = buildSavingsInsight({ takeoutFrequency: '4–5', spendPerMealDollars: 25 });
  assert.equal(insight.isZeroFrequency, false);
  assert.match(insight.weeklyLine, /\$\d+/);
  assert.match(insight.monthlyLine, /\$\d+/);
  assert.match(insight.yearlyLine, /\$\d+/);
  assert.ok(insight.formulaNote.length > 0);
});

test('savings insight never positively claims "actual savings" (a "not confirmed actual savings" disclaimer is fine — the honest distinction, not the absence of the phrase)', () => {
  for (const takeoutFrequency of ['1', '2–3', '4–5', '6+'] as const) {
    const insight = buildSavingsInsight({ takeoutFrequency, spendPerMealDollars: 20 });
    assert.doesNotMatch(insight.headline, /\byour actual savings\b/i);
    assert.doesNotMatch(insight.headline, /\byou('ve| have)? saved\b/i);
    assert.match(insight.formulaNote, /not confirmed actual savings/i, 'the estimate-vs-actual distinction should be stated explicitly');
  }
});

test('missing answers do not fabricate a range', () => {
  const insight = buildSavingsInsight(emptySavingsBranchAnswers);
  assert.equal(insight.weeklyLine, '');
  assert.equal(insight.isZeroFrequency, false);
});

// --- Health insight ----------------------------------------------------------

test('health insight changes with both the selected focus and the barrier', () => {
  const a = buildHealthInsight({ healthierDefinition: 'More vegetables', healthBarrier: 'Time' });
  const b = buildHealthInsight({ healthierDefinition: 'Lower sodium', healthBarrier: 'Cravings' });
  assert.notEqual(a.headline, b.headline);
  assert.notEqual(a.exampleLine, b.exampleLine);
  assert.notEqual(a.barrierNote, b.barrierNote);
});

test('every health focus x barrier combination produces real, non-empty content, including "Something else"/other', () => {
  for (const healthierDefinition of HEALTHIER_DEFINITIONS) {
    for (const healthBarrier of HEALTH_BARRIERS) {
      const insight = buildHealthInsight({ healthierDefinition, healthBarrier });
      assert.ok(insight.headline.length > 0, `empty headline for ${healthierDefinition}/${healthBarrier}`);
      assert.ok(insight.exampleLine.length > 0, `empty example for ${healthierDefinition}/${healthBarrier}`);
      assert.ok(insight.barrierNote.length > 0, `empty barrier note for ${healthierDefinition}/${healthBarrier}`);
    }
  }
});

test('health insight preserves "keep foods you enjoy" positioning and makes no clinical/weight-loss claims', () => {
  const insight = buildHealthInsight({ healthierDefinition: 'Lower calories', healthBarrier: 'Giving up favorites' });
  assert.match(insight.headline, /without banning the food you like/i);
  const forbidden = /\b(lose weight|weight loss|cure|guarantee[ds]?|diagnos|treat(ment)?|medical)\b/i;
  assert.doesNotMatch(insight.headline, forbidden);
  assert.doesNotMatch(insight.exampleLine, forbidden);
  assert.doesNotMatch(insight.barrierNote, forbidden);
});

test('an incomplete health draft does not fabricate content', () => {
  const insight = buildHealthInsight(emptyHealthBranchAnswers);
  assert.equal(insight.exampleLine, '');
  assert.equal(insight.barrierNote, '');
});

// --- Macro insight -------------------------------------------------------

test('macro insight never defaults to the fixed 150g protein / 2,100 calorie placeholders', () => {
  const adult = buildMacroInsight({ ...emptyMacroBranchAnswers, macroFocus: 'Protein', targetPath: 'estimate', calculatorInputs: { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'female', activityLevel: 'active', trainingDaysPerWeek: 3 } }, 30);
  assert.doesNotMatch(adult.rangeOrTargetLine, /\b150g\b/);
  assert.doesNotMatch(adult.rangeOrTargetLine, /\b2,?100\b/);
});

test('adult estimate insight shows a calculated range, not a single number, and explains it is a starting point', () => {
  const insight = buildMacroInsight({ ...emptyMacroBranchAnswers, macroFocus: 'Calories', targetPath: 'estimate', calculatorInputs: { ageYears: 28, heightCm: 168, weightKg: 60, biologicalSex: 'female', activityLevel: 'lightly_active', trainingDaysPerWeek: 2 } }, 28);
  assert.match(insight.rangeOrTargetLine, /–/);
  assert.match(insight.disclaimer, /starting point/i);
  assert.equal(insight.minorMessage, null);
});

test('known targets insight confirms the user\'s own entered values, not a calculation', () => {
  const insight = buildMacroInsight({ ...emptyMacroBranchAnswers, macroFocus: 'Protein', targetPath: 'known', knownTargets: { proteinGrams: 130 } }, 30);
  assert.match(insight.rangeOrTargetLine, /130g protein/);
  assert.equal(insight.minorMessage, null);
});

test('every under-18 age on the estimate path shows the minor-safe message, never a calculated range', () => {
  for (const ageYears of [12, 13, 15, 17]) {
    const insight = buildMacroInsight({ ...emptyMacroBranchAnswers, macroFocus: 'Calories', targetPath: 'estimate', calculatorInputs: { ageYears, heightCm: 160, weightKg: 55, biologicalSex: 'female', activityLevel: 'active', trainingDaysPerWeek: 2 } }, ageYears);
    assert.ok(insight.minorMessage, `expected a minor message at age ${ageYears}`);
    assert.equal(insight.rangeOrTargetLine, '');
  }
});

test('a minor on the known-targets path still gets their own values confirmed, not the safety redirect', () => {
  const insight = buildMacroInsight({ ...emptyMacroBranchAnswers, targetPath: 'known', knownTargets: { calories: 1800 } }, 15);
  assert.equal(insight.minorMessage, null);
  assert.match(insight.rangeOrTargetLine, /1800 cal/);
});

// --- Not Sure insight ------------------------------------------------------

test('not_sure insight reflects the resolved goal for all three transformations', () => {
  assert.match(buildNotSureInsight('save_money'), /cheaper/i);
  assert.match(buildNotSureInsight('eat_healthier'), /balanced/i);
  assert.match(buildNotSureInsight('hit_macros'), /protein/i);
});

test('not_sure insight has a safe fallback before resolution', () => {
  assert.equal(typeof buildNotSureInsight(null), 'string');
  assert.ok(buildNotSureInsight(null).length > 0);
});

// --- Option vocabularies ----------------------------------------------------

test('macro Q2 and not_sure Q2 option vocabularies match their resolver contracts exactly', () => {
  assert.deepEqual(MACRO_Q2_OPTIONS.map((o) => o.value).sort(), ['estimate', 'known', 'not_sure'].sort());
  assert.deepEqual(NOT_SURE_Q2_OPTIONS.map((o) => o.value).sort(), ['cheaper', 'more_balanced', 'more_protein'].sort());
});
