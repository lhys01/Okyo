/**
 * Create transparent production copies of the meal illustrations.
 *
 * The supplied PNGs are RGB canvases with a warm off-white background. The
 * background is removed only when its color is connected to an image edge;
 * this keeps similarly bright pixels inside the sticker (including its white
 * outline) intact.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourceDir = path.join(root, 'assets');
const outputDir = path.join(root, 'assets', 'onboarding-v3', 'meal-icons');
const names = ['iconbreakfast', 'iconlunch', 'icondinner', 'iconsnacks', 'iconvaries'];
const backgroundDistance = 12;
const edgeDistance = 4;
const padding = 16;

function processIcon(name) {
  const sourcePath = path.join(sourceDir, `${name}.png`);
  const outputPath = path.join(outputDir, `${name}-transparent.png`);
  const source = PNG.sync.read(fs.readFileSync(sourcePath));
  const { width, height, data } = source;
  const backgroundColor = [data[0], data[1], data[2]];
  const background = new Uint8Array(width * height);
  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);
  let queueHead = 0;
  let queueTail = 0;

  const isBackground = (x, y) => {
    const index = (y * width + x) * 4;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const distance = Math.hypot(
      red - backgroundColor[0],
      green - backgroundColor[1],
      blue - backgroundColor[2],
    );
    // Neutral white is intentionally excluded once it is more than a few
    // levels from the canvas color, so the sticker outline is preserved.
    const neutralWhite = distance >= edgeDistance && red === green && green === blue;
    return distance <= backgroundDistance && !neutralWhite;
  };

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (background[index] || !isBackground(x, y)) return;
    background[index] = 1;
    queueX[queueTail] = x;
    queueY[queueTail] = y;
    queueTail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  while (queueHead < queueTail) {
    const x = queueX[queueHead];
    const y = queueY[queueHead];
    queueHead += 1;
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (background[y * width + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const output = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      const outputIndex = ((y - minY) * output.width + x - minX) * 4;
      output.data[outputIndex] = data[sourceIndex];
      output.data[outputIndex + 1] = data[sourceIndex + 1];
      output.data[outputIndex + 2] = data[sourceIndex + 2];
      output.data[outputIndex + 3] = background[y * width + x] ? 0 : 255;
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, PNG.sync.write(output));
  console.log(`${name}: ${output.width}x${output.height} -> ${outputPath}`);
}

for (const name of names) processIcon(name);
