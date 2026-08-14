import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('the complete V3 UI contains no rejected product positioning or confirmation gate', () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const source = sourceFiles(root)
    .filter((file) => (file.endsWith('.tsx') || file.endsWith('.ts')) && !file.endsWith('.test.ts'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  for (const forbidden of [
    '$6.20', '$17.80', '$11.60',
    'See what a scan includes', 'Quick Check', 'Does this look right', 'Yes, looks good',
    'hasAcceptedOnboardingRecipe', 'pantry', 'fridge', 'leftovers',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.doesNotMatch(source, /Users save an average[\s\S]{0,80}\$84/i);
  assert.doesNotMatch(source, /81% healthier/i);
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}
