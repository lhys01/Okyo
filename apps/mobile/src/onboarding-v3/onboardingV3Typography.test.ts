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

test('App loads real Manrope Medium, SemiBold, Bold, and ExtraBold font files', () => {
  const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
  const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
  assert.match(packageJson, /@expo-google-fonts\/manrope/);
  for (const font of ['Manrope_500Medium', 'Manrope_600SemiBold', 'Manrope_700Bold', 'Manrope_800ExtraBold']) {
    assert.match(app, new RegExp(font));
  }
  assert.doesNotMatch(app, /Sora|Inter_\d/);
});

test('Okyo-owned production UI has no direct non-system font literals', () => {
  for (const file of sourceFiles(resolve(process.cwd(), 'src')).filter((path) => !path.endsWith('.test.ts'))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /fontFamily:\s*['\"](?:Sora|Inter|Barlow|Arial|sans-serif|system-ui)/, file);
  }
});

test('Design System V2 renders onboarding and the rest of the app in Manrope end to end', () => {
  const root = resolve(process.cwd(), 'src/onboarding-v3');
  const productionSources = sourceFiles(root).filter((file) => !file.endsWith('.test.ts'));
  for (const file of productionSources) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('fontFamilies')) continue;
    // Every onboarding style must reach its face through the onboarding token map,
    // never a raw literal.
    assert.match(source, /onboardingFontFamilies as fontFamilies/, file);
    assert.doesNotMatch(source, /Sora_\d|Inter_\d/, file);
  }
  const theme = readFileSync(resolve(process.cwd(), 'src/theme/okyoTheme.ts'), 'utf8');
  // The whole app, onboarding included, is Manrope end to end.
  assert.match(theme, /fontFamilies[\s\S]*display: 'Manrope_800ExtraBold'/);
  assert.match(theme, /onboardingFontFamilies[\s\S]*display: 'Manrope_800ExtraBold'/);
  assert.match(theme, /onboardingFontFamilies[\s\S]*body: 'Manrope_500Medium'/);
  assert.doesNotMatch(theme, /Sora|Inter_\d/);
  const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
  for (const face of ['Manrope_500Medium', 'Manrope_600SemiBold', 'Manrope_700Bold', 'Manrope_800ExtraBold']) {
    assert.match(app, new RegExp(face), face);
  }
});

test('showcase headlines use the shared Manrope title token', () => {
  const pageStyles = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/showcase/pages/pageStyles.ts'), 'utf8');
  // Titles spread the onboardingTitleFont token instead of an inline family/weight.
  assert.match(pageStyles, /\.\.\.onboardingTitleFont/);
  const theme = readFileSync(resolve(process.cwd(), 'src/theme/okyoTheme.ts'), 'utf8');
  // The token follows the onboarding extraBold face, which is Manrope ExtraBold.
  assert.match(theme, /onboardingTitleFont[\s\S]*fontFamily: onboardingFontFamilies\.extraBold/);
  assert.match(theme, /onboardingFontFamilies[\s\S]*extraBold: 'Manrope_800ExtraBold'/);
});
