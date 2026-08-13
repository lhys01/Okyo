import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'questionnaire';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function OnboardingCTA({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  icon,
  variant = 'primary',
  style,
  testID,
}: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue<number>(1);
  const shadowOpacity = useSharedValue<number>(motionTokens.cta.shadowResting);
  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: shadowOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    scale.value = withTiming(reduceMotion ? 1 : motionTokens.cta.pressedScale, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressInMs,
      easing: Easing.out(Easing.quad),
    });
    shadowOpacity.value = withTiming(motionTokens.cta.shadowPressed, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressInMs,
      easing: Easing.out(Easing.quad),
    });
  };
  const pressOut = () => {
    scale.value = withTiming(1, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressOutMs,
      easing: Easing.out(Easing.quad),
    });
    shadowOpacity.value = withTiming(motionTokens.cta.shadowResting, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressOutMs,
      easing: Easing.out(Easing.quad),
    });
  };

  return (
    <Animated.View style={[styles.shadow, animatedStyle, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.button, variant === 'secondary' && styles.secondary, variant === 'questionnaire' && styles.questionnaire, disabled && styles.disabled, variant === 'questionnaire' && disabled && styles.questionnaireDisabled]}
        testID={testID}
      >
        <Text maxFontSizeMultiplier={1.2} style={[styles.label, variant === 'secondary' && styles.secondaryLabel, variant === 'questionnaire' && styles.questionnaireLabel]}>{label}</Text>
        {icon ?? <Text accessibilityElementsHidden allowFontScaling={false} style={[styles.arrow, variant === 'secondary' && styles.secondaryLabel, variant === 'questionnaire' && styles.questionnaireLabel]}>›</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignSelf: 'center',
    maxWidth: 360,
    shadowColor: '#5A3924',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
    width: '86%',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.softCharcoal,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: 28,
  },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  questionnaire: {
    backgroundColor: colors.softCharcoal,
  },
  questionnaireDisabled: {
    backgroundColor: colors.muted,
    opacity: 1,
  },
  disabled: { opacity: 0.45 },
  label: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700' },
  secondaryLabel: { color: colors.charcoal },
  questionnaireLabel: { color: '#FFFFFF' },
  arrow: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 30, lineHeight: 30, marginLeft: 12, marginTop: -2 },
});
