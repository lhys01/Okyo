import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { NavArrowLeft } from 'iconoir-react-native';

import { colors, homeRecipeCardShadow } from '../../theme/okyoTheme';
import { useReduceMotion } from '../motion/useReduceMotion';

const BACK_GUARD_MS = 340;

export function OnboardingBackButton({
  onPress,
  hidden = false,
  style,
}: {
  onPress: () => void;
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const lockedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
  }, []);

  if (hidden) return <></>;
  const handlePress = () => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    onPress();
    unlockTimerRef.current = setTimeout(() => {
      lockedRef.current = false;
      unlockTimerRef.current = null;
    }, reduceMotion ? 120 : BACK_GUARD_MS);
  };

  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <NavArrowLeft color={colors.charcoal} height={25} strokeWidth={2.35} width={25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    ...homeRecipeCardShadow,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressed: { opacity: 0.68 },
});
