import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('repeating decorative motion always consults Reduce Motion', () => {
  const root = resolve(process.cwd(), 'src/onboarding-v3');
  for (const file of sourceFiles(root)) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('withRepeat')) {
      assert.match(source, /useReduceMotion/, `${file} must honor Reduce Motion`);
    }
  }
});

test('onboarding uses no JavaScript intervals and only splash/name-placeholder gates use timeouts', () => {
  const root = resolve(process.cwd(), 'src/onboarding-v3');
  const matches = sourceFiles(root).filter((file) => !file.endsWith('.test.ts')).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return /setInterval|setTimeout/.test(source) ? [file] : [];
  });
  assert.deepEqual(matches.map((file) => file.replace(`${root}/`, '')).sort(), ['screens/SplashScreen.tsx']);
});

test('live Reduce Motion changes cancel the retained decorative splash loop', () => {
  const root = resolve(process.cwd(), 'src/onboarding-v3');
  const splash = readFileSync(join(root, 'screens/SplashScreen.tsx'), 'utf8');
  assert.match(splash, /else \{\s*rotation\.value = 0;/);
});

test('font loading cannot trap the native splash beyond the 1100ms cap', () => {
  const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
  const splash = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/screens/SplashScreen.tsx'), 'utf8');

  assert.match(app, /setTimeout\(\(\) => setFontFallbackElapsed\(true\), 1100\)/);
  assert.match(app, /readyToRender = fontsLoaded \|\| fontFallbackElapsed/);
  assert.match(splash, /targetMs - \(Date\.now\(\) - appStartedAt\)/);
});
