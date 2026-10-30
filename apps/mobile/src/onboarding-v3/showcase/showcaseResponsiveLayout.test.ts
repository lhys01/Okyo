import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPACT_SHOWCASE_USABLE_HEIGHT, getShowcaseResponsiveLayout } from './showcaseResponsiveLayout';

test('compact mode is based on safe-area-adjusted usable height rather than a device model', () => {
  const se = getShowcaseResponsiveLayout({ windowHeight: 667, topInset: 20, bottomInset: 0 });
  const standard = getShowcaseResponsiveLayout({ windowHeight: 844, topInset: 47, bottomInset: 34 });
  const large = getShowcaseResponsiveLayout({ windowHeight: 932, topInset: 59, bottomInset: 34 });

  assert.equal(COMPACT_SHOWCASE_USABLE_HEIGHT, 760);
  assert.equal(se.usableHeight, 647);
  assert.equal(se.compact, true);
  assert.equal(standard.compact, false);
  assert.equal(large.compact, false);
  assert.ok(se.heroHeight < standard.heroHeight);
  assert.equal(se.heroHeight, 250);
  assert.equal(standard.heroHeight, 430);
  assert.equal(se.headlineSize, standard.headlineSize);
  assert.equal(se.bodyLineHeight, 19);
});

test('the breakpoint is deterministic at its boundary and guards invalid measurements', () => {
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 809, topInset: 24, bottomInset: 25 }).compact, false);
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 808, topInset: 24, bottomInset: 25 }).compact, true);
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 20, topInset: 30, bottomInset: 10 }).usableHeight, 0);
});

test('larger accessibility text keeps readable base sizing and increases line spacing for scrollable content', () => {
  const standard = getShowcaseResponsiveLayout({ windowHeight: 667, topInset: 20, bottomInset: 0 });
  const largeText = getShowcaseResponsiveLayout({ windowHeight: 667, topInset: 20, bottomInset: 0, fontScale: 1.6 });

  assert.equal(largeText.heroHeight, standard.heroHeight);
  assert.equal(largeText.headlineSize, standard.headlineSize);
  assert.equal(largeText.fontScale, 1.6);
  assert.ok(largeText.headlineLineHeight > standard.headlineLineHeight);
  assert.ok(largeText.bodyLineHeight > standard.bodyLineHeight);
});
