import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runScanRequestPipeline, type ScanRequestPhase } from './scanRequestPipeline';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function controller() {
  return new AbortController();
}

test('a slow upload exposes image-ready and uploading states without completing early', async () => {
  const upload = deferred<{ recipeId: string }>();
  const phases: ScanRequestPhase[] = [];
  let imageReady = '';
  let settled = false;
  const signal = controller().signal;
  const request = runScanRequestPipeline({
    prepare: async () => 'selected-image',
    persist: async (image) => `documents:${image}`,
    upload: async (image) => {
      assert.equal(image, 'documents:selected-image');
      return upload.promise;
    },
    isCurrent: () => true,
    signal,
    onPhase: (phase) => phases.push(phase),
    onImageReady: (image) => { imageReady = image; },
  }).then((result) => { settled = true; return result; });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(imageReady, 'documents:selected-image');
  assert.deepEqual(phases, ['preparing', 'uploading']);
  assert.equal(settled, false);

  upload.resolve({ recipeId: 'recipe-for-selected-image' });
  assert.deepEqual(await request, {
    kind: 'success',
    image: 'documents:selected-image',
    result: { recipeId: 'recipe-for-selected-image' },
  });
});

test('failed upload returns the exact selected image for the failure screen', async () => {
  const signal = controller().signal;
  const result = await runScanRequestPipeline({
    prepare: async () => 'selected-dumpling-image',
    persist: async (image) => `documents:${image}`,
    upload: async () => { throw new Error('offline'); },
    isCurrent: () => true,
    signal,
  });

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.equal(result.image, 'documents:selected-dumpling-image');
    assert.equal(result.error instanceof Error, true);
  }
});

test('a late response from an older scan cannot commit over a newer scan', async () => {
  const upload = deferred<string>();
  let active = true;
  let committed = false;
  let staleImage = '';
  const resultPromise = runScanRequestPipeline({
    prepare: async () => 'older-image',
    persist: async (image) => image,
    upload: () => upload.promise,
    isCurrent: () => active,
    signal: controller().signal,
    onStaleImage: (image) => { staleImage = image ?? ''; },
  }).then((result) => {
    if (result.kind === 'success') committed = true;
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  active = false;
  upload.resolve('late-old-recipe');

  assert.deepEqual(await resultPromise, { kind: 'stale' });
  assert.equal(committed, false);
  assert.equal(staleImage, 'older-image');
});

test('cancellation during image preparation prevents upload', async () => {
  const preparation = deferred<string>();
  const abort = controller();
  let uploadStarted = false;
  const resultPromise = runScanRequestPipeline({
    prepare: () => preparation.promise,
    persist: async (image) => image,
    upload: async () => { uploadStarted = true; return 'unexpected'; },
    isCurrent: () => true,
    signal: abort.signal,
  });
  abort.abort();
  preparation.resolve('stale-image');

  assert.deepEqual(await resultPromise, { kind: 'stale' });
  assert.equal(uploadStarted, false);
});

test('the app activates each picked scan before async work and commits that pipeline image', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const controllerSource = readFileSync(path.join(here, 'scanController.ts'), 'utf8');
  const hookSource = readFileSync(path.join(here, '..', 'hooks', 'useStartPickedScan.ts'), 'utf8');
  const startIndex = controllerSource.indexOf('state.beginLatestScanSession({');
  const navigationIndex = controllerSource.indexOf('input.navigateToAnalysis(scanSessionId)');
  const pipelineIndex = controllerSource.indexOf('const pipelineResult = runScanRequestPipeline');

  assert.ok(startIndex >= 0 && startIndex < navigationIndex && navigationIndex < pipelineIndex);
  assert.match(controllerSource, /writeScanResult\(scanSessionId, input\.source, result\.image\.image/);
  assert.match(hookSource, /createPickedImagePreview\(asset, source\)/);
  assert.match(hookSource, /prepareImage: \(\) => preparePickedImage\(asset, source\)/);
});
