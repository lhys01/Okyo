import { StyleSheet, Text, View } from 'react-native';

import { PLACEHOLDER_NOTICE } from '../../onboarding/example';
import { fontFamilies } from '../../theme/okyoTheme';

/**
 * Stands in for the unshot C-08 ingredient photograph. Deliberately labelled:
 * replacing this is a production-acceptance requirement, not a nice-to-have.
 */
export function PhotoPlaceholder({ height, label }: { height: number; label?: string }) {
  return (
    <View
      accessibilityLabel={label ?? PLACEHOLDER_NOTICE}
      accessibilityRole="image"
      style={[styles.frame, { height }]}
    >
      <Text style={styles.label}>{label ?? 'Ingredient photo'}</Text>
      <Text style={styles.notice}>Development placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center', backgroundColor: '#EDE4D6', borderColor: '#D6C9B4', borderRadius: 18,
    borderStyle: 'dashed', borderWidth: 2, gap: 4, justifyContent: 'center', paddingHorizontal: 20,
  },
  label: {
    color: '#8A8073', fontFamily: fontFamilies.extraBold, fontSize: 11, letterSpacing: 0.7,
    textAlign: 'center', textTransform: 'uppercase',
  },
  notice: {
    color: '#9A9083', fontFamily: fontFamilies.semibold, fontSize: 10, letterSpacing: 0.4,
    textAlign: 'center', textTransform: 'uppercase',
  },
});
