import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPACT_SHOWCASE_USABLE_HEIGHT, getShowcaseResponsiveLayout } from './showcaseResponsiveLayout';

test('compact mode is based on safe-area-adjusted usable height rather than a device model', () => {
  const se = getShowcaseResponsiveLayout({ windowHeight: 667, topInset: 20, bottomInset: 0 });
  const standard = getShowcaseResponsiveLayout({ windowHeight: 852, topInset: 59, bottomInset: 34 });
  const large = getShowcaseResponsiveLayout({ windowHeight: 932, topInset: 59, bottomInset: 34 });

  assert.equal(COMPACT_SHOWCASE_USABLE_HEIGHT, 700);
  assert.equal(se.usableHeight, 647);
  assert.equal(se.compact, true);
  assert.equal(standard.compact, false);
  assert.equal(large.compact, false);
  assert.ok(se.heroHeight < standard.heroHeight);
  assert.ok(se.headlineSize < standard.headlineSize);
  assert.ok(se.bodyLineHeight >= 20);
});

test('the breakpoint is deterministic at its boundary and guards invalid measurements', () => {
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 749, topInset: 24, bottomInset: 25 }).compact, false);
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 748, topInset: 24, bottomInset: 25 }).compact, true);
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 20, topInset: 30, bottomInset: 10 }).usableHeight, 0);
});
