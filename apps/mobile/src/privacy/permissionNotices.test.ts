import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  PERMISSION_NOTICE_VERSION,
  permissionNotices,
  shouldShowPermissionNotice,
} from './permissionNotices';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

test('every permission Okyo requests has a just-in-time notice', () => {
  // Arrange: the permissions actually requested anywhere in the mobile source.
  const requested = ['camera', 'photos', 'notifications'] as const;

  // Act + Assert
  for (const kind of requested) {
    const notice = permissionNotices[kind];
    assert.ok(notice, `${kind} has no just-in-time notice`);
    assert.ok(notice.title.length > 0, `${kind} notice has no title`);
    assert.ok(notice.body.length > 80, `${kind} notice body is too short to explain anything`);
    assert.equal(notice.version, PERMISSION_NOTICE_VERSION);
  }
});

test('the camera and photo notices state that the image leaves the device', () => {
  for (const kind of ['camera', 'photos'] as const) {
    const body = permissionNotices[kind].body;
    assert.match(body, /Okyo service/, `${kind} notice must say the photo reaches Okyo's service`);
    assert.match(body, /AI provider/, `${kind} notice must say an AI provider receives it`);
    assert.match(body, /this device/, `${kind} notice must say the photo is stored on the device`);
    assert.match(body, /describe a dish in words/, `${kind} notice must offer the description alternative`);
    assert.match(body, /If you say no/, `${kind} notice must say what happens on refusal`);
  }
});

test('no notice claims a retention period Okyo cannot prove', () => {
  // The AI provider's retention is UNKNOWN (owner item G2). A notice that said
  // "deleted immediately" would be an unprovable promise.
  for (const notice of Object.values(permissionNotices)) {
    assert.doesNotMatch(notice.body, /deleted immediately|never stored anywhere|we delete it right away/i);
  }
  for (const kind of ['camera', 'photos'] as const) {
    assert.match(
      permissionNotices[kind].body,
      /set by that provider, not by Okyo/,
      'the notice must be explicit that AI-provider retention is outside Okyo\'s control',
    );
  }
});

test('refusal is offered as an equal choice, never a discouraged one', () => {
  for (const notice of Object.values(permissionNotices)) {
    assert.ok(notice.cancelLabel.length > 0, 'a refusal label must exist');
    assert.doesNotMatch(notice.cancelLabel, /no thanks, I don|miss out|skip and lose/i);
  }
});

test('the notice is shown exactly when an OS prompt would appear, and not otherwise', () => {
  assert.equal(shouldShowPermissionNotice({ granted: false, status: 'undetermined' }), true);
  assert.equal(shouldShowPermissionNotice(null), true, 'an unreadable status must fail toward showing the explanation');
  assert.equal(shouldShowPermissionNotice({ granted: true, status: 'granted' }), false);
  assert.equal(shouldShowPermissionNotice({ granted: false, status: 'denied' }), false, 'a settled denial produces no OS prompt to precede');
  assert.equal(shouldShowPermissionNotice({ granted: false, canAskAgain: false }), false);
});

test('every live permission request routes through the notice gate before the OS prompt', () => {
  const callSites = [
    'src/hooks/useStartPickedScan.ts',
    'src/onboarding-v3/screens/ScanInputScreen.tsx',
    'src/screens/WelcomeScreen.tsx',
    'src/screens/NotificationPreferencesScreen.tsx',
  ];

  for (const file of callSites) {
    const source = read(file);
    assert.match(source, /requestPermissionWithNotice/, `${file} must request permission through the notice gate`);

    // A bare request call outside the gate would prompt with no explanation.
    const bareRequests = source.match(/await\s+(?:ImagePicker|notifications)\.request\w*PermissionsAsync\(/g) ?? [];
    assert.deepEqual(
      bareRequests,
      [],
      `${file} calls an OS permission request directly, bypassing the just-in-time notice`,
    );
  }
});

test('the gate shows the notice before it calls the OS, and skips the OS entirely on refusal', () => {
  const gate = read('src/privacy/requestPermissionWithNotice.ts');
  const noticeIndex = gate.indexOf('alert(');
  const requestIndex = gate.indexOf('await requestPermission()');
  assert.ok(noticeIndex > -1 && requestIndex > -1, 'gate must both show a notice and request permission');
  assert.ok(noticeIndex < requestIndex, 'the notice must be presented before the OS permission request');
  assert.match(gate, /if \(!wantsToContinue\)[\s\S]{0,120}return 'declined_notice'/, 'declining the notice must return before the OS prompt');
});

test('nothing requests a permission at app launch', () => {
  // A launch-time prompt has no context for the user and is a review risk.
  for (const file of ['src/navigation/AppNavigator.tsx', 'src/navigation/MainTabs.tsx']) {
    assert.doesNotMatch(read(file), /request\w*PermissionsAsync/, `${file} must not request a permission at launch`);
  }
});

test('native usage strings match the in-app notices', () => {
  const appConfig = JSON.parse(read('app.json')) as {
    expo: {
      ios: { infoPlist: Record<string, string> };
      android: { permissions: string[] };
      plugins: unknown[];
    };
  };

  const camera = appConfig.expo.ios.infoPlist.NSCameraUsageDescription;
  const photos = appConfig.expo.ios.infoPlist.NSPhotoLibraryUsageDescription;
  assert.ok(camera && photos, 'both iOS usage strings must be declared');
  for (const usageString of [camera, photos]) {
    assert.match(usageString, /AI provider/, 'the OS string must disclose the AI transfer, matching the in-app notice');
  }

  // An unused declared permission is a store and privacy-review liability.
  assert.deepEqual(appConfig.expo.android.permissions, [], 'Okyo declares no Android permission it does not use');
});
