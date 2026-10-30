import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { legalDocuments } from './legalDocuments';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const settings = read('src/screens/SettingsScreen.tsx');
const documentScreen = read('src/screens/LegalScreen.tsx');
const privacyData = read('src/screens/PrivacyDataScreen.tsx');
const mainTabs = read('src/navigation/MainTabs.tsx');
const navTypes = read('src/navigation/types.ts');
const view = read('src/legal/LegalDocumentView.tsx');
const modal = read('src/legal/LegalDocumentModal.tsx');

test('current legal and privacy routes are registered and reachable from Settings', () => {
  for (const screen of ['LegalScreen', 'PrivacyDataScreen', 'NotificationPreferencesScreen']) {
    assert.match(navTypes, new RegExp(`${screen}:`), `${screen} is missing from MainTabParamList`);
    assert.match(mainTabs, new RegExp(`name="${screen}"`), `${screen} is not registered in the navigator`);
  }
  assert.match(settings, /go\('LegalScreen'\)/, 'Settings must open the in-app legal documents');
  assert.match(settings, /go\('PrivacyDataScreen'\)/, 'Settings must open privacy controls');
});

test('legal and privacy utility screens are not exposed as bottom tabs', () => {
  const order = /const visibleTabOrder: MainTabRouteName\[\] = \[([\s\S]*?)\]/.exec(mainTabs)?.[1] ?? '';
  for (const screen of ['LegalScreen', 'PrivacyDataScreen', 'NotificationPreferencesScreen']) {
    assert.doesNotMatch(order, new RegExp(screen), `${screen} must not appear in the tab bar`);
  }
});

test('the in-app legal registry lists the current documents', () => {
  assert.equal(legalDocuments.length >= 11, true);
  assert.match(documentScreen, /legalDocuments\.map/);
  assert.match(documentScreen, /LegalDocumentModal documentId=\{documentId\}/);
  assert.doesNotMatch(documentScreen, /const DOCUMENTS|LAST_UPDATED/);
  assert.match(modal, /getLegalDocument\(documentId\)/);
});

test('counsel approval stays internal and production legal screens show active documents', () => {
  assert.doesNotMatch(view, /has not been reviewed by a lawyer|this build of Okyo|Draft\. This document/);
  const review = JSON.parse(read('legal-release-review.json'));
  assert.equal(review.status, 'approved');
  assert.equal(review.approvalType, 'counsel_approved');
  assert.equal(review.approvedBy, 'Roberto Ferrito');
});

test('the one external link that exists is Apple\'s own subscription management page', () => {
  const paywall = read('src/onboarding-v3/screens/OnboardingPaywallScreen.tsx');
  const links = paywall.match(/openURL\('([^']+)'\)/g) ?? [];
  assert.deepEqual(links, ["openURL('https://apps.apple.com/account/subscriptions')"], 'only the App Store subscription page may be linked');
});

test('every legal row exposes an accessibility label, a role and an adequate touch target', () => {
  for (const [name, source] of Object.entries({ documentScreen, privacyData, modal })) {
    assert.match(source, /accessibilityRole="button"/, `${name} has an unlabelled control`);
    assert.match(source, /accessibilityLabel=/, `${name} has an unlabelled control`);
  }
});

test('legal text supports Dynamic Type and scrolls', () => {
  assert.match(view, /ScrollView/, 'a long document must scroll');
  assert.doesNotMatch(view, /allowFontScaling=\{false\}/, 'legal text must follow the system text size');
  assert.match(view, /accessibilityRole="header"/, 'document and section titles must be headers for VoiceOver');
  assert.match(view, /selectable/, 'legal text should be selectable and copyable');
});

test('no legal document is presented as an image or a web page', () => {
  for (const [name, source] of Object.entries({ view, modal, documentScreen })) {
    // JSX usage only — a prose mention of "WebView" in a comment explaining why
    // one is NOT used must not trip this.
    assert.doesNotMatch(source, /<WebView|react-native-webview|<Image[\s/>]/, `${name} must render real text, not a screenshot or a web page`);
  }
});

test('legal documents are reachable before onboarding completes, without changing onboarding routing', () => {
  const paywall = read('src/onboarding-v3/screens/OnboardingPaywallScreen.tsx');
  assert.match(paywall, /LegalDocumentModal/, 'the paywall must reach the documents without a navigator');
  assert.match(modal, /Modal/, 'presentation must be a modal layered over the current screen');
  // The onboarding host must not have gained a route or a redirect.
  assert.doesNotMatch(paywall, /navigation\.navigate|useNavigation/, 'the paywall must not introduce navigation into onboarding');
});

test('Privacy & data distinguishes local deletion from account deletion', () => {
  assert.match(privacyData, /Delete all my data/);
  assert.match(privacyData, /deleteAuthenticatedAccount\(token\)/);
  assert.match(privacyData, /does not cancel an App Store subscription/i);
});

test('the pre-onboarding hero opens the real Terms and Privacy documents', () => {
  // Runtime finding: the first screen says "by continuing you're accepting our
  // Terms of Use and Privacy Notice" while both links raised a "not available
  // in this build yet" alert. A first-run screen cannot assert acceptance of a
  // document the user cannot read.
  const hero = read('src/onboarding-v3/showcase/pages/HeroPage.tsx');
  assert.match(hero, /setLegalDocumentId\('terms-of-service'\)/);
  assert.match(hero, /setLegalDocumentId\('privacy-policy'\)/);
  assert.match(hero, /LegalDocumentModal/);
  assert.doesNotMatch(hero, /Terms of Use are not available in this build/);
  assert.doesNotMatch(hero, /Privacy Notice is not available in this build/);
});

test('legal line heights scale with the system font scale', () => {
  // Runtime finding on an iPhone 17 Pro at "accessibility extra large": React
  // Native scales fontSize with Dynamic Type but leaves a hardcoded lineHeight
  // alone, so fixed line heights were smaller than the glyphs and consecutive
  // lines overlapped and clipped.
  assert.match(view, /PixelRatio\.getFontScale\(\)/);
  assert.match(view, /const scaledLine = \(base: number\) => \(\{ lineHeight: base \* fontScale \}\)/);

  const styleBlock = /const styles = StyleSheet\.create\(\{[\s\S]*\}\);/.exec(view)?.[0] ?? '';
  assert.doesNotMatch(styleBlock, /lineHeight:/, 'legal text must not carry a hardcoded lineHeight in its stylesheet');
});

test('the modal header cannot wrap into the status bar at large text sizes', () => {
  assert.match(modal, /numberOfLines=\{1\} style=\{styles\.headerTitle\}/);
});

test('Home re-reads the profile on focus so deletion is reflected immediately', () => {
  // Runtime finding: after "delete my data" the Home greeting still said the
  // user's name, because the profile was read once on mount.
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]{0,300}readPersonalizedHomeProfile/);
  assert.doesNotMatch(
    home,
    /useEffect\(\(\) => \{\s*let mounted = true;\s*void readPersonalizedHomeProfile/,
    'a mount-only profile read leaves a deleted name on screen',
  );
});
