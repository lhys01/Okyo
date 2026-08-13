import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, typography } from '../../theme/okyoTheme';

export function SecondaryButton({ children, disabled, onPress }: { children: ReactNode; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null]}>
      <Text maxFontSizeMultiplier={1.5} style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.button, borderWidth: 1, justifyContent: 'center', minHeight: 52, maxWidth: 400, paddingHorizontal: 22, width: '100%' },
  disabled: { opacity: 0.45 },
  label: { ...typography.button, color: colors.ink, textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
