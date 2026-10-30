import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  copyToManagedScanImages,
  isManagedScanImageOwnedBySession,
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
    uniqueSuffix: () => 'stable-copy-id',
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
    uniqueSuffix: () => 'scan-session-id',
  });

  assert.equal(result.uri, `${managedDirectoryUri}scan-321-scan-session-id.jpg`);
  assert.equal(result.dataUrl, image.dataUrl);
  assert.deepEqual(copies, [{
    from: image.uri,
    to: `${managedDirectoryUri}scan-321-scan-session-id.jpg`,
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

test('stale cleanup only owns a durable file with the matching scan session suffix', () => {
  assert.equal(isManagedScanImageOwnedBySession(`${managedDirectoryUri}scan-123-scan-one.jpg`, managedDirectoryUri, 'scan-one'), true);
  assert.equal(isManagedScanImageOwnedBySession(`${managedDirectoryUri}scan-123-scan-two.jpg`, managedDirectoryUri, 'scan-one'), false);
  assert.equal(isManagedScanImageOwnedBySession('file:///cache/photo.jpg', managedDirectoryUri, 'scan-one'), false);
});

test('scan navigation begins with the selected preview before async image preparation and copying', () => {
  const utilsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const controller = readFileSync(path.join(utilsDirectory, 'scanController.ts'), 'utf8');
  const store = readFileSync(path.join(utilsDirectory, '..', 'state', 'useOkyoStore.ts'), 'utf8');

  assert.ok(
    controller.indexOf('state.beginLatestScanSession({') <
      controller.indexOf('const pipelineResult = runScanRequestPipeline'),
  );
  assert.ok(controller.indexOf('input.navigateToAnalysis(scanSessionId)') < controller.indexOf('const pipelineResult = runScanRequestPipeline'));
  assert.match(controller, /selectedScanImage: getScanPreviewImageMetadata\(previewImage\)/);
  assert.match(controller, /copyToDocuments\(prepared\.image, scanSessionId\)/);
  assert.match(controller, /runScanRequestPipeline/);
  assert.match(
    store,
    /outgoingScanImageUri && outgoingScanImageUri !== clear\.preserveImageUri/,
  );
});

test('durable scan image filenames include a per-scan unique suffix', async () => {
  const copies: string[] = [];
  const baseImage = { uri: 'file:///cache/photo.jpg', mimeType: 'image/jpeg' };
  const dependencies = (uniqueSuffix: string) => ({
    managedDirectoryUri,
    getFileInfo: async () => ({ exists: false }),
    ensureDirectory: async () => undefined,
    copyFile: async (_from: string, to: string) => { copies.push(to); },
    now: () => 321,
    uniqueSuffix: () => uniqueSuffix,
  });

  await copyToManagedScanImages(baseImage, dependencies('scan-one'));
  await copyToManagedScanImages(baseImage, dependencies('scan-two'));
  assert.notEqual(copies[0], copies[1]);
});
