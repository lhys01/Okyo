import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../theme/okyoTheme';

export function SectionHeader({ actionLabel, onAction, title }: { actionLabel?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.row}>
      <Text maxFontSizeMultiplier={1.5} style={styles.title}>{title}</Text>
      {actionLabel && onAction ? <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}><Text style={styles.action}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { ...typography.bodySmall, color: colors.ink, fontFamily: typography.section.fontFamily },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...typography.section },
});
