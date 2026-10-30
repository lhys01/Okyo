import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import ts from "typescript";
const screen = readFileSync(join(__dirname, "HealthBranchScreen.tsx"), "utf8");
const visuals = readFileSync(join(__dirname, "HealthVisuals.tsx"), "utf8");
const referenceScreens = readFileSync(
  join(__dirname, "HealthReferenceScreens.tsx"),
  "utf8",
);
const controls = readFileSync(
  join(__dirname, "..", "branch-ui", "BranchControls.tsx"),
  "utf8",
);

test("the first Health CTA says Build my plan without changing later CTAs", () => {
  assert.match(screen, /step === "intro" \? "Build my plan" : "Continue"/);
});

test("all seven current MCQs use the same vertical option rows without tiles or trailing markers", () => {
  const expected = {
    problemOptions: 6,
    barrierOptions: 6,
    mealOptions: 5,
    definitionOptions: 6,
    mealPriorityOptions: 5,
    foodStyleOptions: 6,
    commitmentOptions: 5,
  };
  const sourceFile = ts.createSourceFile("HealthBranchScreen.tsx", screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const [name, count] of Object.entries(expected)) {
    let initializer: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    assert.ok(initializer && ts.isArrayLiteralExpression(initializer), name);
    assert.equal(initializer.elements.length, count, name);
  }
  const layouts = [...screen.matchAll(/<HealthQuestionLayout\b([^>]*)>/g)];
  // Seven MCQs plus the separate final goal picker share the shell.
  assert.equal(layouts.length, 8);
  // Seven MCQs plus the separate goal-type picker use the same row control.
  assert.equal([...screen.matchAll(/<ChoiceRows\b/g)].length, 8);
  assert.doesNotMatch(screen, /ChoiceTiles/);
  assert.match(
    screen,
    /step === ["']foodStyle["'][\s\S]*?<ChoiceRows\s+branch=\{BRANCH\}\s+multi/,
  );
  assert.doesNotMatch(controls, /markerSelected|glyphTile|healthGlyphTile/);
});
test("Health uses the requested fox assets for the three reference screens", () => {
  const refs = [
    ...referenceScreens.matchAll(
      /onboardingV3Assets\.(cutefox\d*|healthReference\w+)/g,
    ),
  ].map((m) => m[1]);
  assert.deepEqual([...new Set(refs)].sort(), [
    "cutefox1",
    "cutefox2",
    "cutefox3",
  ]);
  assert.match(
    screen,
    /const isFinalPlan = step === ["']reveal["'] \|\| step === ["']complete["']/,
  );
  assert.equal([...screen.matchAll(/<HealthPlanSummary /g)].length, 0);
  assert.match(readFileSync(join(__dirname, "BranchPersonalizedPlanScreen.tsx"), "utf8"), /<HealthPlanSummary/);
  assert.match(screen, /transitionStep=\{isFinalPlan \? ["']reveal["'] : step\}/);
  assert.doesNotMatch(screen, /step === ["']problemAcknowledgement["']/);
  assert.doesNotMatch(screen, /step === ["']problemDiagnosis["']/);
  assert.doesNotMatch(screen, /step === ["']cookingFrequency["']/);
  assert.doesNotMatch(screen, /recipeStyle|HealthRevealScreen/);
});
test("Health progress uses the bundled animated gradient in the fixed scaffold header", () => {
  assert.match(
    screen,
    /headerProgress=\{<HealthProgress question=\{progressQuestion\}/,
  );
  assert.match(
    screen,
    /const progressQuestion = variant === 'A' \? Math\.max\(HEALTH_PROGRESS_QUESTION_INDEX\[step\], 1\)/,
  );
  assert.match(visuals, /gradient-1-1920x1080\.mp4/);
  assert.match(visuals, /<VideoView contentFit="cover"/);
  assert.match(visuals, /useVideoPlayer\(HEALTH_PROGRESS_VIDEO/);
  assert.match(visuals, /\{current\}\/\{total\}/);
  assert.doesNotMatch(screen, /getBranchProgress/);
});
test("the health goal picker omits the two removed choices", () => {
  assert.doesNotMatch(screen, /label: ["']Eat healthier meals["']/);
  assert.doesNotMatch(screen, /label: ["']Feel better about portions["']/);
  assert.match(
    screen,
    /const healthGoalTypeOptions[\s\S]*Build more balanced meals/,
  );
  assert.match(
    screen,
    /const healthGoalTypeOptions[\s\S]*Feel steadier after meals/,
  );
});
test("the health goal sliders render without the removed plan summary below them", () => {
  assert.doesNotMatch(screen, /HealthSolutionScreen/);
  assert.doesNotMatch(referenceScreens, /Your healthier\{`\\n`\}food plan is ready\./);
  assert.doesNotMatch(referenceScreens, /Healthier means|Biggest barrier/);
  assert.doesNotMatch(screen, /YOUR GOAL|previewMeta|previewTitle/);
  assert.match(screen, /testID="health-goal-count-slider"/);
  assert.match(screen, /testID="health-goal-duration-slider"/);
  for (const value of ["~520", "34g", "46g", "19g"])
    assert.ok(visuals.includes(`value: '${value}'`));
  assert.match(visuals, /Example nutrition — not your personal target\./);
});
test("Health visual cleanup keeps answer geometry stable and simplifies the interstitial hierarchy", () => {
  assert.match(
    referenceScreens,
    /Let’s make eating\{`\\n`\}healthier feel easier\./,
  );
  assert.match(referenceScreens, /Why Okyo’s\{`\\n`\}approach works/);
  assert.doesNotMatch(
    referenceScreens,
    /A GENTLER WAY FORWARD|WHAT WE HEARD|YOUR STARTING POINT/,
  );
  assert.match(controls, /rowIcon/);
  assert.match(referenceScreens, /finalRows/);
  assert.match(
    referenceScreens,
    /<GoalTimelineCard compact=\{compact\} emphasis="hero" goal=\{goal \?\? null\} \/>/,
  );
  assert.doesNotMatch(referenceScreens, /finalRows[\s\S]*id: 'goal'/);
  assert.match(referenceScreens, /You’re all set!/);
  assert.doesNotMatch(
    referenceScreens,
    /finalPlanAccent|WHERE YOU ARE NOW|WHERE YOU’RE STARTING/,
  );
});
test("the existing canonical preview handoff and Back remain wired", () => {
  const host = readFileSync(join(__dirname, "..", "OnboardingV3.tsx"), "utf8");
  assert.match(
    host,
    /<HealthBranchScreen variant=\{questionVariant\} onBack=\{controller.back\} onComplete=\{controller.beginBranchPlan\}/,
  );
  assert.match(screen, /else void transition\(\{ type: "BACK_PRESSED", skipSteps:/);
  assert.match(screen, /await persistDraft\(\{ \.\.\.draft, branchCompleted: false, currentStep: 'reveal' \}\)/);
});
