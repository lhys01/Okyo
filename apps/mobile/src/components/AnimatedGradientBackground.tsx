import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { gradientBlobAssets } from '../../assets/background-art/gradient-blobs';

type MotionRange = readonly [number, number];

export type GradientBlobConfig = {
  durationMs: number;
  id: string;
  initialProgress: number;
  opacity: MotionRange;
  placement: Pick<ImageStyle, 'bottom' | 'left' | 'right' | 'top'>;
  rotation: MotionRange;
  scale: MotionRange;
  size: number;
  source: ImageSourcePropType;
  staticProgress: number;
  translateX: MotionRange;
  translateY: MotionRange;
};

type AnimatedGradientBackgroundProps = {
  blobs?: readonly GradientBlobConfig[];
};

const defaultBlobs: readonly GradientBlobConfig[] = [
  {
    durationMs: 24_000,
    id: 'pink-peach',
    initialProgress: 0.18,
    opacity: [0.36, 0.46],
    placement: { right: -70, top: -28 },
    rotation: [-5, 7],
    scale: [0.98, 1.05],
    size: 176,
    source: gradientBlobAssets.pinkPeach,
    staticProgress: 0.42,
    translateX: [-8, 18],
    translateY: [-10, 22],
  },
  {
    durationMs: 29_000,
    id: 'yellow-mint',
    initialProgress: 0.66,
    opacity: [0.31, 0.4],
    placement: { left: -52, top: 218 },
    rotation: [8, -6],
    scale: [0.97, 1.04],
    size: 156,
    source: gradientBlobAssets.yellowMint,
    staticProgress: 0.34,
    translateX: [18, -7],
    translateY: [16, -13],
  },
  {
    durationMs: 21_000,
    id: 'blue-lavender',
    initialProgress: 0.38,
    opacity: [0.3, 0.39],
    placement: { bottom: 228, right: -68 },
    rotation: [-7, 6],
    scale: [1, 1.06],
    size: 190,
    source: gradientBlobAssets.blueLavender,
    staticProgress: 0.58,
    translateX: [14, -18],
    translateY: [-12, 17],
  },
  {
    durationMs: 27_000,
    id: 'peach-lavender',
    initialProgress: 0.82,
    opacity: [0.28, 0.37],
    placement: { bottom: 34, left: -46 },
    rotation: [6, -8],
    scale: [0.98, 1.05],
    size: 150,
    source: gradientBlobAssets.peachLavender,
    staticProgress: 0.46,
    translateX: [-7, 17],
    translateY: [12, -14],
  },
] as const;

export function AnimatedGradientBackground({
  blobs = defaultBlobs,
}: AnimatedGradientBackgroundProps) {
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotionPreference();

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={styles.background}
      testID="animated-gradient-background"
    >
      {blobs.slice(0, 5).map((blob) => (
        <GradientBlob
          key={blob.id}
          config={blob}
          shouldAnimate={isFocused && reduceMotion === false}
          shouldShowStatic={reduceMotion !== false}
        />
      ))}
    </View>
  );
}

function GradientBlob({
  config,
  shouldAnimate,
  shouldShowStatic,
}: {
  config: GradientBlobConfig;
  shouldAnimate: boolean;
  shouldShowStatic: boolean;
}) {
  const progress = useSharedValue(config.initialProgress);

  useEffect(() => {
    cancelAnimation(progress);

    if (shouldShowStatic) {
      progress.value = config.staticProgress;
      return;
    }

    if (!shouldAnimate) {
      return;
    }

    const currentProgress = progress.value;
    const nextEdge = currentProgress < 0.5 ? 1 : 0;
    const firstLegDuration = Math.max(
      250,
      Math.round(config.durationMs * Math.abs(nextEdge - currentProgress)),
    );
    const oppositeEdge = nextEdge === 1 ? 0 : 1;
    const timing = {
      duration: config.durationMs,
      easing: Easing.inOut(Easing.quad),
    };

    progress.value = withSequence(
      withTiming(nextEdge, {
        ...timing,
        duration: firstLegDuration,
      }),
      withRepeat(withTiming(oppositeEdge, timing), -1, true),
    );

    return () => cancelAnimation(progress);
  }, [
    config.durationMs,
    config.staticProgress,
    progress,
    shouldAnimate,
    shouldShowStatic,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], config.opacity),
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], config.translateX),
      },
      {
        translateY: interpolate(progress.value, [0, 1], config.translateY),
      },
      {
        scale: interpolate(progress.value, [0, 1], config.scale),
      },
      {
        rotate: `${interpolate(progress.value, [0, 1], config.rotation)}deg`,
      },
    ],
  }));

  return (
    <Animated.Image
      accessible={false}
      fadeDuration={0}
      resizeMode="contain"
      source={config.source}
      style={[
        styles.blob,
        config.placement,
        { height: config.size, width: config.size },
        animatedStyle,
      ]}
      testID={`animated-gradient-blob-${config.id}`}
    />
  );
}

function useReduceMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        if (mounted) {
          setReduceMotion(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
});
