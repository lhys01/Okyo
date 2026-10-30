import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pngjs from 'pngjs';

import { removeExteriorBackground } from './derive-onboarding-transparency.mjs';

const { PNG } = pngjs;
const mobileRoot = new URL('..', import.meta.url).pathname;
const sourceDirectory = join(mobileRoot, 'assets');
const outputDirectory = join(sourceDirectory, 'onboarding-v3', 'cutefox');
const sources = ['cutefox', 'cutefox2', 'cutefox3'];

mkdirSync(outputDirectory, { recursive: true });
for (const name of sources) {
  const image = PNG.sync.read(readFileSync(join(sourceDirectory, `${name}.png`)));
  const { image: transparent } = removeExteriorBackground(image, {
    background: [255, 255, 255],
    opaqueDistance: 24,
  });
  writeFileSync(join(outputDirectory, `${name}.png`), PNG.sync.write(transparent));
}

console.log(`Derived transparent render copies for ${sources.length} supplied fox assets.`);
