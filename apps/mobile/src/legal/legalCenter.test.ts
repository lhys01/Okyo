import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { legalDocuments } from './legalDocuments';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const settings = read('src/screens/SettingsScreen.tsx');
const centre = read('src/screens/LegalPrivacyScreen.tsx');
const documentScreen = read('src/screens/LegalScreen.tsx');
const licenses = read('src/screens/OpenSourceLicensesScreen.tsx');
const privacyData = read('src/screens/PrivacyDataScreen.tsx');
const mainTabs = read('src/navigation/MainTabs.tsx');
const navTypes = read('src/navigation/types.ts');
const view = read('src/legal/LegalDocumentView.tsx');
const modal = read('src/legal/LegalDocumentModal.tsx');

test('every legal and privacy route is registered and reachable', () => {
  for (const screen of ['LegalPrivacyScreen', 'LegalScreen', 'OpenSourceLicensesScreen', 'PrivacyDataScreen', 'NotificationPreferencesScreen']) {
    assert.match(navTypes, new RegExp(`${screen}:`), `${screen} is missing from MainTabParamList`);
    assert.match(mainTabs, new RegExp(`name="${screen}"`), `${screen} is not registered in the navigator`);
  }
  assert.match(settings, /go\('LegalPrivacyScreen'\)/, 'Settings must open the Legal & Privacy centre');
});

test('legal and privacy screens are not exposed as bottom tabs', () => {
  const order = /const visibleTabOrder: MainTabRouteName\[\] = \[([\s\S]*?)\]/.exec(mainTabs)?.[1] ?? '';
  for (const screen of ['LegalPrivacyScreen', 'LegalScreen', 'OpenSourceLicensesScreen', 'PrivacyDataScreen']) {
    assert.doesNotMatch(order, new RegExp(screen), `${screen} must not appear in the tab bar`);
  }
});

test('the centre lists every legal document', () => {
  assert.match(centre, /legalDocuments\.map/, 'document rows must be generated from the registry, not hand-listed');
  assert.equal(legalDocuments.length >= 11, true);
});

test('the centre offers the applicable controls and omits the ones Okyo does not have', () => {
  for (const control of ['PrivacyDataScreen', 'NotificationPreferencesScreen', 'OpenSourceLicensesScreen']) {
    assert.match(centre, new RegExp(control), `${control} must be reachable from the centre`);
  }
  // Rows Okyo must NOT show, because the capability does not exist.
  assert.doesNotMatch(centre, /label: 'Delete account'/, 'there is no account to delete');
  assert.doesNotMatch(centre, /label: 'Export my data'/, 'no export is implemented');
  assert.doesNotMatch(centre, /label: 'Analytics'/, 'no analytics ships, so there is nothing to choose');
});

test('no production-visible legal row points at a placeholder or an unavailable URL', () => {
  for (const [name, source] of Object.entries({ centre, documentScreen, licenses })) {
    assert.doesNotMatch(source, /https?:\/\/example\.|TODO|Coming soon|#placeholder/i, `${name} contains a placeholder link`);
    // Okyo has no published website; every destination must be an in-app screen.
    const externalLinks = source.match(/openURL\(['"`]https?:\/\/[^'"`]+/g) ?? [];
    assert.deepEqual(externalLinks, [], `${name} links out to a URL Okyo does not publish`);
  }
});

test('the one external link that exists is Apple\'s own subscription management page', () => {
  const paywall = read('src/onboarding-v3/screens/OnboardingPaywallScreen.tsx');
  const links = paywall.match(/openURL\('([^']+)'\)/g) ?? [];
  assert.deepEqual(links, ["openURL('https://apps.apple.com/account/subscriptions')"], 'only the App Store subscription page may be linked');
});

test('every legal row exposes an accessibility label, a role and an adequate touch target', () => {
  assert.match(centre, /accessibilityLabel=\{label\}/);
  assert.match(centre, /accessibilityRole="button"/);
  assert.match(centre, /accessibilityHint=\{hint\}/);
  const minHeight = Number(/row: \{[\s\S]*?minHeight: (\d+)/.exec(centre)?.[1]);
  assert.ok(minHeight >= 44, `legal rows are ${minHeight}pt tall; 44pt is the minimum touch target`);

  for (const [name, source] of Object.entries({ documentScreen, licenses, modal })) {
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

test('Privacy & data does not label local erasure as account deletion', () => {
  assert.match(privacyData, /Account deletion/, 'the account row must explain itself');
  assert.match(privacyData, /no account or sign-in/i);
  assert.doesNotMatch(privacyData, /<Text style=\{styles\.dangerText\}>Delete account<\/Text>/, 'local erasure must not be presented as deleting an account');
  assert.match(privacyData, /does not cancel your subscription/, 'deletion must be distinguished from cancellation');
});

test('the app version and a contact position are shown in the centre', () => {
  assert.match(centre, /appConfig\.expo\.version/);
  assert.match(centre, /Privacy and support contact/);
  assert.match(centre, /Not published yet/, 'the missing contact must be stated honestly, not faked');
});

test('the open source screen renders generated data, not a hand-maintained list', () => {
  assert.match(licenses, /openSourceNotices\.generated/);
  assert.match(licenses, /openSourcePackages/);
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

test('the hero account row does not imply an account exists', () => {
  const hero = read('src/onboarding-v3/showcase/pages/HeroPage.tsx');
  assert.match(hero, /Okyo has no accounts/);
  assert.match(hero, /does not use accounts or sign-in/);
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
