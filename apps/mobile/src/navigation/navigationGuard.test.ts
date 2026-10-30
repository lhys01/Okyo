import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Regression guard: the legacy ScanScreen must never be reachable again. This
// scans every source file for the exact patterns that would put it back —
// a navigate() call, a route/tab registration, or a MainTabs `screen:` target —
// rather than banning the bare string "ScanScreen" (which would also flag
// harmless historical comments/commit messages).
const forbiddenPatterns: { name: string; pattern: RegExp }[] = [
  { name: "navigate('ScanScreen')", pattern: /navigate\(\s*['"]ScanScreen['"]/ },
  { name: "screen: 'ScanScreen'", pattern: /screen:\s*['"]ScanScreen['"]/ },
  { name: '<Stack.Screen name="ScanScreen">', pattern: /<Stack\.Screen\s+name=["']ScanScreen["']/ },
  { name: '<Tab.Screen name="ScanScreen">', pattern: /<Tab\.Screen\s+name=["']ScanScreen["']/ },
];

const srcRoot = path.join(__dirname, '..');

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

test('no user-facing navigation call targets ScanScreen anywhere in the app', () => {
  const violations: string[] = [];

  for (const filePath of collectSourceFiles(srcRoot)) {
    const contents = fs.readFileSync(filePath, 'utf8');
    for (const { name, pattern } of forbiddenPatterns) {
      if (pattern.test(contents)) {
        violations.push(`${path.relative(srcRoot, filePath)}: matched forbidden pattern "${name}"`);
      }
    }
  }

  assert.deepEqual(violations, [], `Found forbidden ScanScreen navigation references:\n${violations.join('\n')}`);
});

test('ScanScreen.tsx itself no longer exists in the codebase', () => {
  const scanScreenPath = path.join(srcRoot, 'screens', 'ScanScreen.tsx');
  assert.equal(fs.existsSync(scanScreenPath), false, 'screens/ScanScreen.tsx should have been deleted');
});

test('ScanScreen is not a member of the navigation param lists', () => {
  const typesPath = path.join(srcRoot, 'navigation', 'types.ts');
  const contents = fs.readFileSync(typesPath, 'utf8');
  assert.ok(!/^\s*ScanScreen:/m.test(contents), 'ScanScreen should not appear as a route in navigation/types.ts');
});
