import {
  Image,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { kikoAssets, type KikoAssetPose } from '../assets/kikoAssets';
import { getTransparentKikoAsset } from '../assets/kikoTransparentAssets';

export type KikoMascotPose = KikoAssetPose;

type KikoMascotProps = {
  pose?: KikoMascotPose | string;
  size?: number;
  animated?: boolean;
  style?: StyleProp<ImageStyle>;
};

const defaultSize = 120;

function getSafePose(pose?: KikoMascotPose | string): KikoMascotPose {
  if (pose && Object.prototype.hasOwnProperty.call(kikoAssets, pose)) {
    return pose as KikoMascotPose;
  }

  return 'default';
}

export function KikoMascot({
  pose,
  size = defaultSize,
  animated: _animated = false,
  style,
}: KikoMascotProps) {
  const safePose = getSafePose(pose);
  const imageSource = getTransparentKikoAsset(safePose);

  const baseStyle = [{ height: size, width: size }, style];

  return <Image resizeMode="contain" source={imageSource} style={baseStyle} />;
}
