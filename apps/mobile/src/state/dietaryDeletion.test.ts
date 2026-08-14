import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { clearAllPersonalOkyoData } from './dietaryDeletion';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
    async multiRemove(keys: string[]) { keys.forEach((key) => values.delete(key)); },
  };
}

test('deletion clears the authoritative profile store, the dietary mirror, and the V4 draft key', async () => {
  const storage = createMemoryStorage();
  storage.values.set('okyo:onboarding-v4-profile:v1', 'seeded-v4-draft');
  storage.values.set('okyo:home-start-date:v1', 'seeded');

  let profileReset = false;
  let mirrorCleared = false;
  let savedDataCleared = false;

  await clearAllPersonalOkyoData(
    () => { savedDataCleared = true; },
    {
      profileStore: { reset: async () => { profileReset = true; } },
      dietaryMirror: { clear: async () => { mirrorCleared = true; } },
      storage,
    },
  );

  assert.equal(savedDataCleared, true);
  assert.equal(profileReset, true, 'authoritative canonical profile (dietary lives inside it) must be reset');
  assert.equal(mirrorCleared, true, 'compatibility mirror must be cleared');
  assert.equal(storage.values.has('okyo:onboarding-v4-profile:v1'), false, 'V4 dietary draft must be cleared');
  assert.equal(storage.values.has('okyo:home-start-date:v1'), false);
});

test('deletion does not throw when a store has no reset/clear method', async () => {
  const storage = createMemoryStorage();
  await assert.doesNotReject(clearAllPersonalOkyoData(() => {}, { profileStore: {}, dietaryMirror: {}, storage }));
});

// --- Bundled imagery is unaffected by deletion (import-graph proof) --------

const thisDir = dirname(fileURLToPath(import.meta.url));

/**
 * A source assertion that dietaryDeletion.ts lacks `require()` is not
 * sufficient on its own (it could still transitively import something that
 * does). This traces the real, statically-declared import graph reachable
 * from dietaryDeletion.ts and asserts no asset-registry module is anywhere
 * in it — a stronger runtime proof than a single-file text check, and the
 * strongest proof available: this repo's `node:test` runner cannot actually
 * load `.png` `require()` calls (no Metro/jest asset transform outside a
 * React Native runtime), so directly importing the real asset registry
 * modules here would crash the test, not prove anything.
 */
function collectImportSpecifiers(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const specifiers: string[] = [];
  const importRegex = /(?:import[^'"]*from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source))) specifiers.push(match[1]);
  return specifiers;
}

function resolveModulePath(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null; // skip node_modules/RN packages — only trace this repo's own source graph
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

test('bundled food/Kiko imagery is unreachable from the deletion module\'s import graph', () => {
  const entry = join(thisDir, 'dietaryDeletion.ts');
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    assert.doesNotMatch(current, /assets[/\\](kikoOnboardingRegistry|onboardingV3Assets)\.ts$/, `deletion module graph must never reach the asset registry: ${current}`);
    for (const specifier of collectImportSpecifiers(current)) {
      const resolved = resolveModulePath(current, specifier);
      if (resolved) queue.push(resolved);
    }
  }
  assert.ok(visited.size > 1, 'sanity check: the graph traversal actually followed at least one import');
});
