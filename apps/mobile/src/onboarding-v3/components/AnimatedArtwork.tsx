import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useSettleAnimation } from '../motion/useSettleAnimation';

export function AnimatedArtwork({
  children,
  settledKey,
  kind = 'page',
  style,
}: {
  children: ReactNode;
  settledKey: number | string;
  kind?: 'page' | 'kiko';
  style?: StyleProp<ViewStyle>;
}) {
  const animatedStyle = useSettleAnimation(settledKey, kind);
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
