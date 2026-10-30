import assert from 'node:assert/strict';
import test from 'node:test';

import { canAdvanceTourStep, canDismissTour, computeScrollDelta, computeUsableViewport, isCurrentMeasurement, isFullyInsideViewport, isTargetOnScreen, isValidTourRect, shapeSpotlightRect, shouldRenderTourProgress, shouldRenderTourStep } from './tourGeometry';
import { COACH_DOCK_BOTTOM_OFFSET, COACH_DOCK_ESTIMATED_HEIGHT, COACH_DOCK_HORIZONTAL_INSET, COACH_DOCK_MAX_WIDTH, COACH_DOCK_TARGET_CLEARANCE, KIKO_OVERLAP, KIKO_SIZE } from './coachDockGeometry';

// Real measured values from the iPhone 17 Pro simulator: the Home calendar
// (WeekStrip) sits at y=112, height=64, right under the greeting header.
const CALENDAR_RECT = { height: 64, width: 362, x: 20, y: 112 };
const INSETS_TOP = 59; // Dynamic Island safe area
const BOTTOM_BOUND = 800;

test('regression: the Home calendar counts as on-screen at its real, natural top position', () => {
  // Before the fix this required rect.y >= insetsTop + 140 (≈199), which the
  // calendar's real y=112 never satisfies — and there is nowhere further to
  // scroll (it is already at the top of the ScrollView), so the tour looped
  // forever and step 1 never opened. This is the exact bug reproduction.
  assert.equal(isTargetOnScreen(CALENDAR_RECT, INSETS_TOP, BOTTOM_BOUND), true);
});

test('a target scrolled fully above the visible area is not on-screen', () => {
  const aboveScreen = { height: 64, width: 362, x: 20, y: -100 };
  assert.equal(isTargetOnScreen(aboveScreen, INSETS_TOP, BOTTOM_BOUND), false);
});

test('a target scrolled fully below the visible area is not on-screen', () => {
  const belowScreen = { height: 64, width: 362, x: 20, y: 900 };
  assert.equal(isTargetOnScreen(belowScreen, INSETS_TOP, BOTTOM_BOUND), false);
});

test('a target straddling the bottom edge still counts as on-screen', () => {
  const straddling = { height: 100, width: 362, x: 20, y: 780 };
  assert.equal(isTargetOnScreen(straddling, INSETS_TOP, BOTTOM_BOUND), true);
});

test('regression: a step never renders until its own measurement has committed', () => {
  // The exact reported bug: stepIndex (and therefore the message copy)
  // advances to Grocery (index 4) the instant Next fires, but the measured
  // rects for Grocery have not landed yet — readyStepIndex is still stuck
  // on Calendar's index (0). The gate must refuse to render in this window,
  // rather than pairing new copy with the old, stale spotlight.
  assert.equal(
    shouldRenderTourStep({ active: true, paused: false, ready: true, readyStepIndex: 0, stepIndex: 4 }),
    false,
    'must not render Grocery copy while only Calendar (step 0) has committed rects',
  );
});

test('a step renders once its own measurement has committed', () => {
  assert.equal(
    shouldRenderTourStep({ active: true, paused: false, ready: true, readyStepIndex: 4, stepIndex: 4 }),
    true,
  );
});

test('mid-measurement (ready=false) never renders, regardless of readyStepIndex', () => {
  assert.equal(
    shouldRenderTourStep({ active: true, paused: false, ready: false, readyStepIndex: 4, stepIndex: 4 }),
    false,
  );
});

test('a paused tour (user drilled into a detail screen) never renders even if committed', () => {
  assert.equal(
    shouldRenderTourStep({ active: true, paused: true, ready: true, readyStepIndex: 4, stepIndex: 4 }),
    false,
  );
});

test('an inactive tour never renders', () => {
  assert.equal(
    shouldRenderTourStep({ active: false, paused: false, ready: true, readyStepIndex: 4, stepIndex: 4 }),
    false,
  );
});

test('regression: no partial tour shell is rendered while a step is measuring', () => {
  // The active step changes before its route and target geometry settle.
  // Hide the dim layer, coach copy, and controls together until that exact
  // step has committed, rather than pairing new copy with stale geometry.
  assert.equal(
    shouldRenderTourStep({ active: true, paused: false, ready: false, readyStepIndex: 0, stepIndex: 1 }),
    false,
  );
  assert.equal(
    shouldRenderTourStep({ active: true, paused: false, ready: true, readyStepIndex: 0, stepIndex: 1 }),
    false,
  );
});

const VIEWPORT_PARAMS = { footerHeight: 280, headerHeight: 81, insetsTop: 59, screenHeight: 874 };

test('the focus stage sits strictly between the top bar and the fixed coach dock', () => {
  const viewport = computeUsableViewport({ ...VIEWPORT_PARAMS, margin: 8 });
  assert.equal(viewport.top, 59 + 81 + 8);
  assert.equal(viewport.bottom, 874 - 280 - 8);
});

test('regression: Recommended sitting behind the tab bar must be scrolled up, not left clipped', () => {
  // Reproduces the reported bug: a target whose bottom edge falls past the
  // coach dock's own top edge (screenHeight - footerHeight).
  const viewport = computeUsableViewport({ ...VIEWPORT_PARAMS, margin: 8 });
  const clippedRecommendedCard = { height: 222, width: 349, x: 20, y: 731 };
  const delta = computeScrollDelta(clippedRecommendedCard, viewport, 20);
  assert.ok(delta !== null, 'a card clipped behind the coach dock must trigger a scroll');
  assert.ok(delta! > 0, 'the card sits too low — it must scroll further down (positive delta)');

  // After applying the delta, the card's new position fits with margin.
  const scrolled = { ...clippedRecommendedCard, y: clippedRecommendedCard.y - delta! };
  assert.equal(computeScrollDelta(scrolled, viewport, 20), null, 'once scrolled, the card must fit with no further delta needed');
});

test('a target already fully inside the focus stage is never scrolled', () => {
  const viewport = computeUsableViewport({ ...VIEWPORT_PARAMS, margin: 8 });
  const comfortablyPlaced = { height: 254, width: 362, x: 20, y: viewport.top + 40 };
  assert.equal(computeScrollDelta(comfortablyPlaced, viewport, 20), null);
});

test('a target sitting under the top bar must scroll up (negative delta)', () => {
  const viewport = computeUsableViewport({ ...VIEWPORT_PARAMS, margin: 8 });
  const underHeader = { height: 64, width: 362, x: 20, y: viewport.top - 30 };
  const delta = computeScrollDelta(underHeader, viewport, 20);
  assert.ok(delta !== null && delta < 0, 'a target under the top bar must scroll up, never down');
});

// ─── Fixed coach-dock geometry: the whole point of the persistent shell is
// that these numbers are CONSTANTS, never computed per step or per target. ───

test('the coach dock has stable placement but content-driven height', () => {
  assert.equal(typeof COACH_DOCK_BOTTOM_OFFSET, 'number');
  assert.equal(typeof COACH_DOCK_ESTIMATED_HEIGHT, 'number');
  assert.equal(typeof COACH_DOCK_HORIZONTAL_INSET, 'number');
  assert.equal(typeof COACH_DOCK_MAX_WIDTH, 'number');
  assert.equal(typeof KIKO_SIZE, 'number');
});

test('the coach dock sits above the floating tab bar with a real gap, not flush against it', () => {
  // Tab bar footprint per MainTabs' own tabBarPill: bottom offset 34 + height 70.
  const tabBarTop = 34 + 70;
  assert.ok(COACH_DOCK_BOTTOM_OFFSET > tabBarTop, 'the dock must clear the tab bar, not overlap it');
});

test('the usable stage also clears Kiko where the mascot protrudes above the card', () => {
  const dockFootprint = COACH_DOCK_BOTTOM_OFFSET + COACH_DOCK_ESTIMATED_HEIGHT + (KIKO_SIZE - KIKO_OVERLAP);
  const viewport = computeUsableViewport({ footerHeight: dockFootprint, headerHeight: 64, insetsTop: 0, margin: 12, screenHeight: 874 });
  const cardBehindKiko = { height: 202, width: 170, x: 20, y: viewport.bottom - 202 + 24 };
  assert.ok(computeScrollDelta(cardBehindKiko, viewport, 12)! > 0, 'a recommendation behind Kiko must scroll higher than the card alone');
});

test('Home gains only the dock-derived scroll tail required during the tour', () => {
  assert.equal(COACH_DOCK_TARGET_CLEARANCE, (KIKO_SIZE - KIKO_OVERLAP) + 24);
  assert.ok(COACH_DOCK_TARGET_CLEARANCE > KIKO_SIZE - KIKO_OVERLAP);
});

test('compact Kiko leaves room for the guide copy and the FAB', () => {
  assert.ok(KIKO_SIZE >= 80 && KIKO_SIZE <= 90, `KIKO_SIZE ${KIKO_SIZE} out of range`);
  assert.ok(COACH_DOCK_ESTIMATED_HEIGHT < 130, 'the compact panel must not reserve the previous 152pt bubble');
});

test('progress dots are never part of the tour UI', () => {
  assert.equal(shouldRenderTourProgress(), false);
});

test('spotlights use tightly padded, shape-matched geometry', () => {
  const pill = shapeSpotlightRect({ height: 50, width: 220, x: 80, y: 400 }, 'pill');
  assert.equal(pill.height, 58);
  assert.equal(pill.width, 228);
  assert.equal(pill.borderRadius, 29);
  assert.equal(pill.x + pill.width / 2, 80 + 220 / 2);
  assert.equal(pill.y + pill.height / 2, 400 + 50 / 2);
  const circle = shapeSpotlightRect({ height: 64, width: 64, x: 322, y: 720 }, 'circle');
  assert.equal(circle.width, circle.height);
  assert.equal(circle.borderRadius, circle.width / 2);
  assert.equal(circle.noBorder, true);
});

test('Today’s Ideas uses two independent card cutouts, never one connected section rectangle', () => {
  const first = shapeSpotlightRect({ height: 222, width: 170, x: 20, y: 280 }, 'rounded');
  const second = shapeSpotlightRect({ height: 222, width: 170, x: 202, y: 280 }, 'rounded');
  assert.equal(first.borderRadius, second.borderRadius);
  assert.ok(first.x + first.width < second.x, 'the cards retain a real gap between cutouts');
});

test('invalid or stale measurements never produce a spotlight hole', () => {
  assert.equal(isValidTourRect({ height: 0, width: 200, x: 10, y: 10 }), false);
  assert.equal(isValidTourRect({ height: 40, width: Number.NaN, x: 10, y: 10 }), false);
  assert.equal(isCurrentMeasurement(2, 3, 4, 4), false);
  assert.equal(isCurrentMeasurement(2, 2, 4, 5), false);
});

test('only a fully visible target can be committed after scrolling', () => {
  const viewport = { bottom: 640, top: 100 };
  assert.equal(isFullyInsideViewport({ height: 222, width: 170, x: 20, y: 500 }, viewport, 12), false);
  assert.equal(isFullyInsideViewport({ height: 222, width: 170, x: 20, y: 300 }, viewport, 12), true);
});

test('small and large iPhone focus stages preserve the same complete-target rule', () => {
  const small = computeUsableViewport({ footerHeight: 234, headerHeight: 64, insetsTop: 0, margin: 12, screenHeight: 667 });
  const large = computeUsableViewport({ footerHeight: 234, headerHeight: 83, insetsTop: 0, margin: 12, screenHeight: 874 });
  const card = { height: 222, width: 168, x: 20, y: 180 };
  assert.equal(isFullyInsideViewport(card, small, 12), true);
  assert.equal(isFullyInsideViewport(card, large, 12), true);
  assert.ok(computeScrollDelta({ ...card, y: 400 }, small, 12)! > 0, 'small devices request the smallest necessary scroll');
});

test('Next is single-fire while preparing, while Skip and Done remain available', () => {
  assert.equal(canAdvanceTourStep(true), false);
  assert.equal(canAdvanceTourStep(false), true);
  assert.equal(canAdvanceTourStep(false, false), false, 'anchored copy cannot advance without its visible spotlight');
  assert.equal(canAdvanceTourStep(false, true), true);
  assert.equal(canDismissTour(), true);
});
