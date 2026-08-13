import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import pngjs from 'pngjs';

import { removeExteriorBackground } from './derive-onboarding-transparency.mjs';

const { PNG } = pngjs;
const scriptDir = new URL('.', import.meta.url).pathname;
const mobileRoot = join(scriptDir, '..');
const sourceDir = join(mobileRoot, 'assets', 'kiko-static');
const outputDir = join(sourceDir, 'transparent-generated');

const sources = Object.freeze({
  default: 'e608cbae-daaf-4c93-a030-eaf19caa4c02.png',
  wave: 'ec041431-c9cf-47fa-be98-d878c23d299a.png',
  happy: '7a66978e-3804-40e0-98d8-49fa14892b32.png',
  thinking: '7030013a-09f8-469e-9e0c-42b20f478a21.png',
  cooking: '40b4aa9b-1feb-4b6b-b4dc-c1af7c11b9ee.png',
  celebrating: '2a6be0ee-fc9c-4764-a9a6-4b986e7abe58.png',
  success: 'c279b3db-0645-4378-b1a7-91e9628f1079.png',
  pointing: '2b5bb906-8664-4d1b-9b9c-68e273daba67.png',
  scanning: '384183e9-8ebb-4d77-9c80-afae5aed6102.png',
  groceryList: 'bb5aa691-ce28-43ae-a353-8bc73f3ca365.png',
  recipe: '89cb6dd1-744e-46b9-a6b7-40d7cd33be60.png',
  recipeCard: '7d2db6d2-1953-40da-be95-888df7479345.png',
  waveAlt: '7b015d63-792c-484b-9308-f99f406e60e4.png',
  sideProfile: '958e38df-ef26-4e68-8651-0821a144a0ed.png',
});

mkdirSync(outputDir, { recursive: true });
for (const [pose, filename] of Object.entries(sources)) {
  const image = PNG.sync.read(readFileSync(join(sourceDir, filename)));
  const { image: transparent } = removeExteriorBackground(image, { opaqueDistance: 18 });
  writeFileSync(join(outputDir, `kiko-${pose}.png`), PNG.sync.write(transparent));
}

console.log(`Derived ${Object.keys(sources).length} transparent Kiko assets.`);
