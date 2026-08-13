import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, typography } from '../../theme/okyoTheme';

export function Chip({ label, onPress, selected = false }: { label: string; onPress?: () => void; selected?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={{ selected }} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.chip, selected ? styles.selected : null, pressed ? styles.pressed : null]}>
      <Text maxFontSizeMultiplier={1.5} style={[styles.label, selected ? styles.selectedLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.chip, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  label: { ...typography.bodySmall, color: colors.ink },
  pressed: { opacity: 0.8 },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  selectedLabel: { color: colors.surface },
});
