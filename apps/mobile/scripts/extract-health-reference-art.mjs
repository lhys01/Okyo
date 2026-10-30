import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';

const mobileRoot = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(mobileRoot, 'assets/onboarding-v3/health-reference');

const crops = [
  { source: 'new-onboarding1.png', output: 'kiko-health-intro.png', x: 165, y: 745, width: 545, height: 590, radius: 18 },
  { source: 'new-onboarding2.png', output: 'kiko-approach.png', x: 195, y: 1195, width: 475, height: 485, radius: 27 },
  { source: 'new-onboarding3.png', output: 'kiko-carrot.png', x: 190, y: 565, width: 520, height: 610, radius: 18 },
  { source: 'new-onboarding4.png', output: 'kiko-plan-complete.png', x: 465, y: 1220, width: 350, height: 405, radius: 16 },
];

const indexOf = (x, y, width) => y * width + x;

function isForegroundSeed(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation > 0.16 || max < 155;
}

function seedMask(image) {
  const mask = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = indexOf(x, y, image.width) * 4;
      mask[indexOf(x, y, image.width)] = isForegroundSeed(image.data[pixel], image.data[pixel + 1], image.data[pixel + 2]) ? 1 : 0;
    }
  }
  return mask;
}

function foregroundComponents(mask, width, height, minimumArea = 28) {
  const seen = new Uint8Array(mask.length);
  const kept = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    const component = [];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (const [dx, dy] of neighbors) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = indexOf(nextX, nextY, width);
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    const touchesEdge = component.some((pixel) => {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      return x === 0 || y === 0 || x === width - 1 || y === height - 1;
    });
    if (component.length >= minimumArea && !touchesEdge) kept.push(component);
  }
  return kept;
}

function distanceFromSeed(mask, width, height) {
  const diagonal = Math.SQRT2;
  const distance = new Float32Array(mask.length);
  distance.fill(1e6);
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) distance[i] = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = indexOf(x, y, width);
    if (x > 0) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (y > 0) distance[i] = Math.min(distance[i], distance[i - width] + 1);
    if (x > 0 && y > 0) distance[i] = Math.min(distance[i], distance[i - width - 1] + diagonal);
    if (x + 1 < width && y > 0) distance[i] = Math.min(distance[i], distance[i - width + 1] + diagonal);
  }
  for (let y = height - 1; y >= 0; y -= 1) for (let x = width - 1; x >= 0; x -= 1) {
    const i = indexOf(x, y, width);
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width] + 1);
    if (x + 1 < width && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width + 1] + diagonal);
    if (x > 0 && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width - 1] + diagonal);
  }
  return distance;
}

function fillMaskHoles(mask, width, height, maximumHoleArea = 18000) {
  const filled = Uint8Array.from(mask);
  const seen = new Uint8Array(mask.length);
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] || seen[start]) continue;
    const queue = [start];
    const component = [];
    let touchesEdge = false;
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      for (const [dx, dy] of neighbors) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = indexOf(nextX, nextY, width);
        if (!mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      }
    }
    if (!touchesEdge && component.length <= maximumHoleArea) component.forEach((pixel) => { filled[pixel] = 1; });
  }
  return filled;
}

function extract(config) {
  const sourcePath = resolve(mobileRoot, 'assets', config.source);
  const source = PNG.sync.read(readFileSync(sourcePath));
  const crop = new PNG({ width: config.width, height: config.height });
  PNG.bitblt(source, crop, config.x, config.y, config.width, config.height, 0, 0);
  const components = foregroundComponents(seedMask(crop), crop.width, crop.height);
  const filled = new Uint8Array(crop.width * crop.height);
  for (const component of components) {
    const componentMask = new Uint8Array(filled.length);
    component.forEach((pixel) => { componentMask[pixel] = 1; });
    const componentDistance = distanceFromSeed(componentMask, crop.width, crop.height);
    const expanded = new Uint8Array(filled.length);
    for (let i = 0; i < expanded.length; i += 1) expanded[i] = componentDistance[i] <= config.radius ? 1 : 0;
    const componentFilled = fillMaskHoles(expanded, crop.width, crop.height);
    for (let i = 0; i < filled.length; i += 1) if (componentFilled[i]) filled[i] = 1;
  }
  const edgeDistance = distanceFromSeed(filled, crop.width, crop.height);
  let left = crop.width;
  let top = crop.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < crop.height; y += 1) for (let x = 0; x < crop.width; x += 1) {
    const i = indexOf(x, y, crop.width);
    const alpha = filled[i] ? 255 : edgeDistance[i] <= 1 ? Math.round(255 * (1 - edgeDistance[i] / 1.5)) : 0;
    crop.data[i * 4 + 3] = alpha;
    if (alpha > 0) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  const padding = 4;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(crop.width - 1, right + padding);
  bottom = Math.min(crop.height - 1, bottom + padding);
  const output = new PNG({ width: right - left + 1, height: bottom - top + 1 });
  PNG.bitblt(crop, output, left, top, output.width, output.height, 0, 0);
  const outputPath = resolve(outputDirectory, config.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, PNG.sync.write(output));
  console.log(`${config.source} -> ${config.output} (${output.width}x${output.height})`);
}

crops.forEach(extract);
