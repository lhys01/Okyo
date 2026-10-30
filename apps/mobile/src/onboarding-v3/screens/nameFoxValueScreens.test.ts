import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const valueScreens = readFileSync(join(__dirname, 'NameFoxValueScreens.tsx'), 'utf8');
const nameFox = readFileSync(join(__dirname, 'NameFoxScreen.tsx'), 'utf8');
const assets = readFileSync(join(__dirname, '../assets/onboardingV3Assets.ts'), 'utf8');

test('fox naming saves the name before the two persisted native explanation routes', () => {
  assert.match(nameFox, /Keyboard\.dismiss\(\);\s*onSubmit\(sanitizeMascotName\(value\)\);/s);
  assert.doesNotMatch(nameFox, /valueScreen|setValueScreen/);
  const host = readFileSync(join(__dirname, '../OnboardingV3.tsx'), 'utf8');
  assert.match(host, /case 'foxExplainer1':[\s\S]*case 'foxExplainer2':[\s\S]*<NameFoxValueScreen/);
  assert.doesNotMatch(valueScreens, /StatusBar|9:41|phone|screenshot|onSubmit/);
});

test('fox naming copy is a full onboarding step with the requested prompt and placeholder', () => {
  assert.match(nameFox, /What should we call your fox\?/);
  assert.doesNotMatch(nameFox, /Give your cooking companion a name\./);
  assert.match(nameFox, /placeholder=\{placeholder\}/);
  assert.match(nameFox, /const placeholder = 'Type a name'/);
  assert.match(nameFox, />Surprise me<\/Text>/);
});

test('the name-field keyboard hides fox artwork so it cannot cover the prompt or typed text', () => {
  assert.match(nameFox, /Keyboard\.addListener\(showEvent, \(\) => setKeyboardVisible\(true\)\)/);
  assert.match(nameFox, /!keyboardVisible \?[\s\S]{0,300}<Animated\.View[\s\S]{0,200}<Image/);
  assert.match(nameFox, /KeyboardAvoidingView behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(nameFox, /<View style=\{styles\.footer\}>[\s\S]*<OnboardingCTA/);
});

test('fox naming uses a transparent approved Kiko asset without side clipping', () => {
  const assets = readFileSync(join(__dirname, '../assets/onboardingV3Assets.ts'), 'utf8');
  assert.match(assets, /nameFoxReference: require\('\.\.\/\.\.\/\.\.\/assets\/kiko-transparent\/kiko-paw-raised-sticker\.png'\)/);
  assert.doesNotMatch(assets, /nameFoxReference: require\('\.\.\/\.\.\/\.\.\/assets\/onboarding-v3\/fox-naming-fox-only\.png'\)/);
  assert.match(nameFox, /const nameLayout = getNameFoxLayout\(windowHeight\)/);
  assert.match(nameFox, /height: nameLayout\.artworkHeight/);
  assert.match(nameFox, /paddingTop: nameLayout\.contentTop/);
  assert.match(nameFox, /referenceWrap: \{ maxHeight: 350, position: 'absolute', right: 16, top: '7%', width: '47%', zIndex: 1 \}/);
  assert.doesNotMatch(nameFox, /right: '-16%'/);
});

test('the fox-name input measures its inline width and stays left aligned without an underline', () => {
  assert.match(nameFox, /export function getResponsiveNameInputFontSize\(name: string, fieldWidth: number\): number/);
  assert.match(nameFox, /onLayout=\{onInputLayout\}/);
  assert.match(nameFox, /textAlign: 'left'/);
  assert.match(nameFox, /textAlignVertical: 'center'/);
  assert.match(nameFox, /width: '100%'/);
  assert.match(nameFox, /height: 44/);
  assert.match(nameFox, /NAME_INPUT_MAX_FONT_SIZE = 22/);
  assert.match(nameFox, /nameInputWrap: \{ alignSelf: 'stretch', marginTop: 4 \}/);
  assert.doesNotMatch(nameFox, /borderBottomWidth/);
  assert.match(nameFox, /accessibilityLabel="Fox name"/);
  assert.match(nameFox, /onChangeText=\{\(text\) => \{ nameEditedRef\.current = true; setValue\(text\); \}\}/);
});

test('fox naming offers a secondary skip action without submitting a placeholder', () => {
  assert.match(nameFox, /onSkip: \(\) => void/);
  assert.match(nameFox, /<Text style=\{styles\.skipLabel\}>Skip for now<\/Text>/);
  assert.match(nameFox, /onPress=\{onSkip\}/);
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
  assert.match(valueScreens, /saveMoneyRevealReaction/);
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
  assert.match(valueScreens, /Customize it with \{mascotName\}/);
  assert.match(valueScreens, /contentFit="contain"/);
  assert.doesNotMatch(valueScreens, /approachCardBlue|approachCardDark|approachCardCoral|meetKikoHeroUpdated/);
  assert.doesNotMatch(valueScreens, /#F8F3FF|#83C7FF|#FFA28F/);
  assert.match(valueScreens, /backgroundColor: colors\.background/);
  assert.match(valueScreens, /tone="pastelPink"/);
  assert.match(valueScreens, /accessibilityRole="image"/);
  assert.match(valueScreens, /<OnboardingCTA accessibilityLabel="Continue to age selection" label="Let’s go" onPress=\{onNext\}/);
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

test('explainer Back behavior follows the persisted reducer and motion respects Reduce Motion', () => {
  const machine = readFileSync(join(__dirname, '../controller/onboardingV3Machine.ts'), 'utf8');
  assert.match(machine, /case 'foxExplainer1':[\s\S]*step: 'name'/);
  assert.match(machine, /case 'foxExplainer2':[\s\S]*step: 'foxExplainer1'/);
  assert.match(valueScreens, /useReduceMotion/);
  assert.match(valueScreens, /reduceMotion \? 0 :/);
  assert.match(valueScreens, /accessibilityRole="header"/);
  assert.match(valueScreens, /accessibilityRole="image"/);
});
