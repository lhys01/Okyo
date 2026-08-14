import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

/**
 * Regression test for the recursive-test-discovery fix (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 02, correction #6/#7). The old "test" script passed a double-star glob
 * pattern for the invoking shell to expand; under /bin/sh (what `npm test`
 * actually spawns) that glob only expands one directory level, silently
 * dropping any test file nested two or more levels deep. Verified empirically
 * before this fix: the shell-glob form discovered 435 tests total, while
 * `node --import tsx --test` with no path args (Node's own recursive
 * discovery, positional-arg-free) discovered 449 — the same 14 pre-existing
 * failures either way, zero new failures, but 14 more real tests actually run.
 */
test('the test script uses recursive discovery, not a shell-expanded glob', () => {
  const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
  const testScriptMatch = packageJson.match(/"test":\s*"([^"]+)"/);
  assert.ok(testScriptMatch, 'no "test" script found in package.json');
  const testScript = testScriptMatch![1];

  assert.doesNotMatch(testScript, /\*\*/, 'test script still uses a shell-expanded ** glob, which under-covers nested test files');
  assert.match(testScript, /^node --import tsx --test\s*$/, 'test script should be the bare recursive form with no path arguments');
});

test('at least one *.test.ts file exists two or more directories below src (proves nested discovery matters)', () => {
  let foundNestedTestFile = false;
  const walk = (dir: string, depth: number) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (depth >= 2 && entry.name.endsWith('.test.ts')) foundNestedTestFile = true;
    }
  };
  walk(resolve(process.cwd(), 'src'), 0);
  assert.ok(foundNestedTestFile, 'expected at least one *.test.ts file nested 2+ directories below src');
});
