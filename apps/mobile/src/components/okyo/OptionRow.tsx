import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, typography } from '../../theme/okyoTheme';

export function OptionRow({ icon, label, onPress, selected = false }: { icon?: ReactNode; label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.row, selected ? styles.selected : null, pressed ? styles.pressed : null]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text maxFontSizeMultiplier={1.5} style={[styles.label, selected ? styles.selectedLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  label: { ...typography.body, color: colors.ink, flex: 1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, ...shadows.card },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  selectedLabel: { color: colors.surface },
});
