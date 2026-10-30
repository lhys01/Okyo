import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { applyLaunchStoryboard, writeLaunchAssets, BACKGROUND } = require('../plugins/withOkyoLaunchScreen');
const { parseStringPromise } = require('xml2js');
const { toString } = require('@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/InterfaceBuilder');
const plist = require('@expo/plist').default;
const nativeRoot = resolve(root, 'ios/Okyo');
if (existsSync(nativeRoot)) {
  writeLaunchAssets(root, 'Okyo');
  const path = resolve(nativeRoot, 'SplashScreen.storyboard');
  writeFileSync(path, toString(applyLaunchStoryboard(await parseStringPromise(readFileSync(path, 'utf8')))));
  const info = resolve(nativeRoot, 'Info.plist');
  const config = plist.parse(readFileSync(info, 'utf8'));
  config.UIStatusBarHidden = true;
  writeFileSync(info, plist.build(config));
  console.log(`Synced full-screen iOS launch artwork (${BACKGROUND}); app icon unchanged.`);
} else {
  console.log('Expo will generate the native launch screen during iOS prebuild.');
}
