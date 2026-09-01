import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_MASCOT_NAME, MASCOT_NAME_MAX_LENGTH, sanitizeMascotName } from './mascotName';

test('mascot names are trimmed, defaulted, and capped at forty characters', () => {
  assert.equal(sanitizeMascotName('  Miso  '), 'Miso');
  assert.equal(sanitizeMascotName('   '), DEFAULT_MASCOT_NAME);
  assert.equal(sanitizeMascotName(null), DEFAULT_MASCOT_NAME);
  const longName = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  assert.equal(sanitizeMascotName(longName), 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN');
  assert.equal(sanitizeMascotName(longName).length, MASCOT_NAME_MAX_LENGTH);
  assert.equal(sanitizeMascotName('  ルナ  '), 'ルナ');
  assert.equal(sanitizeMascotName('Zoë'), 'Zoë');
});
