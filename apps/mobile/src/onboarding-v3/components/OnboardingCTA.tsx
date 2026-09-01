import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors, homeRecipeCardShadow, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'questionnaire';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone?: 'default' | 'pastelPink';
};

const CTA_SHADOW_RESTING = homeRecipeCardShadow.shadowOpacity;
const CTA_SHADOW_PRESSED = CTA_SHADOW_RESTING * 0.6;
const FORWARD_GUARD_MS = 320;

export function OnboardingCTA({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  variant = 'primary',
  style,
  testID,
  tone = 'default',
}: Props) {
  const reduceMotion = useReduceMotion();
  const lockedRef = useRef(false);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useSharedValue<number>(1);
  const shadowOpacity = useSharedValue<number>(CTA_SHADOW_RESTING);
  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: shadowOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    scale.value = withTiming(reduceMotion ? 1 : motionTokens.cta.pressedScale, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressInMs,
      easing: Easing.out(Easing.quad),
    });
    shadowOpacity.value = withTiming(CTA_SHADOW_PRESSED, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressInMs,
      easing: Easing.out(Easing.quad),
    });
  };
  const pressOut = () => {
    scale.value = withDelay(motionTokens.cta.releaseDelayMs, withTiming(1, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressOutMs,
      easing: Easing.out(Easing.quad),
    }));
    shadowOpacity.value = withDelay(motionTokens.cta.releaseDelayMs, withTiming(CTA_SHADOW_RESTING, {
      duration: reduceMotion ? 0 : motionTokens.cta.pressOutMs,
      easing: Easing.out(Easing.quad),
    }));
  };
  useEffect(() => () => {
    if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
  }, []);

  const handlePress = () => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    onPress();
    guardTimerRef.current = setTimeout(() => {
      lockedRef.current = false;
      guardTimerRef.current = null;
    }, reduceMotion ? 120 : FORWARD_GUARD_MS);
  };

  return (
    <Animated.View style={[styles.shadow, animatedStyle, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.button, tone === 'pastelPink' && styles.pastelPink, variant === 'secondary' && styles.secondary, variant === 'questionnaire' && styles.questionnaire, disabled && styles.disabled, variant === 'questionnaire' && disabled && styles.questionnaireDisabled]}
        testID={testID}
      >
        <Text maxFontSizeMultiplier={1.2} style={[styles.label, tone === 'pastelPink' && styles.pastelPinkLabel, variant === 'secondary' && styles.secondaryLabel, variant === 'questionnaire' && styles.questionnaireLabel]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignSelf: 'center',
    maxWidth: undefined,
    ...homeRecipeCardShadow,
    width: '92%',
  },
  button: {
    alignItems: 'center',
    // Coral is Okyo's primary action colour. Ink-on-coral keeps the label at a
    // high contrast ratio, which white-on-coral would not reach.
    backgroundColor: '#FFA8C2',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: 28,
  },
  pastelPink: { backgroundColor: '#FFA8C2' },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  questionnaire: {
    backgroundColor: '#FFA8C2',
  },
  questionnaireDisabled: {
    backgroundColor: '#FFA8C2',
    opacity: 0.5,
  },
  disabled: { opacity: 0.45 },
  label: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700' },
  secondaryLabel: { color: '#FFFFFF' },
  questionnaireLabel: { color: '#FFFFFF' },
  pastelPinkLabel: { color: '#FFFFFF' },
});
