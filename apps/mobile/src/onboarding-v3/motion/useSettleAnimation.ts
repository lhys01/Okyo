import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { motionTokens } from './motionTokens';
import { useReduceMotion } from './useReduceMotion';

export function useSettleAnimation(
  settledKey: number | string,
  kind: 'page' | 'kiko' = 'page',
) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue<number>(kind === 'kiko' ? motionTokens.settle.kikoInitialOpacity : motionTokens.settle.pageInitialOpacity);
  const translateY = useSharedValue<number>(kind === 'kiko' ? motionTokens.settle.kikoTranslateY : motionTokens.settle.pageTranslateY);
  const scale = useSharedValue<number>(kind === 'kiko' ? motionTokens.settle.kikoInitialScale : 1);

  useEffect(() => {
    const delay = kind === 'kiko' && !reduceMotion ? motionTokens.settle.kikoDelayMs : 0;
    const duration = reduceMotion
      ? motionTokens.settle.reduceMotionMs
      : kind === 'kiko' ? motionTokens.settle.kikoMs : motionTokens.settle.pageMs;
    opacity.value = reduceMotion ? 0 : kind === 'kiko' ? motionTokens.settle.kikoInitialOpacity : motionTokens.settle.pageInitialOpacity;
    translateY.value = reduceMotion ? 0 : kind === 'kiko' ? motionTokens.settle.kikoTranslateY : motionTokens.settle.pageTranslateY;
    scale.value = reduceMotion ? 1 : kind === 'kiko' ? motionTokens.settle.kikoInitialScale : 1;
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
  }, [kind, opacity, reduceMotion, scale, settledKey, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
}
