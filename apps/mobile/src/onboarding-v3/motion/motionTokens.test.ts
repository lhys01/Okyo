import assert from 'node:assert/strict';
import test from 'node:test';

import { motionEasings, motionTokens } from './motionTokens';

test('motion tokens encode every timing and motion value from the V3 specification', () => {
  assert.deepEqual(motionTokens.splash, { opacityMs: 220, scaleMs: 300, wiggleLegMs: 600, wiggleDelayMs: 300 });
  assert.deepEqual(motionTokens.pagerDot, { durationMs: 180, reduceMotionMs: 100, inactiveWidth: 6, activeWidth: 18, inactiveOpacity: 0.3 });
  assert.deepEqual(motionTokens.cta, { pressInMs: 90, pressOutMs: 140, pressedScale: 0.975, shadowResting: 0.18, shadowPressed: 0.1 });
  assert.equal(motionTokens.settle.pageMs, 250);
  assert.equal(motionTokens.settle.kikoMs, 280);
  assert.equal(motionTokens.stagger.delayStepMs, 50);
  assert.deepEqual(motionTokens.scanSweep, { travelMs: 1450, pauseMs: 550, startPercent: 15, endPercent: 82, reduceMotionPercent: 50, reduceMotionOpacity: 0.5 });
  assert.equal(motionTokens.chipFloat.legMs, 2100);
  assert.deepEqual(motionTokens.attribution, { rowMs: 220, rowDelayStepMs: 40, selectMs: 160, springDamping: 18, springStiffness: 220 });
  assert.deepEqual(motionTokens.graph, { textLeadMs: 260, lineMs: 900, takeoutDelayMs: 380, endpointMs: 200, endpointDelayMs: 1350, footnoteMs: 240, footnoteDelayMs: 1550 });
  assert.deepEqual(motionTokens.approach, { backCardMs: 260, frontCardMs: 280, kikoCardMs: 300, frontDelayMs: 40, kikoDelayMs: 80 });
  assert.deepEqual(motionTokens.value, { bowlMs: 280, tileMs: 220, tileDelayStepMs: 60 });
  assert.deepEqual(motionTokens.meetKiko, { entryMs: 280, doodleMs: 180, doodleDelayStepMs: 40, idleTranslateLegMs: 2000, idleRotateLegMs: 2400, idleDelayMs: 400 });
  assert.deepEqual(motionTokens.nameFox, { entryMs: 260, translateX: 16 });
  assert.deepEqual(motionTokens.loading, { backdropMs: 150, spinnerMs: 800 });
  assert.deepEqual(motionTokens.dietary, { toggleMs: 150 });
  assert.deepEqual(motionEasings, { entrance: 'outQuad', loop: 'inOutQuad', float: 'inOutSin', linear: 'linear' });
});
