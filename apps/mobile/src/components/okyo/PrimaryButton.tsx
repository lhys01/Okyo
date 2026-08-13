import { NavArrowRight } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from '../../theme/okyoTheme';

type PrimaryButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
  testID?: string;
};

export function PrimaryButton({ children, disabled, onPress, showChevron = false, testID }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      <Text maxFontSizeMultiplier={1.5} style={styles.label}>{children}</Text>
      {showChevron ? <View style={styles.chevron}><NavArrowRight color={colors.surface} height={20} width={20} /></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.ink, borderRadius: radius.button, flexDirection: 'row', justifyContent: 'center', minHeight: 60, maxWidth: 400, paddingHorizontal: 24, width: '100%' },
  chevron: { marginLeft: 8 },
  disabled: { opacity: 0.45 },
  label: { ...typography.button, color: colors.surface, textAlign: 'center' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});
