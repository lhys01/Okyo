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

test('App loads real Inter Medium, SemiBold, Bold, and Black font files', () => {
  const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
  const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
  assert.match(packageJson, /@expo-google-fonts\/inter/);
  for (const font of ['Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold', 'Inter_800ExtraBold', 'Inter_900Black']) {
    assert.match(app, new RegExp(font));
  }
});

test('Okyo-owned production UI has no direct non-system font literals', () => {
  for (const file of sourceFiles(resolve(process.cwd(), 'src')).filter((path) => !path.endsWith('.test.ts'))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /fontFamily:\s*['\"](?:Sora|Barlow|Arial|sans-serif|system-ui)/, file);
  }
});

test('Design System V2 keeps V3 on the shared Inter family', () => {
  const root = resolve(process.cwd(), 'src/onboarding-v3');
  const productionSources = sourceFiles(root).filter((file) => !file.endsWith('.test.ts'));
  for (const file of productionSources) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('fontFamilies')) continue;
    assert.match(source, /onboardingFontFamilies as fontFamilies/, file);
    assert.doesNotMatch(source, /Sora_\d/, file);
  }
  const theme = readFileSync(resolve(process.cwd(), 'src/theme/okyoTheme.ts'), 'utf8');
  assert.match(theme, /fontFamilies[\s\S]*display: 'Inter_900Black'/);
  assert.match(theme, /onboardingFontFamilies[\s\S]*display: fontFamilies\.display/);
});
