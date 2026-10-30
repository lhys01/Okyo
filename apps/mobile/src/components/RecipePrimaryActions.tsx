import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, fontFamilies } from './OkyoUI';
import { recipeShadows } from '../theme/recipeTheme';
import { actionIcons } from '../assets/actionIcons';

export function RecipePrimaryActions({ onCook, onCustomize, onGroceries, showGroceries = true, showIcons = true }: {
  onCook: () => void;
  onCustomize: () => void;
  onGroceries?: () => void;
  showGroceries?: boolean;
  showIcons?: boolean;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Action label="Cook" primary onPress={onCook} />
        <Action icon={showIcons ? actionIcons.customize : undefined} label="Customize" tone="customize" onPress={onCustomize} />
        {showGroceries && onGroceries ? <Action icon={showIcons ? actionIcons.grocery : undefined} label="Groceries" tone="groceries" onPress={onGroceries} /> : null}
      </View>
    </View>
  );
}

function Action({ label, onPress, primary = false, tone, icon }: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  tone?: 'customize' | 'groceries';
  icon?: number;
}) {
  const actionStyle = primary ? styles.primary : tone === 'groceries' ? styles.groceries : styles.customize;
  const labelStyle = primary
    ? styles.primaryLabel
    : tone === 'groceries' ? styles.groceriesLabel : styles.customizeLabel;

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
      {icon ? <Image accessibilityIgnoresInvertColors resizeMode="contain" source={icon} style={styles.icon} /> : null}
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 14 },
  row: { flexDirection: 'row', gap: 8 },
  action: { alignItems: 'center', borderRadius: 17, flex: 1, flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 54, minWidth: 0, paddingHorizontal: 5, paddingVertical: 12 },
  icon: { height: 19, width: 19 },
  primary: { backgroundColor: colors.coral, ...recipeShadows.card },
  customize: { backgroundColor: colors.coralSoft, ...recipeShadows.card },
  groceries: { backgroundColor: '#FFF9EA', ...recipeShadows.card },
  label: { color: colors.charcoal, flexShrink: 1, fontFamily: fontFamilies.extraBold, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  primaryLabel: { color: '#fff' },
  customizeLabel: { color: colors.coralDark },
  groceriesLabel: { color: '#806128' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
