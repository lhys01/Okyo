import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const pageFiles = [
  'HeroPage.tsx', 'ScanPage.tsx', 'CustomizePage.tsx', 'CustomizeDetailsPage.tsx',
  'AttributionPage.tsx', 'SavingsPage.tsx', 'ValuePage.tsx', 'MeetKikoPage.tsx',
];

test('showcase pages contain the approved product copy and none of the rejected claims or dead paths', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), 'showcase', 'pages');
  const source = [
    ...pageFiles.map((file) => readFileSync(join(pagesDir, file), 'utf8')),
    readFileSync(join(pagesDir, '..', 'showcaseContent.ts'), 'utf8'),
  ].join('\n');
  for (const forbidden of [
    '$6.20', '$17.80', '$11.60',
    'See what a scan includes', '81% healthier', 'Users save an average',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.doesNotMatch(source, /\bkcal\b/i);
  for (const required of [
    'Scan any dish. Recreate it at home.', 'Get the ingredients and full recipe', 'More than just a recipe',
    'Make every recipe yours', 'How did you hear about Okyo?', 'Spend less on the dishes you love',
    'Know what goes into every bite', 'This fox is now your virtual pet',
    'Take photo', 'Upload photo', 'Describe a dish', 'Practical ingredients', 'Cookbook-style steps',
    'Calories', 'Protein', 'Carbs', 'Fat + more', 'Total time', 'Active time', 'Waiting time',
    'Tools', 'Homemade cost', 'Estimated savings', 'More protein', 'Fewer calories', 'Swap ingredient',
    'Simpler steps', 'Cook step-by-step', 'Illustrative example', '$84 saved this month with Okyo',
  ]) {
    assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

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

test('screen two uses the approved full-screen artwork without rebuilt callouts', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'showcase', 'pages', 'ScanPage.tsx'), 'utf8');
  assert.doesNotMatch(source, /scanLine|scanProgress|withRepeat|Ingredients floating|Recipe steps floating|Cook time floating/);
  assert.match(source, /ApprovedArtworkPage/);
  assert.match(source, /approvedOnboarding3/);
});

test('attribution uses six vector icons and no fox or single-letter glyph placeholders', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'showcase', 'pages', 'AttributionPage.tsx'), 'utf8');
  for (const icon of ['UserLove', 'Instagram', 'Tiktok', 'Youtube', 'AppStore', 'Group']) assert.match(source, new RegExp(icon));
  assert.doesNotMatch(source, /kikoHappy|glyph:\s*['"][@ITYAF]['"]/);
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}
