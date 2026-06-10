import {
  Image,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { mascotAssets } from '../../assets/mascot';

export type KikoMascotPose = keyof typeof mascotAssets;

type KikoMascotProps = {
  pose?: KikoMascotPose | string;
  size?: number;
  animated?: boolean;
  style?: StyleProp<ImageStyle>;
};

const defaultSize = 120;

function getSafePose(pose?: KikoMascotPose | string): KikoMascotPose {
  if (pose && Object.prototype.hasOwnProperty.call(mascotAssets, pose)) {
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
  const imageSource = mascotAssets[safePose] ?? mascotAssets.default;

  const baseStyle = [{ height: size, width: size }, style];

  return <Image resizeMode="contain" source={imageSource} style={baseStyle} />;
}
