import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(__dirname, '../..');
const blocked = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

test('Android release config blocks unused microphone, broad-storage, and overlay permissions', () => {
  const config = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
    expo: { android?: { blockedPermissions?: string[] } };
  };
  const manifest = readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');

  for (const permission of blocked) {
    assert.ok(config.expo.android?.blockedPermissions?.includes(permission), `${permission} must stay blocked in generated builds`);
    assert.doesNotMatch(manifest, new RegExp(permission.replaceAll('.', '\\.') + '"'));
  }
});
