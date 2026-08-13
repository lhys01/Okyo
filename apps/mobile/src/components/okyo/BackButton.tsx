import { NavArrowLeft } from 'iconoir-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { colors, shadows } from '../../theme/okyoTheme';

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}>
      <NavArrowLeft color={colors.ink} height={22} strokeWidth={2.2} width={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 22, height: 44, justifyContent: 'center', width: 44, ...shadows.card },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
