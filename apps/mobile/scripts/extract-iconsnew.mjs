import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = dirname(scriptDir);
const sourcePath = join(mobileRoot, 'assets', 'iconsnew.png');
const outputDir = join(mobileRoot, 'assets', 'onboarding-v3', 'iconsnew');
const names = [
  'sun', 'meal', 'steak', 'protein-bar', 'shuffle',
  'timer', 'chat', 'pulse', 'balance', 'apple',
  'bread', 'portions', 'takeout', 'coins', 'fish',
  'flame', 'sparkle', 'leaf', 'target', 'bars',
];

function crop(source, x, y, width, height) {
  const out = new PNG({ width, height });
  PNG.bitblt(source, out, x, y, width, height, 0, 0);
  return out;
}

function removeExteriorBackground(image, background = [255, 255, 254], threshold = 25) {
  const count = image.width * image.height;
  const candidate = new Uint8Array(count);
  const exterior = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0; let tail = 0;
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    candidate[i] = Math.hypot(image.data[o] - background[0], image.data[o + 1] - background[1], image.data[o + 2] - background[2]) <= threshold ? 1 : 0;
  }
  const add = (i) => { if (candidate[i] && !exterior[i]) { exterior[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < image.width; x += 1) { add(x); add((image.height - 1) * image.width + x); }
  for (let y = 0; y < image.height; y += 1) { add(y * image.width); add(y * image.width + image.width - 1); }
  while (head < tail) {
    const i = queue[head++]; const x = i % image.width;
    if (i >= image.width) add(i - image.width);
    if (i < count - image.width) add(i + image.width);
    if (x > 0) add(i - 1);
    if (x < image.width - 1) add(i + 1);
  }
  for (let i = 0; i < count; i += 1) if (exterior[i]) image.data[i * 4 + 3] = 0;
}

function trimAndPad(image, padding = 12) {
  let left = image.width; let top = image.height; let right = -1; let bottom = -1;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < 0) throw new Error('icon has no opaque pixels');
  const contentWidth = right - left + 1; const contentHeight = bottom - top + 1;
  const canvas = Math.max(contentWidth, contentHeight) + padding * 2;
  const width = canvas; const height = canvas;
  const out = new PNG({ width, height });
  PNG.bitblt(image, out, left, top, contentWidth, contentHeight, Math.floor((canvas - contentWidth) / 2), Math.floor((canvas - contentHeight) / 2));
  return out;
}

const source = PNG.sync.read(readFileSync(sourcePath));
mkdirSync(outputDir, { recursive: true });
const cellWidth = source.width / 5; const cellHeight = source.height / 4;
for (let index = 0; index < names.length; index += 1) {
  const column = index % 5; const row = Math.floor(index / 5);
  const inset = 14;
  const x0 = Math.round(column * cellWidth) + inset; const y0 = Math.round(row * cellHeight) + inset;
  const x1 = Math.round((column + 1) * cellWidth) - inset; const y1 = Math.round((row + 1) * cellHeight) - inset;
  const cell = crop(source, x0, y0, x1 - x0, y1 - y0);
  removeExteriorBackground(cell);
  const output = trimAndPad(cell);
  writeFileSync(join(outputDir, `onboarding-icon-${names[index]}.png`), PNG.sync.write(output));
  console.log(`${names[index]} ${output.width}x${output.height}`);
}
