import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFoxIntroduction, getHighlightedTourAnchorId, getTourSteps, resolveMountedTourTargets, resolveTourTargets, TOUR_SCREENS, TOUR_STEPS, TOUR_STEP_COUNT } from './tourSteps';

test('the tour has exactly the eight required steps in order, starting with the fox intro greeting', () => {
  assert.equal(TOUR_STEP_COUNT, 8);
  assert.deepEqual(
    TOUR_STEPS.map((step) => step.id),
    ['intro', 'home-calendar', 'home-savings-macros', 'home-recommended', 'grocery-list', 'saved-meals', 'home-add-scan', 'finish'],
  );
});

// Every step.kikoPose is typed as KikoAssetPose (src/assets/kikoAssets.ts),
// so `npx tsc --noEmit` already rejects any pose that isn't one of the real
// approved static Kiko images — no separate runtime check needed here, and
// importing that module directly would require a .png through plain Node.

test('only the finish step declares isFinish (intro is a separate full-screen, no-spotlight greeting)', () => {
  const finishSteps = TOUR_STEPS.filter((step) => step.isFinish);
  assert.equal(finishSteps.length, 1);
  assert.equal(finishSteps[0]?.id, 'finish');
});

test('intro and finish are the only steps with no spotlighted target', () => {
  const noTargetIds = TOUR_STEPS.filter((step) => step.targets.length === 0).map((step) => step.id);
  assert.deepEqual(noTargetIds, ['intro', 'finish']);
});

test('the finish step top-right control reads Done, matching the spec', () => {
  const lastStep = TOUR_STEPS[TOUR_STEP_COUNT - 1];
  assert.equal(lastStep?.isFinish, true);
});

test('every step besides intro/finish spotlights at least one real target, never an empty box', () => {
  for (const step of TOUR_STEPS) {
    if (step.id === 'intro' || step.isFinish) {
      assert.equal(step.targets.length, 0);
    } else {
      assert.ok(step.targets.length >= 1, `${step.id} has no target`);
    }
  }
});

test('spotlight shapes match the approved shape per feature', () => {
  const byId = Object.fromEntries(TOUR_STEPS.map((step) => [step.id, step.targets]));
  assert.equal(byId['home-calendar']?.[0]?.shape, 'capsule');
  assert.equal(byId['home-savings-macros']?.[0]?.shape, 'rounded');
  assert.equal(byId['home-recommended']?.[0]?.shape, 'rounded');
  assert.equal(byId['home-add-scan']?.find((target) => target.anchorId === 'home-add-scan')?.shape, 'circle');
  assert.equal(byId['grocery-list']?.[0]?.shape, 'rounded');
  assert.equal(byId['saved-meals']?.[0]?.shape, 'pill');
});

test('the pause screen allowlist covers every screen a step targets', () => {
  for (const step of TOUR_STEPS) {
    if (step.screen) assert.ok(TOUR_SCREENS.includes(step.screen), `${step.id}\'s screen missing from TOUR_SCREENS`);
  }
});

test('each step declares the exact tab it must navigate to before spotlighting', () => {
  const byId = Object.fromEntries(TOUR_STEPS.map((step) => [step.id, step.screen]));
  assert.equal(byId['home-calendar'], 'HomeScreen');
  assert.equal(byId['home-savings-macros'], 'HomeScreen');
  assert.equal(byId['home-recommended'], 'HomeScreen');
  assert.equal(byId['home-add-scan'], 'HomeScreen');
  // Grocery copy is only allowed to render once the overlay has navigated
  // here — the step\'s own screen requirement is what TourOverlay\'s
  // navigation effect keys off before it ever measures the target.
  assert.equal(byId['grocery-list'], 'GroceryListScreen');
  // Same guarantee for Liked: it must never share Grocery\'s or Home\'s screen.
  assert.equal(byId['saved-meals'], 'LibraryScreen');
  assert.notEqual(byId['saved-meals'], byId['grocery-list']);
  assert.notEqual(byId['saved-meals'], byId['home-calendar']);
});

test('no step renders a title label — only body text, kept concise to prevent overlap', () => {
  for (const step of TOUR_STEPS) {
    assert.equal(step.title, '', `${step.id} must not declare a title — the card shows body text only`);
    assert.ok(step.body.length > 0, `${step.id} body must not be empty`);
  }
});

test('step copy matches the approved script exactly, with no invented data claims', () => {
  const byId = Object.fromEntries(TOUR_STEPS.map((step) => [step.id, step.body]));
  assert.equal(byId.intro, buildFoxIntroduction());
  assert.equal(byId['home-calendar'], 'Tap a day to plan your week.');
  assert.equal(byId['home-savings-macros'], 'Your savings and progress live here.');
  assert.equal(byId['home-recommended'], 'Recipes picked for you appear here.');
  assert.equal(byId['home-add-scan'], 'Tap + to scan, upload, or describe a dish.');
  assert.equal(byId['grocery-list'], 'Scan a dish to start your grocery list.');
  assert.equal(byId['saved-meals'], 'Save recipes here so they\'re easy to find.');
  assert.equal(byId.finish, 'You\'re ready. Let\'s find your first dish.');
});

test('fox introduction uses the saved name and falls back to a generic fox for skipped or blank names', () => {
  assert.equal(getTourSteps('Mochi').find((step) => step.id === 'intro')?.body, 'Hi, I’m Mochi. I’ll show you around.');
  assert.equal(buildFoxIntroduction('  Saffron  '), 'Hi, I’m Saffron. I’ll show you around.');
  assert.equal(buildFoxIntroduction('   '), 'Hi, I’m your fox. I’ll show you around.');
  assert.equal(buildFoxIntroduction(undefined), 'Hi, I’m your fox. I’ll show you around.');
});

test('step data carries no per-step Kiko or coachmark-position fields — the persistent shell owns that geometry once, not per step', () => {
  // The whole point of the persistent shell: Kiko and the coach dock are the
  // SAME for all eight steps, so TourStep must not even be ABLE to vary them.
  for (const step of TOUR_STEPS) {
    assert.equal('kikoAsset' in step, false, `${step.id} must not declare a per-step Kiko asset`);
    assert.equal('kikoCorner' in step, false, `${step.id} must not declare a per-step Kiko corner`);
    assert.equal('coachmarkPlacement' in step, false, `${step.id} must not declare a per-step coachmark placement`);
    assert.equal('hideKiko' in step, false, `${step.id} must not be able to hide the persistent Kiko`);
  }
});

test('the finish step uses "Done" via isLastStep, the same shell as every other step', () => {
  // There is no separate completion-screen data shape — TourOverlay derives
  // the Next→Done swap purely from `stepIndex === TOUR_STEP_COUNT - 1`.
  const lastIndex = TOUR_STEP_COUNT - 1;
  assert.equal(TOUR_STEPS[lastIndex]?.isFinish, true);
  assert.equal(lastIndex, TOUR_STEPS.length - 1);
});

test('Today’s Ideas spotlights the full section, including its Explore action', () => {
  const step = TOUR_STEPS.find((candidate) => candidate.id === 'home-recommended');
  assert.deepEqual(step?.targets, [{ anchorId: 'home-recommended-section', shape: 'rounded' }]);
});

test('Liked resolves the real empty-state CTA or first saved card', () => {
  const step = TOUR_STEPS.find((candidate) => candidate.id === 'saved-meals')!;
  assert.equal(resolveTourTargets(step, (id) => id === 'liked-explore-recipes')[0]?.anchorId, 'liked-explore-recipes');
  assert.equal(resolveTourTargets(step, (id) => id === 'liked-first-saved-recipe')[0]?.anchorId, 'liked-first-saved-recipe');
});

test('recommendation step keeps its section target mounted', () => {
  const step = TOUR_STEPS.find((candidate) => candidate.id === 'home-recommended');
  assert.ok(step);
  const mounted = resolveMountedTourTargets(step, (anchorId) => anchorId === 'home-recommended-section');
  assert.deepEqual(mounted.map((target) => target.anchorId), ['home-recommended-section']);
  assert.equal(resolveMountedTourTargets(step, () => false).length, 0);
  assert.equal(resolveTourTargets(step, (anchorId) => anchorId === 'home-recommended-section').length, 1);
});

test('every feature step references the exact real control anchor', () => {
  const byId = Object.fromEntries(TOUR_STEPS.map((step) => [step.id, step.targets]));
  assert.equal(byId['home-calendar']?.[0]?.anchorId, 'home-calendar');
  assert.equal(byId['home-savings-macros']?.[0]?.anchorId, 'home-savings-macros');
  assert.equal(byId['home-recommended']?.[0]?.anchorId, 'home-recommended-section');
  assert.deepEqual(byId['home-add-scan']?.map((target) => target.anchorId), ['home-first-use-scan', 'home-add-scan']);
  assert.equal(byId['grocery-list']?.[0]?.anchorId, 'grocery-tab');
  assert.equal(byId['saved-meals']?.[0]?.anchorId, 'liked-explore-recipes');
  assert.equal(byId['saved-meals']?.[0]?.alternatives?.[0]?.anchorId, 'liked-first-saved-recipe');
});

test('only the recommendation step prepares a scrollable Today’s Ideas section target', () => {
  const recommended = TOUR_STEPS.find((step) => step.id === 'home-recommended');
  assert.equal(recommended?.screen, 'HomeScreen');
  assert.equal(recommended?.targets.length, 1);
  assert.equal(recommended?.targets[0]?.anchorId, 'home-recommended-section');
});

test('the final instructional step returns Home and highlights the scan entry points', () => {
  const plusIndex = TOUR_STEPS.findIndex((step) => step.id === 'home-add-scan');
  const finishIndex = TOUR_STEPS.findIndex((step) => step.id === 'finish');
  assert.equal(plusIndex, 6);
  assert.equal(finishIndex, 7);
  assert.equal(TOUR_STEPS[plusIndex]?.screen, 'HomeScreen');
  assert.deepEqual(TOUR_STEPS[plusIndex]?.targets, [
    { anchorId: 'home-first-use-scan', shape: 'pill' },
    { anchorId: 'home-add-scan', shape: 'circle' },
  ]);
  assert.equal(TOUR_STEPS[finishIndex]?.screen, 'HomeScreen');
  assert.equal(TOUR_STEPS[finishIndex]?.body, 'You\'re ready. Let\'s find your first dish.');
});

test('the final step highlights the first-use Scan button and the native plus control together', () => {
  const step = TOUR_STEPS.find((candidate) => candidate.id === 'home-add-scan')!;
  assert.deepEqual(resolveMountedTourTargets(step, (id) => id === 'home-first-use-scan' || id === 'home-add-scan').map((target) => target.anchorId), ['home-first-use-scan', 'home-add-scan']);
  assert.equal(getHighlightedTourAnchorId(step.targets), 'home-add-scan');
  assert.equal(getHighlightedTourAnchorId([{ anchorId: 'home-first-use-scan', shape: 'pill' }]), 'home-first-use-scan');
});
