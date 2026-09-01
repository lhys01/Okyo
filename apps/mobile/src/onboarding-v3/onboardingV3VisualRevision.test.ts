import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), 'src/onboarding-v3', relativePath), 'utf8');

test('opening page uses the approved reach-your-food-goals artwork without rebuilding it', () => {
  const hero = read('showcase/pages/HeroPage.tsx');
  assert.match(hero, /approvedHeroArtwork/);
  assert.match(hero, /contentFit="contain"/);
  assert.doesNotMatch(hero, /HeartSolid|ScanQrCode|PageEdit|<Text/);
});

test('floating CTA is centered, deliberately shorter, and retains the existing press animation', () => {
  const cta = read('components/OnboardingCTA.tsx');
  assert.match(cta, /alignSelf: 'center'/);
  assert.match(cta, /maxWidth: 360/);
  assert.match(cta, /width: '86%'/);
  assert.match(cta, /minHeight: 60/);
  assert.match(cta, /onPressIn=\{pressIn\}/);
  assert.match(cta, /onPressOut=\{pressOut\}/);
});

test('live name screen asks for the user name with one native input and no account gate', () => {
  const name = read('screens/PersonalizedOnboardingScreen.tsx');
  assert.match(name, /What should we call you\?/);
  assert.match(name, /<TextInput/);
  assert.match(name, /onChangeText=\{setName\}/);
  assert.match(name, /No account or email needed\./);
  assert.doesNotMatch(name, /pickRandomMascotName|Name your fox/);
});

test('scan entry keeps all real handlers, uses Describe a dish, and adds restrained visual guidance', () => {
  const scan = read('screens/ScanInputScreen.tsx');
  assert.match(scan, /choosePhoto\('camera'\)/);
  assert.match(scan, /choosePhoto\('photos'\)/);
  assert.match(scan, /describeLabel="Describe a dish"/);
  assert.match(scan, /onDescriptionSubmitted\(description\.trim\(\)\)/);
  assert.match(scan, /Prepared dish to editable recipe/);
  assert.match(scan, /post-purchase-first-scan/);
});

test('savings graph waits for text and labels the requested amount as illustrative', () => {
  const savings = read('showcase/pages/SavingsPage.tsx');
  const content = read('showcase/showcaseContent.ts');
  assert.match(savings, /withDelay\(motionTokens\.graph\.textLeadMs/);
  assert.match(savings, /Takeout spending/);
  assert.match(savings, /With Okyo/);
  assert.match(content, /exampleLabel: 'Illustrative example'/);
  assert.match(content, /exampleAmount: '\$84 saved this month with Okyo'/);
  assert.doesNotMatch(`${savings}\n${content}`, /Users save an average|81% healthier/i);
});

test('virtual-pet page has the exact headline and no explanatory paragraph', () => {
  const content = read('showcase/showcaseContent.ts');
  const page = read('showcase/pages/MeetKikoPage.tsx');
  assert.match(content, /title: 'This fox is now your virtual pet'/);
  assert.doesNotMatch(page, /Kiko helps you scan dishes/);
  assert.doesNotMatch(page, /styles\.body/);
});

test('shared onboarding controls use a real left arrow and text-only forward CTAs', () => {
  const back = read('components/OnboardingBackButton.tsx');
  const cta = read('components/OnboardingCTA.tsx');
  assert.match(back, /NavArrowLeft/);
  assert.match(back, /strokeWidth=\{2\.35\}/);
  assert.doesNotMatch(back, />‹<\/Text>/);
  assert.doesNotMatch(cta, /›/);
  assert.doesNotMatch(cta, /icon\?:/);
  assert.match(cta, /justifyContent: 'center'/);
});

test('MCQ scroll shells size to their content and keep a modest footer clearance', () => {
  const shell = read('screens/PersonalizedOnboardingScreen.tsx');
  const branchShell = read('branch-ui/BranchScaffold.tsx');
  assert.match(shell, /scrollContent: \{ paddingBottom: 32,/);
  assert.doesNotMatch(shell, /scrollContent: \{[^}]*flexGrow/);
  assert.match(shell, /optionList: \{ gap: 12,/);
  assert.match(shell, /minHeight: 68, paddingHorizontal: 18, paddingVertical: 14/);
  assert.match(branchShell, /content: \{ paddingBottom: 28,/);
  assert.doesNotMatch(branchShell, /content: \{[^}]*flexGrow/);
  assert.match(shell, /<ScrollView contentContainerStyle=\{styles\.scrollContent\}/);
  // BranchScaffold now merges an opt-in `contentFill` (flexGrow) via array form so
  // coaching branches can centre short beats; `styles.content` keeps its spacing.
  assert.match(branchShell, /<ScrollView[\s\S]*contentContainerStyle=\{\[styles\.content/);
});
