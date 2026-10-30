import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const strip = require('../plugins/stripReleaseConsole.js');
test('release transform removes console arguments as well as calls', () => {
  const result = transformSync('console.log(privatePayload()); const result = console.error(secret);', { configFile: false, babelrc: false, plugins: [strip] }).code;
  assert.doesNotMatch(result, /console|privatePayload|secret/);
  assert.match(result, /const result = void 0/);
});
