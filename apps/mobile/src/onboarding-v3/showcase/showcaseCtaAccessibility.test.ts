import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';

const pager = readFileSync(join(__dirname, 'ShowcasePager.tsx'), 'utf8');
const attribution = readFileSync(join(__dirname, 'pages/AttributionPage.tsx'), 'utf8');

test('Meet Kiko CTA is a native Pressable in the fixed footer', () => {
    assert.ok(pager.includes('{showcasePage === 6 ? ('));
    assert.ok(pager.includes('<Pressable'));
    assert.ok(pager.includes('testID="meet-kiko-name-fox"'));
    assert.ok(pager.includes('accessibilityLabel="Name your fox"'));
    assert.ok(pager.includes('accessibilityRole="button"'));
    assert.ok(pager.includes('accessibilityState={{ disabled: false }}'));
    assert.ok(pager.includes('onPress={onFinished}'));
    assert.ok(pager.indexOf('</PagerView>') < pager.indexOf('testID="meet-kiko-name-fox"'));
});

test('Showcase footer stays outside pager gesture surface and preserves attribution CTA semantics', () => {
    assert.ok(pager.includes('<View style={styles.content}>{pagerContent}</View>'));
    assert.ok(pager.includes('<View style={styles.footer}>'));
    assert.ok(pager.includes('accessibilityLabel={showcasePage === 5 ? \'Continue from attribution\' : undefined}'));
    assert.ok(pager.includes('testID={showcasePage === 5 ? \'attribution-next\' : undefined}'));
    assert.ok(attribution.includes('accessibilityRole="radiogroup"'));
    assert.ok(attribution.includes('accessible={false}'));
});

test('every showcase page has one shared actionable CTA', () => {
    assert.equal((pager.match(/<OnboardingCTA label="Next"/g) ?? []).length, 1);
    assert.equal((pager.match(/testID="meet-kiko-name-fox"/g) ?? []).length, 1);
});

test('forward CTAs have no decorative arrow and the shared back control uses a real icon', () => {
    assert.ok(pager.includes('<OnboardingBackButton onPress={back} />'));
    assert.ok(pager.includes('<Text maxFontSizeMultiplier={1.2} style={styles.meetKikoLabel}>Next</Text>'));
    assert.ok(!pager.includes('meetKikoArrow'));
    assert.ok(!pager.includes('>›</Text>'));
});
