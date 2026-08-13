import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pngjs from 'pngjs';

const { PNG } = pngjs;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = dirname(scriptDir);
const sourceDir = join(mobileRoot, 'assets', 'onboarding ex');
const outputDir = join(mobileRoot, 'assets', 'onboarding-ex-transparent');

export const TRANSPARENT_DISTANCE = 6;
export const OPAQUE_DISTANCE = 13;

// Pixel coordinates are measured against the approved 941×1672 source comps.
// Crops preserve native pixels; the script never resizes or overwrites a source.
export const DERIVATIVES = Object.freeze([
  { source: 'onboarding1.png', output: 'kiko-head-mark.png', crop: [280, 690, 390, 360], opaqueDistance: 8, largest: true },
  {
    source: 'onboarding2.png',
    output: 'o2-pasta-bowl.png',
    crop: [28, 0, 455, 455],
    ellipse: [270, 205, 205, 205, 5],
    removeBlueBackdrop: true,
    removeDarkInkRegions: [[0, 0, 140, 100]],
    eraseRects: [[430, 320, 25, 135]],
    eraseRotatedRoundedRects: [[270, 418, 205, 82, 30, -0.12]],
  },
  {
    source: 'onboarding2.png',
    output: 'o2-hero-card.png',
    crop: [28, 0, 500, 500],
    roundedRect: 34,
    removeDarkInkRegions: [[0, 0, 160, 105]],
  },
  {
    source: 'onboarding2.png',
    output: 'o2-kiko-circle.png',
    crop: [620, 280, 310, 340],
    ellipse: [155, 170, 150, 165, 4],
  },
  { source: 'onboarding3.png', output: 'o3-grain-bowl.png', crop: [108, 258, 724, 828], background: [253, 247, 239] },
  { source: 'onboarding3.png', output: 'o3-approved-composition.png', crop: [108, 258, 724, 828], roundedRect: 30 },
  {
    source: 'onboarding4.png',
    output: 'o4-chicken-bowl.png',
    crop: [202, 590, 520, 214],
    roundedRect: 16,
  },
  {
    source: 'onboarding4.png',
    output: 'o4-clean-chicken-bowl.png',
    crop: [210, 650, 410, 155],
    roundedRect: 18,
  },
  {
    source: 'onboarding4.png',
    output: 'o4-kiko.png',
    crop: [310, 245, 455, 405],
    roundedRect: 16,
  },
  { source: 'onboarding4.png', output: 'o4-approved-composition.png', crop: [115, 242, 704, 866], roundedRect: 30 },
  { source: 'onboarding5.png', output: 'o5-quinoa-bowl.png', crop: [120, 665, 720, 500], background: [251, 243, 232], largest: true },
  { source: 'onboarding5.png', output: 'o5-kiko-badge.png', crop: [78, 890, 290, 285], ellipse: [147, 143, 138, 138, 4] },
  { source: 'onboarding5.png', output: 'o5-approved-composition.png', crop: [115, 245, 710, 915], roundedRect: 30 },
  { source: 'onboarding6.png', output: 'o6-kiko-mark.png', crop: [405, 165, 135, 105], background: [248, 247, 253], largest: true },
  { source: 'onboarding7.png', output: 'o7-graph-frame.png', crop: [60, 540, 825, 690], background: [253, 243, 230], eraseGraphLines: true, eraseRects: [[615, 90, 160, 60], [595, 395, 165, 95]] },
  { source: 'onboarding8.png', output: 'o8-card-scan.png', crop: [42, 535, 505, 520], background: [252, 243, 232] },
  { source: 'onboarding8.png', output: 'o8-card-macros.png', crop: [475, 585, 420, 485], background: [252, 243, 232] },
  { source: 'onboarding8.png', output: 'o8-card-customize.png', crop: [225, 985, 505, 485], background: [252, 243, 232] },
  { source: 'onboarding9.png', output: 'o9-pasta-bowl.png', crop: [198, 225, 522, 377], roundedRect: 24 },
  { source: 'onboarding9.png', output: 'o9-tile-leaf.png', crop: [242, 225, 102, 102], background: [251, 242, 231], largest: true },
  { source: 'onboarding9.png', output: 'o9-tile-chart.png', crop: [618, 258, 102, 102], background: [251, 242, 231], largest: true },
  { source: 'onboarding9.png', output: 'o9-tile-chef.png', crop: [198, 470, 105, 105], background: [251, 242, 231], largest: true },
  { source: 'onboarding9.png', output: 'o9-tile-clock.png', crop: [615, 497, 105, 105], background: [251, 242, 231], largest: true },
  { source: 'onboarding9.png', output: 'o9-brackets.png', crop: [350, 300, 255, 255], darkOnly: true, keepRegions: [[0, 0, 72, 68], [183, 0, 72, 68], [0, 187, 72, 68], [183, 187, 72, 68]] },
  { source: 'onboarding9.png', output: 'o9-sparkles.png', crop: [360, 230, 370, 210], background: [251, 242, 231], keepRegions: [[0, 0, 55, 55], [320, 160, 50, 50]] },
  { source: 'onboarding10.png', output: 'o10-kiko-hero.png', crop: [195, 540, 610, 655], background: [253, 247, 237], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-carrot.png', crop: [55, 1450, 160, 145], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-mushroom.png', crop: [45, 1280, 160, 145], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-herb.png', crop: [55, 1100, 145, 155], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-fishbone.png', crop: [720, 1160, 175, 190], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-applecore.png', crop: [770, 1340, 170, 200], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-sparkle.png', crop: [95, 980, 105, 125], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-squiggle.png', crop: [690, 680, 160, 145], largest: true },
  { source: 'onboarding10.png', output: 'o10-doodle-recipecard.png', crop: [220, 1340, 525, 332] },
  { source: 'onboarding11.png', output: 'o11-kiko-peek.png', crop: [535, 65, 406, 565], background: [252, 246, 236], opaqueDistance: 8, largest: true },
]);

export function cropPng(source, [x, y, width, height]) {
  const output = new PNG({ width, height });
  PNG.bitblt(source, output, x, y, width, height, 0, 0);
  return output;
}

export function removeExteriorBackground(
  image,
  { transparentDistance = TRANSPARENT_DISTANCE, opaqueDistance = OPAQUE_DISTANCE, background: backgroundOverride } = {},
) {
  if (opaqueDistance < 8) throw new Error('opaqueDistance must be at least 8');
  const background = backgroundOverride ?? estimateBorderMedian(image, Math.min(80, Math.floor(Math.min(image.width, image.height) / 4)));
  const pixelCount = image.width * image.height;
  const distances = new Float32Array(pixelCount);
  const candidate = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const distance = Math.hypot(
      image.data[offset] - background[0],
      image.data[offset + 1] - background[1],
      image.data[offset + 2] - background[2],
    );
    distances[index] = distance;
    candidate[index] = distance < opaqueDistance ? 1 : 0;
  }

  const exterior = floodExterior(candidate, image.width, image.height);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    if (!exterior[index]) {
      image.data[offset + 3] = 255;
      continue;
    }
    const distance = distances[index];
    let alpha = 0;
    if (distance > transparentDistance) {
      const t = Math.min(1, (distance - transparentDistance) / (opaqueDistance - transparentDistance));
      alpha = Math.round(255 * t * t * (3 - 2 * t));
    }
    if (alpha > 0 && alpha < 72) alpha = 0;
    if (alpha > 0 && alpha < 255) {
      const a = Math.max(alpha / 255, 1 / 255);
      for (let channel = 0; channel < 3; channel += 1) {
        image.data[offset + channel] = clampByte(
          (image.data[offset + channel] - (1 - a) * background[channel]) / a,
        );
      }
    }
    image.data[offset + 3] = alpha;
  }
  return { image, background };
}

function estimateBorderMedian(image, band) {
  const channels = [[], [], []];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (x >= band && x < image.width - band && y >= band && y < image.height - band) continue;
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) channels[channel].push(image.data[offset + channel]);
    }
  }
  return channels.map((values) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function floodExterior(candidate, width, height) {
  const exterior = new Uint8Array(candidate.length);
  const queue = new Int32Array(candidate.length);
  let head = 0;
  let tail = 0;
  for (let x = 0; x < width; x += 1) {
    for (const index of [x, (height - 1) * width + x]) {
      if (candidate[index] && !exterior[index]) {
        exterior[index] = 1;
        queue[tail++] = index;
      }
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (const index of [y * width, y * width + width - 1]) {
      if (candidate[index] && !exterior[index]) {
        exterior[index] = 1;
        queue[tail++] = index;
      }
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const neighbors = [index - width, index + width, index - 1, index + 1];
    for (const next of neighbors) {
      if (next < 0 || next >= candidate.length || exterior[next] || !candidate[next]) continue;
      if ((next === index - 1 && x === 0) || (next === index + 1 && x === width - 1)) continue;
      exterior[next] = 1;
      queue[tail++] = next;
    }
  }
  return exterior;
}

function applyEllipseMask(image, [centerX, centerY, radiusX, radiusY, feather]) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const normalized = Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY);
      const inner = 1 - feather / Math.max(radiusX, radiusY);
      const mask = normalized <= inner ? 1 : normalized >= 1 ? 0 : (1 - normalized) / (1 - inner);
      const offset = (y * image.width + x) * 4 + 3;
      image.data[offset] = Math.round(image.data[offset] * mask);
    }
  }
}

function applyRoundedRectMask(image, radius) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const dx = Math.max(radius - x, 0, x - (image.width - 1 - radius));
      const dy = Math.max(radius - y, 0, y - (image.height - 1 - radius));
      if (Math.hypot(dx, dy) > radius) image.data[(y * image.width + x) * 4 + 3] = 0;
    }
  }
}

function eraseRects(image, rectangles) {
  for (const [x, y, width, height] of rectangles) {
    for (let py = Math.max(0, y); py < Math.min(image.height, y + height); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(image.width, x + width); px += 1) {
        image.data[(py * image.width + px) * 4 + 3] = 0;
      }
    }
  }
}

function eraseRotatedRoundedRects(image, rectangles) {
  for (const [centerX, centerY, width, height, radius, rotation] of rectangles) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const innerHalfWidth = width / 2 - radius;
    const innerHalfHeight = height / 2 - radius;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const localX = Math.abs(dx * cos + dy * sin);
        const localY = Math.abs(-dx * sin + dy * cos);
        const cornerX = Math.max(0, localX - innerHalfWidth);
        const cornerY = Math.max(0, localY - innerHalfHeight);
        if (cornerX * cornerX + cornerY * cornerY <= radius * radius) {
          image.data[(y * image.width + x) * 4 + 3] = 0;
        }
      }
    }
  }
}

function keepRegions(image, regions) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!regions.some(([rx, ry, width, height]) => x >= rx && x < rx + width && y >= ry && y < ry + height)) {
        image.data[(y * image.width + x) * 4 + 3] = 0;
      }
    }
  }
}

function keepDarkInk(image) {
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    const brightness = (image.data[offset] + image.data[offset + 1] + image.data[offset + 2]) / 3;
    image.data[offset + 3] = brightness < 125 ? 255 : 0;
  }
}

function removeDarkInkRegions(image, regions) {
  for (const [regionX, regionY, width, height] of regions) {
    for (let y = regionY; y < Math.min(image.height, regionY + height); y += 1) {
      for (let x = regionX; x < Math.min(image.width, regionX + width); x += 1) {
        const offset = (y * image.width + x) * 4;
        const brightness = (image.data[offset] + image.data[offset + 1] + image.data[offset + 2]) / 3;
        if (brightness < 80) image.data[offset + 3] = 0;
      }
    }
  }
}

function eraseGraphLines(image) {
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    const [r, g, b] = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
    const coral = r > 205 && g < 165 && b < 145 && r - g > 55;
    const green = g > 105 && g - r > 25 && g - b > 15;
    if (coral || green) image.data[offset + 3] = 0;
  }
}

function removeBlueBackdrop(image) {
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    const [r, g, b] = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
    if (b > 205 && b - r > 12 && b - g > 5) image.data[offset + 3] = 0;
  }
}

function keepLargestAlphaComponent(image) {
  const count = image.width * image.height;
  const seen = new Uint8Array(count);
  let largest = [];
  for (let start = 0; start < count; start += 1) {
    if (seen[start] || image.data[start * 4 + 3] === 0) continue;
    const component = [];
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      component.push(index);
      const x = index % image.width;
      for (const next of [index - image.width, index + image.width, index - 1, index + 1]) {
        if (next < 0 || next >= count || seen[next] || image.data[next * 4 + 3] === 0) continue;
        if ((next === index - 1 && x === 0) || (next === index + 1 && x === image.width - 1)) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(count);
  for (const index of largest) keep[index] = 1;
  for (let index = 0; index < count; index += 1) {
    if (!keep[index]) image.data[index * 4 + 3] = 0;
  }
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function deriveAsset(source, definition) {
  const image = cropPng(source, definition.crop);
  if (definition.ellipse) {
    applyEllipseMask(image, definition.ellipse);
  } else if (definition.roundedRect) {
    applyRoundedRectMask(image, definition.roundedRect);
  } else {
    removeExteriorBackground(image, {
      background: definition.background,
      opaqueDistance: definition.opaqueDistance ?? OPAQUE_DISTANCE,
    });
  }
  if (definition.eraseRects) eraseRects(image, definition.eraseRects);
  if (definition.eraseRotatedRoundedRects) eraseRotatedRoundedRects(image, definition.eraseRotatedRoundedRects);
  if (definition.removeBlueBackdrop) removeBlueBackdrop(image);
  if (definition.eraseGraphLines) eraseGraphLines(image);
  if (definition.keepRegions) keepRegions(image, definition.keepRegions);
  if (definition.darkOnly) keepDarkInk(image);
  if (definition.removeDarkInkRegions) removeDarkInkRegions(image, definition.removeDarkInkRegions);
  if (definition.largest) keepLargestAlphaComponent(image);
  for (const offset of [3, (image.width - 1) * 4 + 3, ((image.height - 1) * image.width) * 4 + 3, (image.width * image.height - 1) * 4 + 3]) {
    image.data[offset] = 0;
  }
  return image;
}

export function runDerivation({ dryRun = false } = {}) {
  if (!dryRun) mkdirSync(outputDir, { recursive: true });
  const sourceCache = new Map();
  console.log('source -> derivative | crop [x,y,width,height]');
  for (const definition of DERIVATIVES) {
    let source = sourceCache.get(definition.source);
    if (!source) {
      source = PNG.sync.read(readFileSync(join(sourceDir, definition.source)));
      sourceCache.set(definition.source, source);
    }
    const output = deriveAsset(source, definition);
    console.log(`${definition.source} -> ${definition.output} | [${definition.crop.join(',')}]${dryRun ? ' (dry-run)' : ''}`);
    if (!dryRun) writeFileSync(join(outputDir, definition.output), PNG.sync.write(output));
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) runDerivation({ dryRun: process.argv.includes('--dry-run') });
