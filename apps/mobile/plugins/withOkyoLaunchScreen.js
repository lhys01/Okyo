const { copyFileSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { withDangerousMod, withInfoPlist } = require('expo/config-plugins');
const { withIosSplashScreenStoryboard } = require('@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/withIosSplashScreenStoryboard');

const BACKGROUND = '#1BE390';
const IMAGE_NAME = 'OkyoLaunchArtwork';
const IMAGE_PATH = 'assets/splash/okyo-loading.png';

function applyLaunchStoryboard(storyboard) {
  const view = storyboard.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
  const parent = view.$.id;
  view.subviews = [{ imageView: [{
    $: { id: 'OKYO-LaunchImage', image: IMAGE_NAME, contentMode: 'scaleAspectFill', clipsSubviews: 'YES', userInteractionEnabled: 'NO', translatesAutoresizingMaskIntoConstraints: 'NO' },
    rect: [{ $: { key: 'frame', x: '0', y: '0', width: '393', height: '852' } }],
  }] }];
  // Standard iOS launch-screen Auto Layout: fill the physical view, not its safe area.
  view.constraints = [{ constraint: ['leading', 'trailing', 'top', 'bottom'].map((edge) => ({
    $: { firstItem: 'OKYO-LaunchImage', firstAttribute: edge, secondItem: parent, secondAttribute: edge, id: `OKYO-${edge}` },
  })) }];
  const color = { alpha: '1', red: String(27 / 255), green: String(227 / 255), blue: String(144 / 255), colorSpace: 'custom', customColorSpace: 'sRGB' };
  view.color = [{ $: { key: 'backgroundColor', ...color } }];
  storyboard.document.resources[0].image = [{ $: { name: IMAGE_NAME, width: '850', height: '1850' } }];
  storyboard.document.resources[0].namedColor = [{
    $: { name: 'SplashScreenBackground' }, color: [{ $: color }],
  }];
  return storyboard;
}

function writeLaunchAssets(projectRoot, projectName) {
  const directory = join(projectRoot, 'ios', projectName, 'Images.xcassets', `${IMAGE_NAME}.imageset`);
  mkdirSync(directory, { recursive: true });
  copyFileSync(join(projectRoot, IMAGE_PATH), join(directory, 'okyo-loading.png'));
  writeFileSync(join(directory, 'Contents.json'), JSON.stringify({ images: [{ idiom: 'universal', filename: 'okyo-loading.png', scale: '1x' }], info: { version: 1, author: 'expo' } }, null, 2) + '\n');
  // Superseded generated logo; the storyboard now uses only OkyoLaunchArtwork.
  rmSync(join(directory, '..', 'SplashScreenLogo.imageset'), { recursive: true, force: true });
  const colors = join(directory, '..', 'SplashScreenBackground.colorset');
  mkdirSync(colors, { recursive: true });
  writeFileSync(join(colors, 'Contents.json'), JSON.stringify({ colors: [{ idiom: 'universal', color: { 'color-space': 'srgb', components: { red: String(27 / 255), green: String(227 / 255), blue: String(144 / 255), alpha: '1' } } }], info: { version: 1, author: 'expo' } }, null, 2) + '\n');
}

// Register BEFORE expo-splash-screen: its storyboard provider runs our layout last.
module.exports = function withOkyoLaunchScreen(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIStatusBarHidden = true;
    return mod;
  });
  config = withIosSplashScreenStoryboard(config, (mod) => {
    mod.modResults = applyLaunchStoryboard(mod.modResults);
    return mod;
  });
  return withDangerousMod(config, ['ios', async (mod) => {
    writeLaunchAssets(mod.modRequest.projectRoot, mod.modRequest.projectName || 'Okyo');
    return mod;
  }]);
};
module.exports.applyLaunchStoryboard = applyLaunchStoryboard;
module.exports.writeLaunchAssets = writeLaunchAssets;
module.exports.BACKGROUND = BACKGROUND;
