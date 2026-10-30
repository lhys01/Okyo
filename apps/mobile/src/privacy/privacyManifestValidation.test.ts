import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { privacyManifestSha256, validatePrivacyManifestReview } from './privacyManifestValidation';

const manifestPath = resolve(process.cwd(), 'ios/Okyo/PrivacyInfo.xcprivacy');
const reviewPath = resolve(process.cwd(), 'privacy-collected-data-review.json');

test('the prepared collected-data manifest matches the approved privacy review', () => {
  const manifest = readFileSync(manifestPath, 'utf8');
  const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as { status: string; manifestSha256: string | null };
  const failures = validatePrivacyManifestReview(manifest, review);

  assert.ok(!failures.some((failure) => /declares no collected data/.test(failure)));
  assert.match(manifest, /NSPrivacyCollectedDataTypeHealth/);
  assert.match(manifest, /NSPrivacyCollectedDataTypePhotosorVideos/);
  assert.deepEqual(failures, []);
});

test('missing or incomplete collected-data declarations are not accepted', () => {
  const missing = validatePrivacyManifestReview('<plist><dict></dict></plist>', { status: 'approved' });
  assert.ok(missing.some((failure) => /missing NSPrivacyCollectedDataTypes/.test(failure)));

  const incomplete = '<key>NSPrivacyCollectedDataTypes</key><array><dict><key>NSPrivacyCollectedDataType</key><string>placeholder</string></dict></array>';
  assert.ok(validatePrivacyManifestReview(incomplete, { status: 'approved' }).some((failure) => /must include a data type/.test(failure)));
});

test('release review must explicitly approve the exact manifest being shipped', () => {
  const declaration = [
    '<key>NSPrivacyCollectedDataTypes</key><array><dict>',
    '<key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeName</string>',
    '<key>NSPrivacyCollectedDataTypeLinked</key><false/>',
    '<key>NSPrivacyCollectedDataTypeTracking</key><false/>',
    '<key>NSPrivacyCollectedDataTypePurposes</key><array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>',
    '</dict></array>',
  ].join('');
  const pending = validatePrivacyManifestReview(declaration, { status: 'pending', manifestSha256: null });
  assert.ok(pending.some((failure) => /not marked approved/.test(failure)));

  const approved = validatePrivacyManifestReview(declaration, {
    status: 'approved',
    manifestSha256: privacyManifestSha256(declaration),
  });
  assert.deepEqual(approved, []);

  const staleReview = validatePrivacyManifestReview(`${declaration} `, {
    status: 'approved',
    manifestSha256: privacyManifestSha256(declaration),
  });
  assert.ok(staleReview.some((failure) => /does not match/.test(failure)));
});
