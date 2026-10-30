import assert from 'node:assert/strict';
import test from 'node:test';

import { createPickedImagePreview, getScanPreviewImageMetadata, hasUsableLocalImage } from './scanImageReference';

const pickedAsset = (uri: string) => ({ uri, mimeType: 'image/jpeg', width: 1200, height: 900 });

test('selecting one image immediately creates a private local preview reference', () => {
  const preview = createPickedImagePreview(pickedAsset('file:///cache/selected-one.jpg'), 'photos');

  assert.deepEqual(preview, {
    uri: 'file:///cache/selected-one.jpg',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 900,
    source: 'photos',
    placeholder: false,
  });
  assert.equal(preview.fileName, undefined);
  assert.equal(preview.sizeBytes, undefined);
  assert.equal(preview.dataUrl, undefined);
});

test('selecting a second image never reuses the first preview URI', () => {
  const first = createPickedImagePreview(pickedAsset('file:///cache/first.jpg'), 'photos');
  const second = createPickedImagePreview(pickedAsset('file:///cache/second.jpg'), 'photos');

  assert.notStrictEqual(first, second);
  assert.equal(second.uri, 'file:///cache/second.jpg');
});

test('replacing the selection before submission uses the replacement image', () => {
  let selected = pickedAsset('file:///cache/old.jpg');
  selected = pickedAsset('file:///cache/replacement.jpg');

  const submittedPreview = createPickedImagePreview(selected, 'camera');
  assert.equal(submittedPreview.uri, 'file:///cache/replacement.jpg');
  assert.equal(submittedPreview.source, 'camera');
});

const apiImage = {
  source: 'photos' as const,
  mimeType: 'image/jpeg',
  width: 1280,
  height: 960,
};

for (const source of ['camera', 'photos'] as const) {
  test(`${source} keeps the durable local image when the API response omits the URI`, () => {
    const localImage = {
      source,
      uri: `file:///documents/okyo-scan-images/${source}-meal.jpg`,
      dataUrl: 'data:image/jpeg;base64,private-preview-bytes',
    };

    const preview = getScanPreviewImageMetadata(localImage, apiImage);

    assert.equal(preview?.uri, localImage.uri);
    assert.equal(preview?.dataUrl, undefined);
    assert.equal(preview?.source, source);
  });
}

test('API response metadata is only a fallback when no local preview is available', () => {
  const preview = getScanPreviewImageMetadata(null, {
    ...apiImage,
    uri: 'https://cdn.example.test/scan.jpg',
  });

  assert.equal(preview?.uri, 'https://cdn.example.test/scan.jpg');
  assert.equal(preview?.dataUrl, undefined);
});

test('the selected dumpling image wins over a different API image and stays attached to the result', () => {
  const selectedDumpling = {
    source: 'photos' as const,
    uri: 'file:///documents/okyo-scan-images/dumpling-scan.jpg',
    dataUrl: 'data:image/jpeg;base64,local-dumpling',
  };
  const unrelatedApiImage = { ...apiImage, uri: 'https://cdn.example.test/rice.jpg' };

  const resultImage = getScanPreviewImageMetadata(selectedDumpling, unrelatedApiImage);
  assert.equal(resultImage?.uri, selectedDumpling.uri);
  assert.notEqual(resultImage?.uri, unrelatedApiImage.uri);
});

test('missing or placeholder images remain unavailable instead of inventing a preview', () => {
  assert.equal(getScanPreviewImageMetadata(null, null), null);
  assert.equal(getScanPreviewImageMetadata({ uri: 'file:///deleted.jpg', placeholder: true }, null), null);
  assert.equal(hasUsableLocalImage({ uri: 'file:///deleted.jpg', placeholder: true }), false);
});

test('empty local references do not mask a usable API image', () => {
  const preview = getScanPreviewImageMetadata({ uri: '  ', source: 'photos' }, {
    uri: 'https://cdn.example.test/scan.jpg',
    source: 'photos',
  });

  assert.equal(preview?.uri, 'https://cdn.example.test/scan.jpg');
});
