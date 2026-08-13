import assert from 'node:assert/strict';
import test from 'node:test';

import { DERIVATIVES, deriveAsset, removeExteriorBackground } from './derive-onboarding-transparency.mjs';

test('exterior keying preserves opaque RGB, protects enclosed pale regions, and decontaminates edges', () => {
  const image = { width: 9, height: 9, data: new Uint8Array(9 * 9 * 4) };
  const background = [250, 240, 230];
  for (let index = 0; index < 81; index += 1) {
    image.data.set([...background, 255], index * 4);
  }

  // A connected dark ring encloses a pale center that is deliberately close
  // to the sampled background. Flood fill must not erase the enclosed pixel.
  for (let y = 2; y <= 6; y += 1) {
    for (let x = 2; x <= 6; x += 1) {
      if (x === 2 || x === 6 || y === 2 || y === 6) {
        image.data.set([120, 40, 20, 255], (y * 9 + x) * 4);
      }
    }
  }
  image.data.set([248, 238, 228, 255], (4 * 9 + 4) * 4);

  // Exterior ramp pixel: source is a 50/50 composite of red foreground over bg.
  image.data.set([253, 120, 115, 255], (1 * 9 + 1) * 4);
  const opaqueRgbBefore = Array.from(image.data.slice((2 * 9 + 2) * 4, (2 * 9 + 2) * 4 + 3));
  removeExteriorBackground(image, { transparentDistance: 6, opaqueDistance: 200 });

  assert.equal(image.data[3], 0, 'corner reaches alpha zero');
  assert.equal(image.data[(4 * 9 + 4) * 4 + 3], 255, 'enclosed pale region stays opaque');
  assert.deepEqual(
    Array.from(image.data.slice((2 * 9 + 2) * 4, (2 * 9 + 2) * 4 + 3)),
    opaqueRgbBefore,
    'opaque object RGB remains byte-identical',
  );
  const rampOffset = (1 * 9 + 1) * 4;
  assert.ok(image.data[rampOffset + 3] > 0 && image.data[rampOffset + 3] < 255);
  assert.ok(image.data[rampOffset] >= 253, 'decontamination removes background contribution');
});

test('hero pasta derivative clears source chrome and the baked time badge', () => {
  const definition = DERIVATIVES.find(({ output }) => output === 'o2-pasta-bowl.png');
  assert.ok(definition);

  const width = definition.crop[0] + definition.crop[2];
  const height = definition.crop[1] + definition.crop[3];
  const image = {
    width,
    height,
    data: Buffer.alloc(width * height * 4, 255),
  };
  image.data.set([205, 229, 246, 255], ((definition.crop[1] + 100) * width + definition.crop[0] + 140) * 4);
  image.data.set([15, 15, 18, 255], ((definition.crop[1] + 50) * width + definition.crop[0] + 118) * 4);
  const derived = deriveAsset(image, definition);
  const alphaAt = (x: number, y: number) => derived.data[(y * derived.width + x) * 4 + 3];

  assert.equal(alphaAt(60, 45), 0, 'status bar region is transparent');
  assert.equal(alphaAt(115, 50), 0, 'the plate silhouette excludes the final status-bar digit');
  assert.equal(alphaAt(115, 65), 0, 'the feathered upper-left edge excludes status-bar antialiasing');
  assert.equal(alphaAt(260, 400), 0, 'source time badge region is transparent');
  assert.equal(alphaAt(442, 365), 0, 'source arrow region is transparent');
  assert.equal(alphaAt(140, 100), 0, 'blue source backdrop is transparent');
  assert.equal(alphaAt(118, 50), 0, 'dark source status ink is transparent');
  assert.equal(alphaAt(233, 205), 255, 'dish center remains opaque');
});

test('opening hero card preserves the approved onboarding2 backdrop while clearing status ink', () => {
  const definition = DERIVATIVES.find(({ output }) => output === 'o2-hero-card.png');
  assert.ok(definition);
  const width = definition.crop[0] + definition.crop[2];
  const height = definition.crop[1] + definition.crop[3];
  const image = { width, height, data: Buffer.alloc(width * height * 4) };
  for (let index = 0; index < width * height; index += 1) image.data.set([205, 229, 246, 255], index * 4);
  image.data.set([15, 15, 18, 255], ((definition.crop[1] + 50) * width + definition.crop[0] + 60) * 4);
  const derived = deriveAsset(image, definition);
  const alphaAt = (x: number, y: number) => derived.data[(y * derived.width + x) * 4 + 3];

  assert.equal(alphaAt(60, 50), 0, 'status text is cleared');
  assert.equal(alphaAt(250, 250), 255, 'approved blue backdrop is preserved inside the card');
  assert.equal(alphaAt(0, 0), 0, 'rounded card corner stays transparent');
});
