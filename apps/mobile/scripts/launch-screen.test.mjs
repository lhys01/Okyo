import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
const { compileModsAsync } = require('@expo/config-plugins');
const { writeLaunchAssets } = require('../plugins/withOkyoLaunchScreen');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('Expo SDK 55 generation keeps the full-screen layout, light/dark background, and official icon', async () => {
  const iconPath = join(root, 'assets/app-icon/icon.png');
  const before = hash(await readFile(iconPath));
  const { exp } = await getPrebuildConfigAsync(root, { platforms: ['ios'] });
  const resolved = await compileModsAsync(exp, { projectRoot: root, platforms: ['ios'], introspect: true });
  const ios = resolved._internal.modResults.ios;
  const storyboard = ios.splashScreenStoryboard.document;
  const view = storyboard.scenes[0].scene[0].objects[0].viewController[0].view[0];
  const image = view.subviews[0].imageView[0].$;
  assert.equal(image.image, 'OkyoLaunchArtwork');
  assert.equal(image.contentMode, 'scaleAspectFill');
  assert.equal(image.clipsSubviews, 'YES');
  assert.deepEqual(view.constraints[0].constraint.map(({ $: c }) => [c.firstAttribute, c.secondAttribute, c.secondItem]),
    ['leading', 'trailing', 'top', 'bottom'].map((edge) => [edge, edge, view.$.id]));
  assert.equal(ios.infoPlist.UIStatusBarHidden, true);
  assert.equal(resolved.icon, './assets/app-icon/icon.png');
  assert.equal(hash(await readFile(iconPath)), before);
});

test('native generation bundles the approved PNG verbatim without a separate dark variant', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'okyo-launch-'));
  const { mkdir, copyFile } = await import('node:fs/promises');
  const asset = 'assets/splash/okyo-loading.png';
  try {
    await mkdir(join(fixture, 'assets/splash'), { recursive: true });
    await copyFile(join(root, asset), join(fixture, asset));
    writeLaunchAssets(fixture, 'Okyo');
    const catalog = join(fixture, 'ios/Okyo/Images.xcassets');
    assert.equal(hash(await readFile(join(catalog, 'OkyoLaunchArtwork.imageset/okyo-loading.png'))), hash(await readFile(join(root, asset))));
    const colors = JSON.parse(await readFile(join(catalog, 'SplashScreenBackground.colorset/Contents.json'), 'utf8')).colors;
    assert.equal(colors.length, 1);
    assert.equal(colors[0].appearances, undefined);
    assert.equal(Number(colors[0].color.components.green), 227 / 255);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
