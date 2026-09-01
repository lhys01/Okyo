import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pagesDir = resolve(process.cwd(), 'src/onboarding-v3/showcase/pages');
const attribution = readFileSync(resolve(pagesDir, 'AttributionPage.tsx'), 'utf8');
const pager = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/showcase/ShowcasePager.tsx'), 'utf8');

const options = [
  ['From influencer', 'attribution-option-influencer'],
  ['Instagram', 'attribution-option-instagram'],
  ['TikTok', 'attribution-option-tiktok'],
  ['YouTube', 'attribution-option-youtube'],
  ['App Store search', 'attribution-option-app-store'],
  ['Friends or family', 'attribution-option-friends-family'],
] as const;

test('attribution options are six individually actionable native radio controls', () => {
  assert.match(attribution, /<Pressable/);
  assert.match(attribution, /\s+accessible\s*\n/);
  assert.match(attribution, /accessibilityRole="radio"/);
  assert.match(attribution, /accessibilityState=\{\{ selected \}\}/);
  assert.match(attribution, /onPress=\{onPress\}/);
  assert.match(attribution, /minHeight: 52/);
  for (const [label, testID] of options) {
    assert.match(attribution, new RegExp(`label: '${label.replace(/[?]/g, '\\$&')}'`));
    assert.match(attribution, new RegExp(`testID: '${testID}'`));
  }
  assert.equal(new Set(options.map(([, testID]) => testID)).size, options.length);
});

test('the option list does not collapse its accessible children', () => {
  assert.match(attribution, /accessibilityRole="radiogroup" accessible=\{false\}/);
});

test('the attribution content balances the option group above the fixed CTA on larger screens', () => {
  assert.match(attribution, /layout\.compact \? styles\.contentCompact : styles\.contentBalanced/);
  assert.match(attribution, /contentBalanced: \{ flexGrow: 1, justifyContent: 'center'/);
  assert.match(attribution, /contentCompact: \{ paddingBottom: 12/);
  assert.doesNotMatch(attribution, /contentBalanced: \{[^}]*minHeight/);
});

test('attribution Next is disabled until selection, then enabled and persisted through the existing callback', () => {
  assert.match(pager, /accessibilityLabel=\{showcasePage === 5 \? 'Continue from attribution' : undefined\}/);
  assert.match(pager, /disabled=\{showcasePage === 5 && attribution === null\}/);
  assert.match(pager, /testID=\{showcasePage === 5 \? 'attribution-next' : undefined\}/);
  assert.match(attribution, /const \[selected, setSelected\] = useState<AttributionSource \| null>\(props\.attribution\)/);
  assert.match(attribution, /setSelected\(source\)/);
  assert.match(attribution, /props\.onSelectAttribution\(source\)/);
});
