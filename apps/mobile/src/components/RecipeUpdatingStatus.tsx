import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies } from './OkyoUI';
import { useReduceMotion } from '../hooks/useAccessibilityPreferences';

type RecipeUpdatingStatusProps = {
  message: string;
  cancelLabel?: string;
  onCancel: () => void;
};

export function RecipeUpdatingStatus({ message, cancelLabel = 'Cancel', onCancel }: RecipeUpdatingStatusProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }

    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { duration: 360, toValue: 0.28, useNativeDriver: true }),
      Animated.timing(opacity, { duration: 360, toValue: 1, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return (
    <View style={styles.row}>
      <Text accessibilityLiveRegion="polite" accessibilityLabel={message} style={styles.message}>
        {message}{' '}
        <Animated.Text style={[styles.message, { opacity }]}>...</Animated.Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.cancelText}>{cancelLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 40,
    paddingVertical: 4,
  },
  message: {
    color: colors.coralDark,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.coralDark,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: { opacity: 0.72 },
});
