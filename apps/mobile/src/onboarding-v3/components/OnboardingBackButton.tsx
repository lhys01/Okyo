import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';

export function OnboardingBackButton({
  onPress,
  hidden = false,
  style,
}: {
  onPress: () => void;
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (hidden) return <></>;
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Text allowFontScaling={false} style={styles.icon}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressed: { opacity: 0.68 },
  icon: { color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 42, lineHeight: 44, marginLeft: -2, marginTop: -4 },
});
