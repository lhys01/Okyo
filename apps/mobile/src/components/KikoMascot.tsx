import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { mascotAssets } from '../../assets/mascot';

export type KikoMascotPose = keyof typeof mascotAssets;
export type KikoMascotMotion = 'idle' | 'thinking' | 'celebrate' | 'success';

type KikoMascotProps = {
  pose?: KikoMascotPose | string;
  size?: number;
  animated?: boolean | KikoMascotMotion;
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
  animated = false,
  style,
}: KikoMascotProps) {
  const safePose = getSafePose(pose);
  const imageSource = mascotAssets[safePose] ?? mascotAssets.default;
  const motion = getMotionState(animated, safePose);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const baseStyle = [{ height: size, width: size }, style];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);

    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);

    if (!motion || reduceMotion) {
      return;
    }

    if (motion === 'celebrate' || motion === 'success') {
      Animated.sequence([
        Animated.timing(progress, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          duration: 260,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: motion === 'thinking' ? 720 : 1350,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          duration: motion === 'thinking' ? 720 : 1350,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [motion, progress, reduceMotion]);

  if (!motion || reduceMotion) {
    return <Image resizeMode="contain" source={imageSource} style={baseStyle} />;
  }

  return (
    <Animated.View style={getMotionStyle(motion, progress)}>
      <Image resizeMode="contain" source={imageSource} style={baseStyle} />
    </Animated.View>
  );
}

function getMotionState(animated: boolean | KikoMascotMotion, pose: KikoMascotPose): KikoMascotMotion | null {
  if (!animated) {
    return null;
  }
  if (typeof animated === 'string') {
    return animated;
  }
  if (pose === 'scanning') {
    return 'thinking';
  }
  if (pose === 'celebrating' || pose === 'success') {
    return 'celebrate';
  }
  if (pose === 'happy') {
    return 'success';
  }
  return 'idle';
}

function getMotionStyle(motion: KikoMascotMotion, progress: Animated.Value): Animated.WithAnimatedObject<ViewStyle> {
  if (motion === 'thinking') {
    return {
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -4],
          }),
        },
        {
          rotate: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['-1.5deg', '1.5deg'],
          }),
        },
      ],
    };
  }

  if (motion === 'celebrate') {
    return {
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -8],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.035],
          }),
        },
      ],
    };
  }

  if (motion === 'success') {
    return {
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 3, 0],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.025],
          }),
        },
      ],
    };
  }

  return {
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.015],
        }),
      },
    ],
  };
}
