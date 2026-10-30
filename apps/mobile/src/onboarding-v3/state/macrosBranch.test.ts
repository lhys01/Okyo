import assert from "node:assert/strict";
import test from "node:test";
import {
  initialMacrosDraft,
  MACROS_STEPS,
  macrosReducer,
  normalizeMacrosDraft,
  routeForMacrosDraft,
  reuseOnboardingAge,
  type MacrosDraft,
} from "./macrosBranch";

function coreDraft() {
  return {
    ...initialMacrosDraft,
    macroFocus: "low_protein" as const,
    macroBarrier: "time" as const,
    macroOutcome: "more_protein" as const,
    recipePriorities: ["quick_to_make" as const],
  };
}

test("the active path is a compact food-first flow with two conditional target paths", () => {
  assert.deepEqual(MACROS_STEPS, [
    "intro",
    "problem",
    "barrier",
    "diagnosis",
    "mealPriority",
    "targetMode",
    "estimateDetails",
    "knownTargets",
    "reveal",
    "complete",
  ]);
  assert.equal(routeForMacrosDraft(initialMacrosDraft), "problem");
  assert.equal(routeForMacrosDraft(coreDraft()), "targetMode");
});

test("a goal answer creates the canonical goal and removes incompatible old routing", () => {
  const state = macrosReducer(initialMacrosDraft, {
    type: "PROBLEM_SELECTED",
    problem: "low_protein",
  });
  assert.equal(state.macroOutcome, "more_protein");
  assert.equal(state.goal?.displayTitle, "Get enough protein 5 days a week");
  assert.equal(state.currentStep, "intro");
});

test("recipe priorities are capped at two and can be deselected", () => {
  let state = macrosReducer(coreDraft(), {
    type: "RECIPE_PRIORITIES_TOGGLED",
    priority: "tastes_good",
  });
  state = macrosReducer(state, {
    type: "RECIPE_PRIORITIES_TOGGLED",
    priority: "keeps_me_full",
  });
  state = macrosReducer(state, {
    type: "RECIPE_PRIORITIES_TOGGLED",
    priority: "simple_ingredients",
  });
  assert.deepEqual(state.recipePriorities, ["quick_to_make", "tastes_good"]);
  state = macrosReducer(state, {
    type: "RECIPE_PRIORITIES_TOGGLED",
    priority: "tastes_good",
  });
  assert.deepEqual(state.recipePriorities, ["quick_to_make"]);
});

test("target setup skips numeric entry for flexible mode and uses the right conditional target screen", () => {
  assert.equal(
    macrosReducer(
      {
        ...coreDraft(),
        currentStep: "targetMode",
        targetMode: "keep_flexible",
      },
      { type: "NEXT_PRESSED" },
    ).currentStep,
    "reveal",
  );
  assert.equal(
    macrosReducer(
      {
        ...coreDraft(),
        currentStep: "targetMode",
        targetMode: "calculate_estimate",
      },
      { type: "NEXT_PRESSED" },
    ).currentStep,
    "estimateDetails",
  );
  assert.equal(
    macrosReducer(
      {
        ...coreDraft(),
        currentStep: "targetMode",
        targetMode: "known_targets",
      },
      { type: "NEXT_PRESSED" },
    ).currentStep,
    "knownTargets",
  );
});

test("estimate and known-target paths both keep their selection through reveal and completion", () => {
  let estimate = macrosReducer({ ...coreDraft(), currentStep: "targetMode" }, { type: "TARGET_MODE_SELECTED", mode: "calculate_estimate" });
  estimate = macrosReducer(estimate, { type: "ESTIMATE_PROFILE_UPDATED", patch: { ageYears: 32, heightCm: 168, weightKg: 72, biologicalSex: "female", activityHoursPerWeek: 6 } });
  estimate = macrosReducer(estimate, { type: "NEXT_PRESSED" });
  assert.equal(estimate.currentStep, "estimateDetails");
  estimate = macrosReducer(estimate, { type: "NEXT_PRESSED" });
  assert.equal(estimate.currentStep, "reveal");
  assert.equal(estimate.targetMode, "calculate_estimate");
  assert.ok(estimate.calorieTarget);
  estimate = macrosReducer(estimate, { type: "BRANCH_COMPLETED" });
  assert.equal(estimate.currentStep, "complete");

  let known: MacrosDraft = macrosReducer({ ...coreDraft(), currentStep: "targetMode" }, { type: "TARGET_MODE_SELECTED", mode: "known_targets" });
  known = macrosReducer(known, { type: "NEXT_PRESSED" });
  assert.equal(known.currentStep, "knownTargets");
  known = macrosReducer(known, { type: "PROTEIN_TARGET_SAVED", grams: 145 });
  known = macrosReducer(known, { type: "CALORIE_TARGET_SAVED", calories: 2300 });
  known = macrosReducer(known, { type: "NEXT_PRESSED" });
  assert.equal(known.currentStep, "reveal");
  assert.equal(known.targetMode, "known_targets");
  known = macrosReducer(known, { type: "BRANCH_COMPLETED" });
  assert.equal(known.currentStep, "complete");
});

test("known target values validate predictable whole-number increments", () => {
  let state = macrosReducer(coreDraft(), {
    type: "PROTEIN_TARGET_SAVED",
    grams: 155,
  });
  state = macrosReducer(state, {
    type: "CALORIE_TARGET_SAVED",
    calories: 2325,
  });
  state = macrosReducer(state, { type: "CARB_TARGET_SAVED", grams: 250 });
  state = macrosReducer(state, { type: "FAT_TARGET_SAVED", grams: 70 });
  assert.deepEqual(
    [
      state.proteinTargetGrams,
      state.calorieTarget,
      state.carbTargetGrams,
      state.fatTargetGrams,
    ],
    [155, 2325, 250, 70],
  );
  assert.equal(
    macrosReducer(state, { type: "CALORIE_TARGET_SAVED", calories: 2310 })
      .calorieTarget,
    2325,
  );
});

test("estimate profile preserves ages 13 through 100 and marks under-18 users as minors", () => {
  for (const age of [13, 17, 18, 100]) {
    const normalized = normalizeMacrosDraft({
      ...initialMacrosDraft,
      estimateProfile: { ...initialMacrosDraft.estimateProfile, ageYears: age },
    });
    assert.equal(normalized.estimateProfile.ageYears, age);
    assert.equal(normalized.estimateProfile.isMinor, age < 18);
  }
});

test("the earlier onboarding age is reused without resetting saved activity or manual targets", () => {
  const draft = normalizeMacrosDraft({
    ...initialMacrosDraft,
    targetMode: 'calculate_estimate',
    estimateProfile: {
      ...initialMacrosDraft.estimateProfile,
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      biologicalSex: 'male',
      goal: 'maintain',
      activityHoursPerWeek: 28,
    },
  });
  const reused = reuseOnboardingAge(draft, 32);
  assert.equal(reused.estimateProfile.ageYears, 32);
  assert.equal(reused.estimateProfile.activityHoursPerWeek, 28);
  assert.ok(reused.calorieTarget);
  assert.equal(reuseOnboardingAge(reused, null).estimateProfile.ageYears, 32);
  const manual = { ...draft, targetMode: 'known_targets' as const, calorieTarget: 2400 };
  assert.equal(reuseOnboardingAge(manual, 32).calorieTarget, 2400);
});

test("weekly activity survives normalization and changes a macro estimate without changing age", () => {
  const base = {
    ...coreDraft(),
    targetMode: 'calculate_estimate' as const,
    estimateProfile: {
      ...initialMacrosDraft.estimateProfile,
      ageYears: 32,
      heightCm: 180,
      weightKg: 80,
      biologicalSex: 'male' as const,
      goal: 'maintain' as const,
      activityHoursPerWeek: 0,
    },
  };
  const zero = macrosReducer(base, { type: 'ESTIMATE_PROFILE_UPDATED', patch: { activityHoursPerWeek: 0 } });
  const middle = macrosReducer(zero, { type: 'ESTIMATE_PROFILE_UPDATED', patch: { activityHoursPerWeek: 28 } });
  const max = macrosReducer(middle, { type: 'ESTIMATE_PROFILE_UPDATED', patch: { activityHoursPerWeek: 56 } });
  assert.ok(zero.calorieTarget && middle.calorieTarget && max.calorieTarget);
  assert.ok(zero.calorieTarget < middle.calorieTarget && middle.calorieTarget < max.calorieTarget);
  assert.equal(max.estimateProfile.ageYears, 32);
  assert.equal(normalizeMacrosDraft(max).estimateProfile.activityHoursPerWeek, 56);
});

test("the estimate pace slider is bounded and keeps the calorie estimate tied to the selected direction", () => {
  const profile = {
    ...coreDraft(),
    estimateProfile: {
      ...initialMacrosDraft.estimateProfile,
      ageYears: 28,
      heightCm: 168,
      weightKg: 54.4,
      biologicalSex: "female" as const,
      activityLevel: "lightly_active" as const,
      goal: "maintain" as const,
    },
  };
  const gaining = macrosReducer(profile, {
    type: "WEEKLY_CHANGE_SELECTED",
    pounds: 2,
  });
  assert.equal(gaining.weeklyChangePounds, 2);
  assert.equal(gaining.estimateProfile.goal, "build_muscle");
  assert.equal(gaining.estimateProfile.desiredRatePerWeek, "moderate");
  assert.ok(gaining.calorieTarget);
  const unchanged = macrosReducer(gaining, {
    type: "WEEKLY_CHANGE_SELECTED",
    pounds: 2.5,
  });
  assert.equal(unchanged.weeklyChangePounds, 2);
  const losing = macrosReducer(gaining, {
    type: "WEEKLY_CHANGE_SELECTED",
    pounds: -0.5,
  });
  assert.equal(losing.estimateProfile.goal, "lose_fat");
  assert.equal(losing.estimateProfile.desiredRatePerWeek, "slow");
  assert.ok(losing.calorieTarget);
  assert.ok(gaining.calorieTarget);
  assert.ok(
    losing.calorieTarget < gaining.calorieTarget,
    "calories should move with the selected gain/loss direction",
  );
  const incomplete = macrosReducer(losing, {
    type: "ESTIMATE_PROFILE_UPDATED",
    patch: { ageYears: null },
  });
  assert.equal(incomplete.calorieTarget, null);
});

test("estimate calorie targets recalculate when the user changes their goal", () => {
  const profile = {
    ...coreDraft(),
    targetMode: "calculate_estimate" as const,
    estimateProfile: {
      ...initialMacrosDraft.estimateProfile,
      ageYears: 28,
      heightCm: 168,
      weightKg: 68,
      biologicalSex: "female" as const,
      activityLevel: "lightly_active" as const,
      goal: "maintain" as const,
    },
  };
  const calculated = macrosReducer(profile, {
    type: "ESTIMATE_PROFILE_UPDATED",
    patch: {},
  });
  assert.ok(calculated.calorieTarget);
  const baseline = calculated.calorieTarget;
  const changed = macrosReducer(calculated, {
    type: "CALORIE_TARGET_SAVED",
    calories: 2400,
  });
  const adjusted = macrosReducer(changed, {
    type: "WEEKLY_CHANGE_SELECTED",
    pounds: 1,
  });
  assert.notEqual(adjusted.calorieTarget, baseline);
  assert.notEqual(adjusted.calorieTarget, 2400);
  assert.equal(adjusted.calorieTargetManuallyEdited, false);
  const resized = macrosReducer(adjusted, {
    type: "ESTIMATE_PROFILE_UPDATED",
    patch: { weightKg: 80 },
  });
  assert.notEqual(resized.calorieTarget, adjusted.calorieTarget);
});

test("editing targets from the final plan routes back to the selected target controls", () => {
  const calculated = {
    ...coreDraft(),
    targetMode: "calculate_estimate" as const,
    currentStep: "complete" as const,
    branchCompleted: true,
  };
  const known = { ...calculated, targetMode: "known_targets" as const };
  assert.equal(
    macrosReducer(calculated, { type: "EDIT_TARGETS_PRESSED" }).currentStep,
    "estimateDetails",
  );
  assert.equal(
    macrosReducer(known, { type: "EDIT_TARGETS_PRESSED" }).currentStep,
    "knownTargets",
  );
});

test("legacy drafts migrate into the compact model without dropping answers or completion", () => {
  const migrated = normalizeMacrosDraft({
    version: 3,
    macroFocus: "more_protein",
    macroBarrier: "meal_prep_time",
    mealPriority: "quick_to_make",
    proteinTargetGrams: 140,
    calorieTarget: 2200,
  });
  assert.equal(migrated.version, 4);
  assert.equal(migrated.macroFocus, "low_protein");
  assert.equal(migrated.macroBarrier, "time");
  assert.deepEqual(migrated.recipePriorities, ["quick_to_make"]);
  assert.equal(migrated.targetMode, "known_targets");
  const completed = normalizeMacrosDraft({
    ...migrated,
    branchCompleted: true,
  });
  assert.equal(completed.currentStep, "complete");
});
