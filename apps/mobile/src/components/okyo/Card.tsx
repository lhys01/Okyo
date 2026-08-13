import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows } from '../../theme/okyoTheme';

export function Card({ children, quiet = false, style }: { children: ReactNode; quiet?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[quiet ? styles.quiet : styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, ...shadows.card },
  quiet: { backgroundColor: colors.surfaceMuted, borderRadius: radius.panel, padding: 16 },
});
