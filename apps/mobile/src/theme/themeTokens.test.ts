import assert from 'node:assert/strict';
import test from 'node:test';

import { colors, radius, shadows, spacing, typography } from './okyoTheme.js';
import { recipeColors } from './recipeTheme.js';

test('the app and recipe surfaces share the approved cream canvas', () => {
  assert.equal(colors.background, '#fffdfe');
  assert.equal(colors.cream, '#fffdfe');
  assert.equal(colors.stoneCream, '#fffdfe');
  assert.equal(recipeColors.background, '#fffdfe');
  assert.equal(recipeColors.cream, '#fffdfe');
});

test('card and inset colors remain distinct from the canvas', () => {
  assert.equal(colors.card, '#FFFFFF');
  assert.equal(recipeColors.card, '#FFFFFF');
  assert.equal(colors.creamDeep, '#F4E5CF');
  assert.equal(recipeColors.creamDeep, '#F0DFC8');
});

test('Design System V2 exposes the approved canvas, accents, geometry, and typography', () => {
  assert.equal(colors.canvas, '#fffdfe');
  assert.equal(colors.canvasSunk, '#F4E5CF');
  assert.equal(colors.surfaceMuted, '#FFFCF8');
  assert.equal(colors.savings, '#2F8F5B');
  assert.equal(colors.health, '#E1746C');
  assert.equal(colors.macros, '#6B5BD2');
  assert.equal(colors.macroProtein, '#E1746C');
  assert.equal(colors.macroCarbs, '#E9A23B');
  assert.equal(colors.macroFat, '#6B9ED2');
  assert.equal(spacing.gutter, 20);
  assert.equal(spacing.scrollClearance, 96);
  assert.equal(radius.glass, 34);
  assert.equal(shadows.float.shadowOpacity, 0.12);
  assert.equal(typography.title.fontFamily, 'Inter_900Black');
  assert.equal(typography.numericLarge.fontFamily, 'Inter_800ExtraBold');
});

test('approved text colors meet their intended cream-canvas contrast', () => {
  // Savings is reserved for large metric text and graphic accents.
  assert.ok(contrast(colors.savings, colors.canvas) >= 3);
  assert.ok(contrast(colors.body, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.muted, colors.canvas) >= 3);
});

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? [];
  const [r = 0, g = 0, b = 0] = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
