import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontFamilies } from '../../theme/okyoTheme';

type Props = { label: string; onPress: () => void; selected: boolean };

/** Equal-width pill for the diet groups. Selection shows fill plus a check glyph. */
export function ChoicePill({ label, onPress, selected }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected ? styles.pillSelected : null]}
    >
      {selected ? <Text style={styles.tick}>✓ </Text> : null}
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 16, letterSpacing: -0.32,
    textAlign: 'center',
  },
  labelSelected: { color: '#FFFFFF', fontFamily: fontFamilies.bold },
  pill: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E9E1D5', borderRadius: 16,
    borderWidth: 2, flex: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 62,
    paddingHorizontal: 8, paddingVertical: 10,
  },
  pillSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  tick: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 13 },
});
