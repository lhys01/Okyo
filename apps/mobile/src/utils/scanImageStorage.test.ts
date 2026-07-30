import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  copyToManagedScanImages,
  isManagedScanImageUri,
} from './scanImageStorageCore';

const managedDirectoryUri = 'file:///documents/okyo-scan-images/';

test('a valid image already in managed scan storage is reused without another copy', async () => {
  const image = {
    uri: `${managedDirectoryUri}scan-existing.jpg`,
    dataUrl: 'data:image/jpeg;base64,AAAA',
    dataUrlSizeBytes: 27,
    fileName: 'scan-existing.jpg',
    mimeType: 'image/jpeg',
    source: 'photos' as const,
    width: 1200,
    height: 900,
  };
  let directoryCalls = 0;
  let copyCalls = 0;

  const result = await copyToManagedScanImages(image, {
    managedDirectoryUri,
    getFileInfo: async () => ({ exists: true, isDirectory: false }),
    ensureDirectory: async () => { directoryCalls += 1; },
    copyFile: async () => { copyCalls += 1; },
    now: () => 100,
  });

  assert.strictEqual(result, image);
  assert.equal(result.dataUrl, image.dataUrl);
  assert.equal(result.dataUrlSizeBytes, image.dataUrlSizeBytes);
  assert.equal(directoryCalls, 0);
  assert.equal(copyCalls, 0);
});

test('an external prepared image is copied once into managed scan storage', async () => {
  const copies: Array<{ from: string; to: string }> = [];
  const image = {
    uri: 'file:///cache/prepared.jpg',
    dataUrl: 'data:image/jpeg;base64,BBBB',
    mimeType: 'image/jpeg',
    source: 'camera' as const,
  };

  const result = await copyToManagedScanImages(image, {
    managedDirectoryUri,
    getFileInfo: async () => ({ exists: false }),
    ensureDirectory: async () => undefined,
    copyFile: async (from, to) => { copies.push({ from, to }); },
    now: () => 321,
  });

  assert.equal(result.uri, `${managedDirectoryUri}scan-321.jpg`);
  assert.equal(result.dataUrl, image.dataUrl);
  assert.deepEqual(copies, [{
    from: image.uri,
    to: `${managedDirectoryUri}scan-321.jpg`,
  }]);
});

test('managed scan image detection requires the actual managed directory prefix', () => {
  assert.equal(
    isManagedScanImageUri(`${managedDirectoryUri}scan.jpg`, managedDirectoryUri),
    true,
  );
  assert.equal(
    isManagedScanImageUri('file:///documents/okyo-scan-images-old/scan.jpg', managedDirectoryUri),
    false,
  );
});

test('retry preparation preserves the managed image while the old scan session is cleared', () => {
  const utilsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const controller = readFileSync(path.join(utilsDirectory, 'scanController.ts'), 'utf8');
  const store = readFileSync(path.join(utilsDirectory, '..', 'state', 'useOkyoStore.ts'), 'utf8');

  assert.ok(
    controller.indexOf('await copyToDocuments(input.image)') <
      controller.indexOf('state.clearLatestScan({'),
  );
  assert.match(controller, /preserveImageUri: image\?\.uri/);
  assert.match(
    store,
    /outgoingScanImageUri && outgoingScanImageUri !== clear\.preserveImageUri/,
  );
});
