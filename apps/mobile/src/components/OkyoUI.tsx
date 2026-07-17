import { CheckCircle } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { colors, fontFamilies, layout, radius, shadows, spacing, surfaces } from '../theme/okyoTheme';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
};

export function ScreenContainer({ children, scroll = true, centered = false }: ScreenContainerProps) {
  const contentStyle = [styles.screenContent, centered ? styles.centeredContent : null];

  if (!scroll) {
    return <View style={contentStyle}>{children}</View>;
  }

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  fullWidth?: boolean;
};

export function PrimaryButton({ children, onPress, fullWidth = true }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryButton,
        fullWidth ? styles.fullWidth : null,
        pressed ? styles.pressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ children, onPress, fullWidth = true }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondaryButton,
        fullWidth ? styles.fullWidth : null,
        pressed ? styles.pressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{children}</Text>
    </Pressable>
  );
}

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  disabled?: boolean;
  pulse?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  children,
  disabled = false,
  pulse = false,
  scaleTo = 0.975,
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    pulseValue.stopAnimation();
    pulseValue.setValue(0);

    if (!pulse || reduceMotion || disabled) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [disabled, pulse, pulseValue, reduceMotion]);

  const pressTo = (value: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }

    Animated.spring(scale, {
      damping: 18,
      mass: 0.55,
      stiffness: 300,
      toValue: value,
      useNativeDriver: true,
    }).start();
  };

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.012],
  });

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        pressTo(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressTo(1);
        onPressOut?.(event);
      }}
      {...props}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [
              { scale },
              ...(pulse && !reduceMotion && !disabled ? [{ scale: pulseScale }] : []),
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

type ProgressFillProps = {
  progress: number;
  height?: number;
  tone?: 'coral' | 'green';
  style?: StyleProp<ViewStyle>;
};

export function ProgressFill({ height = 8, progress, style, tone = 'coral' }: ProgressFillProps) {
  const reduceMotion = useReducedMotion();
  const animatedProgress = useRef(new Animated.Value(clampProgress(progress))).current;
  const fillColor = tone === 'green' ? colors.green : colors.coral;

  useEffect(() => {
    const nextProgress = clampProgress(progress);
    if (reduceMotion) {
      animatedProgress.setValue(nextProgress);
      return;
    }

    Animated.timing(animatedProgress, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      toValue: nextProgress,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progress, reduceMotion]);

  return (
    <View style={[styles.progressTrackShared, { height }, style]}>
      <Animated.View
        style={[
          styles.progressFillShared,
          {
            backgroundColor: fillColor,
            width: animatedProgress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

type StatusToastProps = {
  label: string;
  visible: boolean;
};

export function StatusToast({ label, visible }: StatusToastProps) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }

    Animated.timing(progress, {
      duration: visible ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.statusToast,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      <CheckCircle color={colors.green} height={19} strokeWidth={2.4} width={19} />
      <Text style={styles.statusToastText}>{label}</Text>
    </Animated.View>
  );
}

export const sharedStyles = StyleSheet.create({
  card: {
    ...surfaces.card,
    padding: spacing.card,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);

    return () => subscription?.remove?.();
  }, []);

  return reduceMotion;
}

const styles = StyleSheet.create({
  screenContent: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: spacing.screen,
    // Generous enough to clear the floating tab bar where present, without the
    // large empty gap the old 220 left on pushed screens.
    paddingBottom: layout.scrollClearance,
  },
  centeredContent: {
    justifyContent: 'center',
  },
  progressTrackShared: {
    backgroundColor: colors.creamDeep,
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  progressFillShared: {
    borderRadius: 999,
    height: '100%',
    minWidth: 4,
  },
  statusToast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    bottom: 28,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: '#4a3a28',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    zIndex: 20,
    elevation: 5,
  },
  statusToastText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.button,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 26,
    ...shadows.cta,
  },
  primaryButtonText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: radius.button,
    borderWidth: 1.5,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 26,
    ...shadows.soft,
  },
  secondaryButtonText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
