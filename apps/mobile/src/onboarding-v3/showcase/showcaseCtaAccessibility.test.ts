import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';

const pager = readFileSync(join(__dirname, 'ShowcasePager.tsx'), 'utf8');
const attribution = readFileSync(join(__dirname, 'pages/AttributionPage.tsx'), 'utf8');

test('showcase ends before the separately routed fox introduction', () => {
    assert.ok(pager.includes('const introPages = showcasePages.slice(0, -1)'));
    assert.ok(!pager.includes('<MeetKikoPage'));
    assert.ok(pager.includes("if (showcasePage === introPages.length - 1) onFinished()"));
});

test('Showcase footer stays outside pager gesture surface and preserves attribution CTA semantics', () => {
    assert.ok(pager.includes('<View style={styles.content}>{pagerContent}</View>'));
    assert.match(pager, /<Animated\.View[^>]*style=\{styles\.footer\}>/);
    assert.ok(pager.includes('accessibilityLabel={showcasePage === 5 ? \'Continue to food goals\' : undefined}'));
    assert.ok(pager.includes('testID={showcasePage === 5 ? \'attribution-next\' : undefined}'));
    assert.ok(attribution.includes('accessibilityRole="radiogroup"'));
    assert.ok(attribution.includes('accessible={false}'));
});

test('every showcase page has one shared actionable CTA', () => {
    assert.equal((pager.match(/<OnboardingCTA label="Next"/g) ?? []).length, 1);
    assert.equal((pager.match(/testID="meet-kiko-name-fox"/g) ?? []).length, 0);
});

test('forward CTAs have no decorative arrow and the shared back control uses a real icon', () => {
    assert.ok(pager.includes('<OnboardingBackButton onPress={back} />'));
    assert.ok(!pager.includes('meetKikoArrow'));
    assert.ok(!pager.includes('>›</Text>'));
});
