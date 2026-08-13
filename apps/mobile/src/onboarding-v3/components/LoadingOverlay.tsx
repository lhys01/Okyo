import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';

export function LoadingOverlay({ visible, label = 'Building your recipe…' }: { visible: boolean; label?: string }) {
  const reduceMotion = useReduceMotion();
  const backdropOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.value = withTiming(visible ? 1 : 0, {
      duration: motionTokens.loading.backdropMs,
      easing: Easing.linear,
    });
    if (visible) {
      rotation.value = 0;
      rotation.value = withRepeat(withTiming(1, {
        duration: motionTokens.loading.spinnerMs,
        easing: Easing.linear,
      }), -1, false);
    }
  }, [backdropOpacity, reduceMotion, rotation, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  if (!visible) return null;
  return (
    <Animated.View accessibilityLabel={label} accessibilityRole="progressbar" style={[styles.backdrop, backdropStyle]}>
      <View style={styles.card}>
        <Animated.View style={[styles.spinner, spinnerStyle]} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 64,
    justifyContent: 'center',
    shadowColor: '#5A3924',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    width: 64,
  },
  spinner: {
    borderColor: '#EEE4D6',
    borderRadius: 13,
    borderRightColor: '#FF8BAE',
    borderTopColor: '#FF8BAE',
    borderWidth: 3,
    height: 26,
    width: 26,
  },
  label: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    marginTop: 14,
  },
});
