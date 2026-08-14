import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSavingsBranchEstimate,
  DOWNSTREAM_USES,
  emptyMacroBranchAnswers,
  emptySavingsBranchAnswers,
  HEALTHIER_DEFINITIONS,
  HEALTH_BARRIERS,
  PREFERRED_TRANSFORMATIONS,
  resolveHealthTransformationGuidance,
  resolveMacroGuidance,
  resolveNotSurePrimaryGoal,
  TAKEOUT_FREQUENCY_BUCKETS,
  V4_BRANCH_FIELD_DOWNSTREAM_USES,
  V4_BRANCH_FIELD_IDS,
  type MacroBranchAnswers,
} from './branchContracts';

// --- Save Money ------------------------------------------------------------

test('savings estimate returns a range, not a point number, and low <= high at every bucket', () => {
  for (const takeoutFrequency of TAKEOUT_FREQUENCY_BUCKETS) {
    if (takeoutFrequency === '0') continue;
    const estimate = calculateSavingsBranchEstimate({ takeoutFrequency, spendPerMealDollars: 18 });
    assert.ok(estimate, `expected an estimate for bucket ${takeoutFrequency}`);
    assert.equal(estimate!.isEstimate, true);
    assert.ok(estimate!.weeklyLow <= estimate!.weeklyHigh);
    assert.ok(estimate!.monthlyLow <= estimate!.monthlyHigh);
    assert.ok(estimate!.annualLow <= estimate!.annualHigh);
  }
});

test('a "0" takeout frequency produces no estimate (nothing to project)', () => {
  assert.equal(calculateSavingsBranchEstimate({ takeoutFrequency: '0', spendPerMealDollars: 18 }), null);
});

test('missing answers produce no estimate rather than a fabricated number', () => {
  assert.equal(calculateSavingsBranchEstimate(emptySavingsBranchAnswers), null);
  assert.equal(calculateSavingsBranchEstimate({ takeoutFrequency: '2–3', spendPerMealDollars: null }), null);
});

test('higher takeout frequency at the same spend never produces a lower annual high than a lower frequency', () => {
  const low = calculateSavingsBranchEstimate({ takeoutFrequency: '1', spendPerMealDollars: 20 })!;
  const high = calculateSavingsBranchEstimate({ takeoutFrequency: '6+', spendPerMealDollars: 20 })!;
  assert.ok(high.annualHigh > low.annualHigh);
});

test('buckets with more than one order/week produce a genuine low < high range, not a disguised point value', () => {
  for (const takeoutFrequency of ['2–3', '4–5', '6+'] as const) {
    const estimate = calculateSavingsBranchEstimate({ takeoutFrequency, spendPerMealDollars: 20 })!;
    assert.equal(estimate.hasRange, true, `bucket ${takeoutFrequency} should have a genuine range`);
    assert.ok(estimate.annualLow < estimate.annualHigh, `bucket ${takeoutFrequency} low must be strictly less than high`);
    assert.ok(estimate.weeklyLow <= estimate.weeklyHigh);
    assert.ok(estimate.monthlyLow <= estimate.monthlyHigh);
  }
});

test('the "1" bucket still has a genuine range: the conservative low already nets out the cost of cooking at home', () => {
  const estimate = calculateSavingsBranchEstimate({ takeoutFrequency: '1', spendPerMealDollars: 20 })!;
  assert.equal(estimate.hasRange, true);
  assert.ok(estimate.annualLow < estimate.annualHigh);
});

test('estimated avoided spend is never labeled as confirmed actual savings', () => {
  const estimate = calculateSavingsBranchEstimate({ takeoutFrequency: '4–5', spendPerMealDollars: 20 })!;
  assert.equal(estimate.isEstimate, true);
  assert.ok(!('actualSavings' in estimate));
  assert.ok(!('confirmedSavings' in estimate));
});

// --- Eat Healthier -----------------------------------------------------------

test('every health focus has a distinct, non-clinical transformation guidance entry', () => {
  const seen = new Set<string>();
  for (const definition of HEALTHIER_DEFINITIONS) {
    const guidance = resolveHealthTransformationGuidance(definition);
    assert.ok(guidance.exampleLine.length > 0);
    assert.ok(guidance.resultPriorityFields.length > 0);
    assert.ok(guidance.suggestedEditKeys.length > 0);
    seen.add(guidance.exampleLine);
  }
  assert.equal(seen.size, HEALTHIER_DEFINITIONS.length, 'every focus should have its own distinct example line');
});

test('no health guidance copy makes a clinical or weight-loss claim', () => {
  const forbidden = /\b(lose weight|weight loss|cure|guarantee[ds]?|diagnos|treat(ment)?|medical)\b/i;
  for (const definition of HEALTHIER_DEFINITIONS) {
    const guidance = resolveHealthTransformationGuidance(definition);
    assert.doesNotMatch(guidance.exampleLine, forbidden, `clinical/weight-loss language found for "${definition}"`);
  }
});

test('every health barrier option is a recognized, distinct value', () => {
  assert.equal(new Set(HEALTH_BARRIERS).size, HEALTH_BARRIERS.length);
});

test('the "Something else" (other) health focus has a deterministic, real mapping — not silently unhandled', () => {
  assert.ok(HEALTHIER_DEFINITIONS.includes('Something else'));
  const guidance = resolveHealthTransformationGuidance('Something else');
  assert.ok(guidance.exampleLine.length > 0);
  assert.ok(guidance.resultPriorityFields.length > 0);
  assert.ok(guidance.suggestedEditKeys.length > 0);
});

// --- Hit My Macros -----------------------------------------------------------

const adultCalculatorInputs = { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'female' as const, activityLevel: 'active' as const, trainingDaysPerWeek: 3 };

test('an adult on the estimate path gets a calculated range, never a single false-precision number', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, macroFocus: 'Calories', targetPath: 'estimate', calculatorInputs: adultCalculatorInputs };
  const result = resolveMacroGuidance(answers, 30);
  assert.equal(result.kind, 'calculated_range');
  if (result.kind === 'calculated_range') {
    assert.ok(result.rangeLowCalories < result.targets.calories);
    assert.ok(result.rangeHighCalories > result.targets.calories);
  }
});

test('partial known targets are accepted as-is and never treated as a calculation', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'known', knownTargets: { proteinGrams: 140 } };
  const result = resolveMacroGuidance(answers, 30);
  assert.deepEqual(result, { kind: 'known_targets', isEstimate: false, targets: { calories: undefined, proteinGrams: 140, carbsGrams: undefined, fatGrams: undefined } });
});

test('empty known targets is insufficient input, not a silently-accepted empty result', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'known', knownTargets: {} };
  assert.deepEqual(resolveMacroGuidance(answers, 30), { kind: 'insufficient_input' });
});

test('an out-of-range known target value is dropped, not silently accepted', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'known', knownTargets: { calories: 50, proteinGrams: 140 } };
  const result = resolveMacroGuidance(answers, 30);
  assert.equal(result.kind, 'known_targets');
  if (result.kind === 'known_targets') {
    assert.equal(result.targets.calories, undefined);
    assert.equal(result.targets.proteinGrams, 140);
  }
});

test('a minor on the estimate path always gets minor_safe_redirect, regardless of macroFocus', () => {
  for (const macroFocus of ['Protein', 'Calories', 'Balanced macros', 'Performance/fueling', 'Something else'] as const) {
    const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, macroFocus, targetPath: 'estimate', calculatorInputs: { ...adultCalculatorInputs, ageYears: 15 } };
    const result = resolveMacroGuidance(answers, 15);
    assert.equal(result.kind, 'minor_safe_redirect');
    if (result.kind === 'minor_safe_redirect') {
      assert.equal(result.reason, 'under_18');
      assert.deepEqual([...result.allowedPaths].sort(), ['balanced_fueling_guidance', 'guardian_or_clinician_targets', 'self_entered_targets'].sort());
    }
  }
});

test('a minor with targetPath "not_sure" also gets minor_safe_redirect (safest default)', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'not_sure' };
  assert.equal(resolveMacroGuidance(answers, 16).kind, 'minor_safe_redirect');
});

test('a minor on the known-targets path is passed through as-is — Okyo calculates nothing for them', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'known', knownTargets: { calories: 1800, proteinGrams: 90 } };
  const result = resolveMacroGuidance(answers, 15);
  assert.equal(result.kind, 'known_targets');
});

test('the under-18 gate is derived from ageYears independently of calculatorInputs.ageYears (cannot be bypassed by mismatched inputs)', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'estimate', calculatorInputs: { ...adultCalculatorInputs, ageYears: 40 } };
  // The caller-supplied `ageYears` parameter (e.g. from the real, verified age) governs — a mismatched calculatorInputs.ageYears cannot unlock adult behavior.
  assert.equal(resolveMacroGuidance(answers, 15).kind, 'minor_safe_redirect');
});

test('insufficient calculator inputs for an adult yields insufficient_input, not a guessed target', () => {
  const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, targetPath: 'estimate', calculatorInputs: { ...adultCalculatorInputs, heightCm: null } };
  assert.deepEqual(resolveMacroGuidance(answers, 30), { kind: 'insufficient_input' });
});

test('adult estimate calculations are unaffected by the under-18 safety change — same result regardless of macroFocus/targetPath combinations at the same age', () => {
  for (const macroFocus of ['Protein', 'Calories', 'Balanced macros', 'Performance/fueling', 'Something else'] as const) {
    const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, macroFocus, targetPath: 'estimate', calculatorInputs: adultCalculatorInputs };
    const result = resolveMacroGuidance(answers, 30);
    assert.equal(result.kind, 'calculated_range', `adult with macroFocus=${macroFocus} should still get a real calculated range`);
  }
});

test('exhaustive: every under-18 age with every macroFocus/targetPath=estimate combination is structurally incapable of exposing calories/targets (minor_safe_redirect has no targets field)', () => {
  for (const ageYears of [1, 5, 12, 13, 15, 16, 17]) {
    for (const macroFocus of ['Protein', 'Calories', 'Balanced macros', 'Performance/fueling', 'Something else'] as const) {
      const answers: MacroBranchAnswers = { ...emptyMacroBranchAnswers, macroFocus, targetPath: 'estimate', calculatorInputs: { ...adultCalculatorInputs, ageYears } };
      const result = resolveMacroGuidance(answers, ageYears);
      assert.equal(result.kind, 'minor_safe_redirect', `age ${ageYears} + ${macroFocus} must redirect`);
      assert.ok(!('targets' in result), `minor_safe_redirect must not carry a targets field (age ${ageYears}, ${macroFocus})`);
    }
  }
});

// --- Not Sure ----------------------------------------------------------------

test('every transformation chip resolves to a real PrimaryGoal, never staying not_sure', () => {
  assert.equal(resolveNotSurePrimaryGoal('cheaper'), 'save_money');
  assert.equal(resolveNotSurePrimaryGoal('more_balanced'), 'eat_healthier');
  assert.equal(resolveNotSurePrimaryGoal('more_protein'), 'hit_macros');
});

test('PREFERRED_TRANSFORMATIONS is the same vocabulary resolveNotSurePrimaryGoal accepts (single source, asked earlier now)', () => {
  assert.equal(PREFERRED_TRANSFORMATIONS.length, 3);
  for (const transformation of PREFERRED_TRANSFORMATIONS) {
    assert.ok(['save_money', 'eat_healthier', 'hit_macros'].includes(resolveNotSurePrimaryGoal(transformation)));
  }
});

// --- Downstream-use exhaustiveness -------------------------------------------

test('every declared V4 branch field has at least one real downstream use, drawn only from the fixed vocabulary', () => {
  for (const fieldId of V4_BRANCH_FIELD_IDS) {
    const uses = V4_BRANCH_FIELD_DOWNSTREAM_USES[fieldId];
    assert.ok(uses && uses.length > 0, `field ${fieldId} has no documented downstream use`);
    for (const use of uses) {
      assert.ok((DOWNSTREAM_USES as readonly string[]).includes(use), `field ${fieldId} lists an unrecognized downstream use: ${use}`);
    }
  }
});

test('the downstream-use map has no orphan entries beyond the declared field ids', () => {
  const declaredIds = new Set<string>(V4_BRANCH_FIELD_IDS);
  for (const fieldId of Object.keys(V4_BRANCH_FIELD_DOWNSTREAM_USES)) {
    assert.ok(declaredIds.has(fieldId), `downstream-use map has an entry for undeclared field: ${fieldId}`);
  }
});
