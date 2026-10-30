import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getAnalysisScreenLayout } from './analysisScreenLayout';

test('scan image, icon, and content scale within SE, 16e, and 17 Pro viewports', () => {
  const devices = [
    { name: 'iPhone SE', height: 667, top: 20, bottom: 0 },
    { name: 'iPhone 16e', height: 852, top: 59, bottom: 34 },
    { name: 'iPhone 17 Pro', height: 874, top: 62, bottom: 34 },
  ];

  for (const device of devices) {
    const layout = getAnalysisScreenLayout(device.height, device.top, device.bottom);
  assert.ok(layout.imageHeight >= 170 && layout.imageHeight <= 340, `${device.name} image bounds`);
    assert.ok(layout.iconSize >= 82 && layout.iconSize <= 104, `${device.name} icon bounds`);
    assert.equal(layout.compact, device.name === 'iPhone SE');
  }
});

test('small and unusually short viewports keep a positive, bounded preview height', () => {
  const layout = getAnalysisScreenLayout(520, 30, 20);
  assert.equal(layout.compact, true);
  assert.equal(layout.imageHeight, 170);
});

test('scan loading content remains scrollable with safe-area bottom room on short phones', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const screen = readFileSync(path.join(here, '..', 'screens', 'AnalysisLoadingScreen.tsx'), 'utf8');
  assert.match(screen, /<ScrollView[\s\S]*?contentContainerStyle=\{\[styles\.screenContent, \{ paddingBottom: 40 \+ insets\.bottom \}\]\}/);
  assert.match(screen, /getAnalysisScreenLayout\(windowHeight, insets\.top, insets\.bottom\)/);
  assert.match(screen, /onLoad=\{\(\) => setPreviewLoad/);
  assert.match(screen, /onError=\{\(\) => setPreviewLoad/);
  assert.match(screen, /const stableScanImageUri = scanImageUri/);
  assert.doesNotMatch(screen, /frozenScanImageRef/);
});
