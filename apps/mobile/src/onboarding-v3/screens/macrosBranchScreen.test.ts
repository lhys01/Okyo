import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const screen = readFileSync(join(__dirname, "MacrosBranchScreen.tsx"), "utf8");
const visuals = readFileSync(join(__dirname, "MacrosVisuals.tsx"), "utf8");

test("the first Macros CTA says Build my plan without changing later CTAs", () => {
  assert.match(screen, /step === "intro" \? "Build my plan" : "Continue"/);
});

test("macros uses the shared onboarding shell, hides the intro count, and keeps a dynamic compact progress bar", () => {
  assert.match(screen, /<BranchScaffold/);
  assert.match(screen, /step === "intro"[\s\S]*styles\.progressSpacer/);
  assert.match(
    screen,
    /<HealthProgress question=\{progress\} total=\{progressTotal\}/,
  );
  assert.match(screen, /transitionOrder=\{MACROS_STEPS\}/);
});

test("the compact flow contains the promised goal, obstacle, acknowledgement, priorities, targets, and plan copy", () => {
  for (const copy of [
    "Eat what you like.",
    "Make the numbers work.",
    "What do you want help with most?",
    "What usually makes that difficult?",
    "What should every recipe get right?",
    "How should we set your targets?",
    "Calculate an estimate for me",
    "I already know my targets",
    "Keep things flexible for now",
  ])
    assert.ok(screen.includes(copy), copy);
  for (const option of [
    "Get enough protein",
    "Stay closer to my calories",
    "Balance my macros",
    "Understand portions",
    "Spend less time tracking",
    "Macro-friendly food feels boring",
    "Eating out throws me off",
    "Planning takes too much effort",
  ])
    assert.ok(screen.includes(option), option);
});

test("priorities use accessible two-column tiles and enforce the two-choice state model", () => {
  assert.match(screen, /accessibilityRole="checkbox"/);
  assert.match(screen, /Choose up to two priorities\./);
  assert.match(screen, /width: "48%"/);
  assert.match(screen, /RECIPE_PRIORITIES_TOGGLED/);
});

test("target choice is separated from estimate details and age is reused from onboarding", () => {
  assert.match(
    screen,
    /label="Daily protein"[\s\S]*min=\{40\}[\s\S]*max=\{350\}[\s\S]*step=\{5\}/,
  );
  for (const copy of [
    "Set your starting point",
    "A few quick details help Okyo estimate a starting daily target.",
    "Current weight",
    "How do you want your weight to change?",
    "Weekly activity",
    "YOUR STARTING DAILY TARGET",
    "Estimate only — not medical advice.",
    "Non-binary",
  ])
    assert.ok(screen.includes(copy), copy);
  assert.match(
    screen,
    /label="Height"[\s\S]*max=\{84\}[\s\S]*min=\{48\}[\s\S]*step=\{1\}/,
  );
  assert.match(
    screen,
    /label="Current weight"[\s\S]*max=\{350\}[\s\S]*min=\{80\}[\s\S]*step=\{1\}/,
  );
  assert.match(
    screen,
    /label="How do you want your weight to change\?"[\s\S]*max=\{2\}[\s\S]*min=\{-2\}[\s\S]*step=\{0\.5\}/,
  );
  assert.match(screen, /variant="weightChange"/);
  assert.match(screen, /reuseOnboardingAge\(experimentDraft, ageYears\)/);
  assert.doesNotMatch(screen, /testID="macros-age-slider"/);
  assert.match(
    screen,
    /function EstimateDetails[\s\S]*label="Weekly activity"[\s\S]*max=\{56\}[\s\S]*min=\{0\}[\s\S]*step=\{1\}[\s\S]*value=\{profile\.activityHoursPerWeek \?\? null\}/,
  );
  assert.match(screen, /state\.targetMode === "calculate_estimate" && state\.estimateProfile\.ageYears === null/);
  assert.doesNotMatch(screen, /testID="macros-estimated-calories-slider"/);
  assert.doesNotMatch(screen, /Based on the details above\./);
  assert.doesNotMatch(screen, /You can change this anytime\./);
  assert.doesNotMatch(
    screen,
    /Use these three sliders to shape an editable daily food recommendation\./,
  );
  assert.doesNotMatch(
    screen,
    /This is your target\. You can change it anytime\./,
  );
});

test("final plan keeps distinct color treatments for each summary row", () => {
  for (const color of ["#FDE9F0", "#EAF8EF", "#FFF5E4"])
    assert.ok(visuals.includes(color), color);
  assert.doesNotMatch(visuals, /Starting with/);
  assert.doesNotMatch(visuals, /Biggest barrier/);
  assert.match(visuals, /Your daily targets/);
  assert.match(visuals, /Edit daily targets/);
  assert.match(visuals, /Daily calories/);
  assert.match(visuals, /Carbohydrates/);
});
