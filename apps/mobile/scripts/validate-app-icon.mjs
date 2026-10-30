import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const defaultIcon = resolve(new URL('../assets/app-icon/icon.png', import.meta.url).pathname);
const paths = process.argv.slice(2).map((path) => resolve(path));
const iconPaths = paths.length > 0 ? paths : [defaultIcon];

for (const path of iconPaths) {
  const image = readPng(path);

  if (image.width !== 1024 || image.height !== 1024) {
    throw new Error(`${path}: app icons must be exactly 1024×1024`);
  }
  if (image.colorType !== 2 || !image.srgb) {
    throw new Error(`${path}: expected RGB PNG with explicit sRGB color metadata`);
  }
  if (image.alphaMin !== 255) {
    throw new Error(`${path}: contains transparent or semi-transparent pixels`);
  }
  if (image.darkEdgePixels > 0) {
    throw new Error(`${path}: contains black padding in the outer ${image.edgeSize}px edge`);
  }
  if (image.invalidCornerPixels > 0) {
    throw new Error(`${path}: corners must contain the approved opaque green background`);
  }

  console.log(`${path}: ${image.width}×${image.height}, RGB PNG, sRGB, opaque green corners, no dark outer padding`);
}

function readPng(path) {
  const data = readFileSync(path);
  const signature = Buffer.from('\x89PNG\r\n\x1a\n', 'binary');
  if (!data.subarray(0, 8).equals(signature)) throw new Error(`${path}: not a PNG`);

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let srgb = false;
  const compressed = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      if (chunk[12] !== 0) throw new Error(`${path}: interlaced PNGs are unsupported by this validator`);
    } else if (type === 'sRGB') {
      srgb = true;
    } else if (type === 'IDAT') {
      compressed.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`${path}: expected an 8-bit RGB or RGBA PNG`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const decoded = inflateSync(Buffer.concat(compressed));
  if (decoded.length !== height * (rowBytes + 1)) throw new Error(`${path}: invalid PNG row data`);
  const rows = [];
  let cursor = 0;
  let previous = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = decoded[cursor++];
    const row = Buffer.from(decoded.subarray(cursor, cursor + rowBytes));
    cursor += rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      row[x] = (row[x] + predictor(filter, left, above, upperLeft)) & 0xff;
    }
    rows.push(row);
    previous = row;
  }

  const edgeSize = Math.max(8, Math.floor(Math.min(width, height) * 0.02));
  let alphaMin = 255;
  let darkEdgePixels = 0;
  let invalidCornerPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = rows[y].subarray(x * bytesPerPixel, x * bytesPerPixel + bytesPerPixel);
      alphaMin = Math.min(alphaMin, colorType === 6 ? pixel[3] : 255);
      const onEdge = x < edgeSize || y < edgeSize || x >= width - edgeSize || y >= height - edgeSize;
      if (onEdge && Math.max(pixel[0], pixel[1], pixel[2]) < 16) darkEdgePixels += 1;
      const atCorner = (x < 8 || x >= width - 8) && (y < 8 || y >= height - 8);
      if (atCorner && (pixel[1] < pixel[0] + 10 || pixel[1] < pixel[2] + 10)) invalidCornerPixels += 1;
    }
  }

  return { width, height, colorType, srgb, alphaMin, darkEdgePixels, edgeSize, invalidCornerPixels };
}

function predictor(filter, left, above, upperLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return above;
  if (filter === 3) return Math.floor((left + above) / 2);
  if (filter === 4) {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
      ? left
      : aboveDistance <= upperLeftDistance ? above : upperLeft;
  }
  throw new Error(`Unsupported PNG filter ${filter}`);
}
