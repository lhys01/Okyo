import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');

test('Cook Together and its CrowdPlay call bridge are fully removed', () => {
  for (const relativePath of [
    'screens/CookTogetherScreen.tsx',
    'features/cookTogether/cookTogetherSession.ts',
    'features/cookTogether/crowdPlayBridge.ts',
    'plugins/withCrowdPlay.js',
  ]) {
    const location = relativePath.startsWith('plugins/') ? resolve(root, relativePath) : resolve(root, 'src', relativePath);
    assert.equal(existsSync(location), false, relativePath);
  }
  const source = [
    'navigation/AppNavigator.tsx',
    'navigation/types.ts',
    'screens/RecipeDetailScreen.tsx',
    'components/RecipePrimaryActions.tsx',
  ].map((file) => readFileSync(resolve(root, 'src', file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /CookTogether|roomCode|joinCall|CallEngine|CrowdPlayConsentView/);
  assert.doesNotMatch(readFileSync(resolve(root, 'app.json'), 'utf8'), /withCrowdPlay|CrowdPlay/);
});
