import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, fontFamilies } from './OkyoUI';
import { recipeShadows } from '../theme/recipeTheme';

export function RecipePrimaryActions({ onCook, onCustomize, onGroceries }: {
  onCook: () => void;
  onCustomize: () => void;
  onGroceries: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Action label="Cook" primary onPress={onCook} />
        <Action label="Customize" tone="customize" onPress={onCustomize} />
        <Action label="Groceries" tone="groceries" onPress={onGroceries} />
      </View>
    </View>
  );
}

function Action({ label, onPress, primary = false, tone }: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  tone?: 'customize' | 'groceries';
}) {
  const actionStyle = primary
    ? styles.primary
    : tone === 'customize'
      ? styles.customize
      : tone === 'groceries'
        ? styles.groceries
        : styles.groceries;
  const labelStyle = primary
    ? styles.primaryLabel
    : tone === 'customize'
      ? styles.customizeLabel
      : tone === 'groceries'
        ? styles.groceriesLabel
        : styles.groceriesLabel;

  return (
    <Pressable
      accessibilityLabel={primary ? 'Cook this recipe' : label === 'Groceries' ? 'Add ingredients to groceries' : `${label} this recipe`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => {
        void Haptics.impactAsync(primary ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.action, actionStyle, pressed ? styles.pressed : null]}
    >
      <Text numberOfLines={1} style={[styles.label, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 14 },
  row: { flexDirection: 'row', gap: 8 },
  action: { alignItems: 'center', borderRadius: 17, flex: 1, justifyContent: 'center', minHeight: 54, minWidth: 0, paddingHorizontal: 5 },
  primary: { backgroundColor: colors.coral, ...recipeShadows.card },
  customize: { backgroundColor: colors.coralSoft, ...recipeShadows.card },
  groceries: { backgroundColor: '#FFF9EA', ...recipeShadows.card },
  label: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 14, fontWeight: '800' },
  primaryLabel: { color: '#fff' },
  customizeLabel: { color: colors.coralDark },
  groceriesLabel: { color: '#806128' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
