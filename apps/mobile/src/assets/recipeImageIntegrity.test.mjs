import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Root cause of the "grey block" under Garlic Chicken Rice Bowl: the image was a
// half-downloaded JPEG. The bytes started with a valid JPEG header, so a naive
// header check passed, but the file had no end-of-image marker and the decoder
// filled the remainder with garbage. These tests check whole files, not headers.

const here = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = path.join(here, '..', '..', 'assets', 'food', 'recipes');
const INDEX = path.join(here, '..', '..', 'assets', 'food', 'index.ts');

const files = fs.readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.png'));

test('there are bundled recipe photos to check', () => {
  assert.ok(files.length > 50, `only found ${files.length} recipe images`);
});

test('every bundled recipe photo is a complete, non-truncated image', () => {
  const broken = [];
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(RECIPES_DIR, file));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    if (isJpeg) {
      // A complete JPEG ends with the End Of Image marker.
      const hasEoi = bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
      if (!hasEoi) broken.push(`${file} (truncated JPEG, no EOI marker)`);
    } else if (isPng) {
      const hasIend = bytes.subarray(bytes.length - 8).includes(Buffer.from('IEND'));
      if (!hasIend) broken.push(`${file} (truncated PNG, no IEND chunk)`);
    } else {
      broken.push(`${file} (not a JPEG or PNG)`);
    }
  }
  assert.deepEqual(broken, [], `corrupt recipe images: ${broken.join(', ')}`);
});

test('no bundled recipe photo is a placeholder stub', () => {
  // The old placeholders were a few hundred bytes; a real photo is tens of KB.
  const stubs = files
    .map((file) => ({ file, size: fs.statSync(path.join(RECIPES_DIR, file)).size }))
    .filter(({ size }) => size < 20_000)
    .map(({ file, size }) => `${file} (${size}b)`);
  assert.deepEqual(stubs, [], `placeholder images still bundled: ${stubs.join(', ')}`);
});

test('the asset map matches the files on disk', () => {
  // A mapping pointing at a deleted file crashes Metro at bundle time.
  const source = fs.readFileSync(INDEX, 'utf8');
  const mapped = [...source.matchAll(/require\('\.\/recipes\/([^']+)'\)/g)].map((m) => m[1]);
  const onDisk = new Set(files);
  const missing = [...new Set(mapped)].filter((f) => !onDisk.has(f));
  assert.deepEqual(missing, [], `asset map references missing files: ${missing.join(', ')}`);
});
