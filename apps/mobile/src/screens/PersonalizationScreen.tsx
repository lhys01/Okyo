import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft } from 'iconoir-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MASCOT_NAME_MAX_LENGTH, sanitizeMascotName } from '../onboarding-v3/state/mascotName';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import type { MainTabParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Navigation = NativeStackNavigationProp<MainTabParamList>;

/**
 * Where a user who skipped optional personalization during onboarding
 * finishes it later — reached from the Home banner or Settings. Today the
 * only remaining step is confirming the fox's name; "Finish setup" here is
 * what marks personalization complete and clears the reminder everywhere.
 */
export function PersonalizationScreen() {
  const navigation = useNavigation<Navigation>();
  const setPersonalizationComplete = useOkyoStore((state) => state.setPersonalizationComplete);
  const [name, setName] = useState('');

  useEffect(() => {
    let mounted = true;
    void onboardingV3Persistence.readChosenMascotName().then((value) => { if (mounted) setName(value ?? ''); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };

  const finish = () => {
    if (name.trim()) {
      const sanitized = sanitizeMascotName(name);
      void onboardingV3Persistence.writeMascotName(sanitized).catch(() => undefined);
    }
    setPersonalizationComplete(true);

    goBack();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={12} onPress={goBack} style={styles.backButton}>
          <NavArrowLeft color={colors.charcoal} height={22} width={22} />
        </Pressable>
        <Text style={styles.title}>Personalization</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Your fox's name</Text>
        <TextInput
          accessibilityLabel="Fox name"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={MASCOT_NAME_MAX_LENGTH}
          onChangeText={setName}
          placeholder="Name your fox"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={name}
        />
        <Text style={styles.hint}>You can rename your fox any time from here.</Text>
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityLabel="Finish setup" accessibilityRole="button" onPress={finish} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
          <Text style={styles.doneLabel}>Finish setup</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: spacing.screen, paddingTop: 8 },
  backButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 20, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: spacing.screen, paddingTop: 24 },
  label: { color: colors.muted, fontFamily: fontFamilies.semibold, fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1,
    color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 18, paddingHorizontal: 16, paddingVertical: 14,
  },
  hint: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13, marginTop: 10 },
  footer: { paddingBottom: 16, paddingHorizontal: spacing.screen, paddingTop: 12 },
  doneButton: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: radius.card, paddingVertical: 16 },
  doneLabel: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
