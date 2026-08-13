import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KikoMascot } from '../KikoMascot';
import { colors, spacing, typography } from '../../theme/okyoTheme';
import { PrimaryButton } from './PrimaryButton';

export function StateScreen({ actionLabel, body, children, onAction, title, tone }: { actionLabel?: string; body: string; children?: ReactNode; onAction?: () => void; title: string; tone: 'empty' | 'loading' | 'error' }) {
  const pose = tone === 'error' ? 'thinking' : 'default';
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={styles.screen}>
      <KikoMascot pose={pose} size={tone === 'loading' ? 100 : 120} />
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>{title}</Text>
      <Text maxFontSizeMultiplier={1.5} style={styles.body}>{body}</Text>
      {children}
      {actionLabel && onAction ? <View style={styles.action}><PrimaryButton onPress={onAction}>{actionLabel}</PrimaryButton></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: spacing.lg, maxWidth: 320, width: '100%' },
  body: { ...typography.bodySmall, color: colors.body, marginTop: spacing.sm, textAlign: 'center' },
  screen: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.title, fontSize: 26, marginTop: spacing.md, textAlign: 'center' },
});
