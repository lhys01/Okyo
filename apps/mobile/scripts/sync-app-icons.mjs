import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(mobileRoot, '../..');
const masterPath = resolve(mobileRoot, 'assets/app-icon/icon.png');
const master = readFileSync(masterPath);
const check = process.argv.includes('--check');
const require = createRequire(import.meta.url);

function sync(path, expected) {
  const current = existsSync(path) ? readFileSync(path) : null;
  if (current?.equals(expected)) return;
  if (check) throw new Error(`${path} is stale. Run npm run icons:generate in apps/mobile.`);
  writeFileSync(path, expected);
  console.log(`Updated ${path}`);
}

// This consumer needs a public URL. It is a generated copy, never an independent master.
const marketingPath = resolve(repoRoot, 'app-store-screenshots/public/app-icon.png');
if (existsSync(dirname(marketingPath))) sync(marketingPath, master);
if (process.argv.includes('--marketing-only')) process.exit(0);

const Jimp = require('jimp-compact'); // Already supplied by Expo's image tooling.
const { PNG } = require('pngjs');
const image = await Jimp.read(master);
if (image.bitmap.width !== 1024 || image.bitmap.height !== 1024) {
  throw new Error('The authoritative app icon must be exactly 1024×1024.');
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Tag derived PNG samples as sRGB as well; Jimp does not preserve the input color metadata.
async function png(image) {
  const buffer = PNG.sync.write(image.bitmap, { colorType: 2, inputColorType: 6 });
  const chunk = Buffer.alloc(13);
  chunk.writeUInt32BE(1, 0);
  chunk.write('sRGB', 4);
  chunk[8] = 0;
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 9)), 9);
  return Buffer.concat([buffer.subarray(0, 33), chunk, buffer.subarray(33)]);
}

sync(resolve(mobileRoot, 'assets/app-icon/favicon.png'), await png(image.clone().resize(48, 48)));

// Fit the ENTIRE square inside Android's 66/108 safe circle, including its diagonal.
// Extend only background edge colors into the padding; never crop the approved artwork.
const side = 432;
const offset = (1024 - side) / 2;
const small = image.clone().resize(side, side);
const adaptive = new Jimp(1024, 1024);
adaptive.scan(0, 0, 1024, 1024, function (x, y) {
  const inside = x >= offset && x < offset + side && y >= offset && y < offset + side;
  const lower = inside ? 0 : 2;
  const upper = inside ? side - 1 : side - 3;
  const sx = Math.max(lower, Math.min(upper, x - offset));
  const sy = Math.max(lower, Math.min(upper, y - offset));
  this.setPixelColor(small.getPixelColor(sx, sy), x, y);
});
sync(resolve(mobileRoot, 'assets/app-icon/adaptive-foreground.png'), await png(adaptive));

const { getConfig } = require('@expo/config');
const { exp: config } = getConfig(mobileRoot, { skipSDKVersionRequirement: true });
if (config.icon !== './assets/app-icon/icon.png' || config.ios?.icon !== config.icon ||
    config.android?.adaptiveIcon?.foregroundImage !== './assets/app-icon/adaptive-foreground.png' ||
    config.web?.favicon !== './assets/app-icon/favicon.png') {
  throw new Error('Resolved Expo icon configuration no longer matches the authoritative icon pipeline.');
}

const native = process.argv.indexOf('--native');
if (native !== -1) {
  if (check) throw new Error('--check and --native cannot be combined.');
  process.chdir(mobileRoot); // Expo's installed image generators resolve inputs against cwd.
  const platform = process.argv[native + 1];
  if (!['ios', 'android'].includes(platform)) throw new Error('Use --native ios or --native android.');
  if (!existsSync(resolve(mobileRoot, platform))) {
    console.log(`No generated ${platform} project yet; Expo will create its icons from app.json.`);
    process.exit(0);
  }
  const splash = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  if (platform === 'ios') {
    const { setIconsAsync } = require('@expo/prebuild-config/build/plugins/icons/withIosIcons');
    await setIconsAsync(config, mobileRoot);
    sync(resolve(mobileRoot, 'ios/Okyo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'), master);
  } else if (platform === 'android') {
    const { setIconAsync } = require('@expo/prebuild-config/build/plugins/icons/withAndroidIcons');
    await setIconAsync(mobileRoot, { icon: resolve(mobileRoot, config.android.adaptiveIcon.foregroundImage),
      backgroundColor: config.android.adaptiveIcon.backgroundColor, isAdaptive: true });
    const colors = resolve(mobileRoot, 'android/app/src/main/res/values/colors.xml');
    const xml = readFileSync(colors, 'utf8').replace(/(<color name="iconBackground">)[^<]*(<\/color>)/,
      `$1${config.android.adaptiveIcon.backgroundColor}$2`);
    sync(colors, Buffer.from(xml));
    const { setSplashImageDrawablesAsync } = require('@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/withAndroidSplashImages');
    await setSplashImageDrawablesAsync(config, splash, mobileRoot, splash.imageWidth);
  } else {
    throw new Error('Use --native ios or --native android.');
  }
}
console.log(check ? 'Icon derivatives and resolved Expo references are current.' : 'Icon assets synced from the authoritative master.');
