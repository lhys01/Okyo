import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ambientColors, colors, fontFamilies } from '../theme/okyoTheme';
import { useReducedMotion } from '../utils/useReducedMotion';

// Okyo brand motifs — small system pieces from the reference sheets:
//   GlowNode     soft-glow label chip (analysis stages, onboarding explanations)
//   DottedPath   thin wandering dotted line connecting guidance moments
//   SparkleBurst brief sparkle accents for discovery/celebration
// Rules: one dotted path per screen max, glow nodes only where stages/relations
// genuinely exist, sparkles only for discovery or celebration.

export type GlowTone = keyof typeof ambientColors;

const glowNodeText: Record<'pending' | 'active' | 'done', string> = {
  pending: colors.muted,
  active: colors.charcoal,
  done: colors.charcoal,
};

type GlowNodeProps = {
  label: string;
  tone?: GlowTone;
  state?: 'pending' | 'active' | 'done';
  style?: StyleProp<ViewStyle>;
};

export function GlowNode({ label, tone = 'peach', state = 'pending', style }: GlowNodeProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const glowColor = ambientColors[tone];
  const isActive = state === 'active';

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;

    if (!isActive || reduceMotion) {
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );

    return () => cancelAnimation(pulse);
  }, [isActive, pulse, reduceMotion]);

  const animatedGlow = useAnimatedStyle(() => ({
    shadowOpacity: isActive ? interpolate(pulse.value, [0, 1], [0.55, 0.9]) : state === 'done' ? 0.45 : 0.25,
    transform: [{ scale: isActive ? interpolate(pulse.value, [0, 1], [1, 1.04]) : 1 }],
  }));

  return (
    <Animated.View
      style={[
        styles.glowNode,
        {
          backgroundColor: state === 'pending' ? colors.cream : glowColor,
          shadowColor: glowColor,
        },
        animatedGlow,
        style,
      ]}
    >
      <Text style={[styles.glowNodeLabel, { color: glowNodeText[state] }]}>{label}</Text>
    </Animated.View>
  );
}

type DottedPathProps = {
  // Normalized path in a 100×100 viewBox, e.g. 'M 8 80 C 30 10, 70 90, 94 22'.
  d?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
};

export function DottedPath({
  d = 'M 4 78 C 28 8, 52 96, 96 24',
  height = 90,
  style,
  opacity = 0.5,
}: DottedPathProps) {
  return (
    <View pointerEvents="none" style={[{ height, opacity }, style]}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
        <Path
          d={d}
          fill="none"
          stroke={colors.borderStrong}
          strokeDasharray="0.8 3.2"
          strokeLinecap="round"
          strokeWidth={1.1}
        />
      </Svg>
    </View>
  );
}

type SparkleBurstProps = {
  size?: number;
  tones?: GlowTone[];
  // Sparkles play once when this flips true.
  visible: boolean;
  style?: StyleProp<ViewStyle>;
};

const sparkleLayout = [
  { angle: -70, distance: 0.92, delay: 0, scale: 1 },
  { angle: -20, distance: 1, delay: 90, scale: 0.7 },
  { angle: 35, distance: 0.85, delay: 40, scale: 0.85 },
  { angle: 115, distance: 0.95, delay: 140, scale: 0.65 },
  { angle: 165, distance: 0.8, delay: 70, scale: 0.9 },
  { angle: 230, distance: 1, delay: 120, scale: 0.7 },
  { angle: 285, distance: 0.88, delay: 30, scale: 0.8 },
] as const;

export function SparkleBurst({ size = 160, tones = ['pink', 'yellow', 'mint', 'blue', 'lavender'], visible, style }: SparkleBurstProps) {
  const reduceMotion = useReducedMotion();

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.sparkleWrap, { height: size, width: size }, style]}>
      {sparkleLayout.map((sparkle, index) => (
        <Sparkle
          key={index}
          animate={!reduceMotion}
          color={ambientColors[tones[index % tones.length]]}
          config={sparkle}
          radius={size / 2}
        />
      ))}
    </View>
  );
}

function Sparkle({
  animate,
  color,
  config,
  radius,
}: {
  animate: boolean;
  color: string;
  config: (typeof sparkleLayout)[number];
  radius: number;
}) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    progress.value = withDelay(
      config.delay,
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withTiming(1.6, { duration: 700, easing: Easing.in(Easing.quad) }),
      ),
    );

    return () => cancelAnimation(progress);
  }, [animate, config.delay, progress]);

  const angleRad = (config.angle * Math.PI) / 180;
  const targetX = Math.cos(angleRad) * radius * config.distance;
  const targetY = Math.sin(angleRad) * radius * config.distance;

  const animatedStyle = useAnimatedStyle(() => {
    const travel = Math.min(progress.value, 1);
    const fade = progress.value <= 1 ? progress.value : Math.max(0, 1.6 - progress.value) / 0.6;

    return {
      opacity: fade,
      transform: [
        { translateX: travel * targetX },
        { translateY: travel * targetY },
        { scale: config.scale * (0.4 + 0.6 * travel) },
        { rotate: `${travel * 90}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.sparkle, animatedStyle]}>
      <Svg height={16} viewBox="0 0 24 24" width={16}>
        <Path
          d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glowNode: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 3,
  },
  glowNodeLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  sparkleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  sparkle: {
    position: 'absolute',
  },
});
