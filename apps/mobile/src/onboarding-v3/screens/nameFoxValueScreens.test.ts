import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const valueScreens = readFileSync(join(__dirname, 'NameFoxValueScreens.tsx'), 'utf8');
const nameFox = readFileSync(join(__dirname, 'NameFoxScreen.tsx'), 'utf8');
const assets = readFileSync(join(__dirname, '../assets/onboardingV3Assets.ts'), 'utf8');

test('fox naming hands off to two native value screens before submitting the existing name event', () => {
  assert.match(nameFox, /const \[valueScreen, setValueScreen\] = useState<0 \| 1 \| null>/);
  assert.match(nameFox, /Keyboard\.dismiss\(\);\s*setValueScreen\(0\);/s);
  assert.match(nameFox, /if \(valueScreen === 0\) setValueScreen\(1\);\s*else onSubmit\(sanitizeMascotName\(value\)\);/s);
  assert.match(nameFox, /<NameFoxValueScreen onBack=\{valueScreenBack\} onNext=\{valueScreenNext\} page=\{valueScreen\} \/>/);
  assert.doesNotMatch(valueScreens, /StatusBar|9:41|phone|screenshot|onSubmit/);
});

test('fox naming uses a transparent approved Kiko asset without side clipping', () => {
  const assets = readFileSync(join(__dirname, '../assets/onboardingV3Assets.ts'), 'utf8');
  assert.match(assets, /nameFoxReference: require\('\.\.\/\.\.\/\.\.\/assets\/onboarding-v3\/stickers\/fox-waving-alt\.png'\)/);
  assert.doesNotMatch(assets, /nameFoxReference: require\('\.\.\/\.\.\/\.\.\/assets\/onboarding-v3\/fox-naming-fox-only\.png'\)/);
  assert.match(nameFox, /referenceWrap: \{ height: '40%', maxHeight: 330, position: 'absolute', right: 18, top: '9%', width: '44%', zIndex: 1 \}/);
  assert.doesNotMatch(nameFox, /right: '-16%'/);
});

test('the fox-name input measures its own width and keeps restored names centered inside the field', () => {
  assert.match(nameFox, /export function getResponsiveNameInputFontSize\(name: string, fieldWidth: number\): number/);
  assert.match(nameFox, /onLayout=\{onInputLayout\}/);
  assert.match(nameFox, /textAlign: 'center'/);
  assert.match(nameFox, /textAlignVertical: 'center'/);
  assert.match(nameFox, /width: '100%'/);
  assert.match(nameFox, /height: 84/);
});

test('the first explainer draws the graph and the second uses one native visual composition', () => {
  assert.match(valueScreens, /AnimatedPath/);
  assert.match(valueScreens, /strokeDasharray=\{GRAPH_LENGTH\}/);
  assert.match(valueScreens, /Money spent/);
  assert.match(valueScreens, /Why Okyo’s/);
  assert.match(valueScreens, /function PopInsight/);
  assert.match(valueScreens, /withDelay\(delay/);
  assert.match(valueScreens, />Takeout<\/SvgText>/);
  assert.doesNotMatch(valueScreens, /Takeout sprite/);
  assert.match(valueScreens, /Horizontal axis: Time/);
  assert.doesNotMatch(valueScreens, /graphLegend/);
  assert.match(valueScreens, /saveMoneyGraphSparkle/);
  assert.match(valueScreens, /saveMoneyIntro/);
  assert.match(valueScreens, /homeRecipeCardShadow/);
  assert.doesNotMatch(valueScreens, /#FFFEF5/);
  assert.match(valueScreens, /fontSize: 42/);
  assert.match(valueScreens, /fontSize="14"/);
  assert.match(valueScreens, /textAnchor="end" x="278" y="20">Takeout<\/SvgText>/);
});

test('the approach explainer is a simplified native composition with the approved sticker', () => {
  assert.match(valueScreens, /Why Okyo’s\{`\\n`\}approach works/);
  assert.match(valueScreens, /approachHeroSticker/);
  assert.match(assets, /approachHeroSticker: require\('\.\.\/\.\.\/\.\.\/assets\/onboarding-v3\/stickers\/fox-holding-bowl\.png'\)/);
  assert.match(valueScreens, /testID="okyo-approach-feature"/);
  assert.match(valueScreens, /Scan any dish/);
  assert.match(valueScreens, /Get the recipe and useful details/);
  assert.match(valueScreens, /Customize it with Kiko/);
  assert.match(valueScreens, /contentFit="contain"/);
  assert.doesNotMatch(valueScreens, /approachCardBlue|approachCardDark|approachCardCoral|meetKikoHeroUpdated/);
  assert.doesNotMatch(valueScreens, /#F8F3FF|#83C7FF|#FFA28F/);
  assert.match(valueScreens, /backgroundColor: colors\.background/);
  assert.match(valueScreens, /tone="pastelPink"/);
  assert.match(valueScreens, /accessibilityRole="image"/);
  assert.match(valueScreens, /<OnboardingCTA accessibilityLabel="Continue to name" label="Let’s go" onPress=\{onNext\}/);
  assert.match(valueScreens, /<OnboardingBackButton onPress=\{onBack\}/);
  assert.doesNotMatch(valueScreens, /StatusBar|9:41|phone frame|screenshot/);
});

test('the approach composition uses responsive dimensions and keeps Reduce Motion instant', () => {
  assert.match(valueScreens, /useWindowDimensions\(\)/);
  assert.match(valueScreens, /const compactLayout = height < 740 \|\| width < 380/);
  assert.match(valueScreens, /reduceMotion \? 0 : motionTokens\.enter\.durationMs/);
  assert.doesNotMatch(valueScreens, /width:\s*375/);
  assert.doesNotMatch(valueScreens, /StatusBar|phone frame|screenshot/);
});

test('explainer Back behavior is local and motion respects Reduce Motion', () => {
  assert.match(nameFox, /if \(valueScreen === 0\) setValueScreen\(null\);\s*else setValueScreen\(0\);/s);
  assert.match(valueScreens, /useReduceMotion/);
  assert.match(valueScreens, /reduceMotion \? 0 :/);
  assert.match(valueScreens, /accessibilityRole="header"/);
  assert.match(valueScreens, /accessibilityRole="image"/);
});
