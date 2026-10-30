import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const help = read('src/screens/HelpSupportScreen.tsx');
const legalView = read('src/legal/LegalDocumentView.tsx');
const legalScreen = read('src/screens/LegalScreen.tsx');
const privacy = read('src/screens/PrivacyDataScreen.tsx');

test('Help & Support exposes an accessible mailto contact that fits narrow screens', () => {
  assert.match(help, /Contact support/);
  assert.match(help, /accessibilityLabel="Email Okyo support\."/);
  assert.match(help, /accessibilityRole="link" onPress=\{contactSupport\}/);
  assert.match(help, /SUPPORT_EMAIL/);
  assert.match(help, /flexShrink: 1/);
  assert.match(help, /maxWidth: '100%'/);
  assert.doesNotMatch(help, /No support email, form, or ticketing system is configured/);
});

test('legal email links open the system mail composer accessibly', () => {
  assert.match(legalView, /accessibilityLabel="Email Okyo support\."/);
  assert.match(legalView, /accessibilityRole="link" onPress=\{emailSupport\}/);
  assert.match(legalView, /openSupportEmail\(\(url\) => Linking\.openURL\(url\)\)/);
  assert.match(legalScreen, /LegalDocumentModal documentId=/);
});

test('account deletion still uses its existing flow and offers support on failure', () => {
  assert.match(privacy, /deleteAuthenticatedAccount\(token\)/);
  assert.match(privacy, /Contact Support/);
  assert.match(privacy, /onPress: contactSupport/);
  assert.match(privacy, /Retry device cleanup/);
  assert.match(privacy, /the server deletion will not be sent again/);
});
