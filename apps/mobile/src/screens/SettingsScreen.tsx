import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import appConfig from '../../app.json';
import { KikoMascot } from '../components/KikoMascot';
import { legalUrls } from '../config/legalConfig';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, layout, radius, spacing, surfaces, typography } from '../theme/okyoTheme';

export function SettingsScreen() {
  const clearSavedData = useOkyoStore((state) => state.clearSavedData);

  const openUrl = async (label: string, url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(`${label} unavailable`, `Okyo could not open ${label.toLowerCase()}.`);
    }
  };

  const confirmClearData = () => {
    Alert.alert(
      'Delete local Okyo data?',
      'This removes saved recipes, grocery selections, scan history, and saved photo copies from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: clearSavedData },
      ],
    );
  };

  const legalLinks = [
    ['Privacy Policy', legalUrls.privacy],
    ['Terms', legalUrls.terms],
    ['Support', legalUrls.support],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>SETTINGS</Text>
            <Text style={styles.title}>Okyo</Text>
            <Text style={styles.body}>Version {appConfig.expo.version}</Text>
          </View>
          <KikoMascot animated="idle" pose="default" size={76} />
        </View>

        <SettingsSection title="Permissions and accessibility">
          <Text style={styles.summary}>Camera and photo access are requested only when you choose those scan options.</Text>
          <SettingsRow label="Open device settings" onPress={() => void Linking.openSettings()} />
          <Text style={styles.summary}>Okyo follows your device’s Reduce Motion and text-size preferences.</Text>
        </SettingsSection>

        <SettingsSection title="Privacy">
          <Text style={styles.summary}>
            Food photos are sent through Okyo’s backend to configured AI providers. Raw uploads are not retained by the backend. Saved recipes and photo copies remain on this device until removed.
          </Text>
          {legalLinks.map(([label, url]) => (
            <SettingsRow key={label} label={label} onPress={() => void openUrl(label, url)} />
          ))}
          {legalLinks.length === 0 ? (
            <Text style={styles.blocker}>Legal and support destinations are not configured in this development build.</Text>
          ) : null}
        </SettingsSection>

        <SettingsSection title="Your data">
          <Text style={styles.summary}>Delete the recipes, scans, grocery choices, and photo copies stored locally on this device.</Text>
          <Pressable accessibilityRole="button" style={styles.dangerButton} onPress={confirmClearData}>
            <Text style={styles.dangerText}>Delete local data</Text>
          </Pressable>
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingsRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]} onPress={onPress}>
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.screen, paddingBottom: layout.scrollClearance },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  kicker: { ...typography.label, color: colors.coralDark },
  title: { ...typography.display, fontSize: 32, lineHeight: 38, marginTop: 6 },
  body: { ...typography.body, marginTop: 5 },
  section: { ...surfaces.card, marginTop: 18, padding: 18 },
  sectionTitle: { color: colors.charcoal, fontSize: 19, fontWeight: '800', marginBottom: 10 },
  summary: { ...typography.body, marginBottom: 8 },
  row: { borderTopColor: colors.border, borderTopWidth: 1, justifyContent: 'center', minHeight: 50 },
  rowText: { color: colors.coralDark, fontSize: 16, fontWeight: '800' },
  blocker: { ...typography.caption, backgroundColor: colors.cream, borderRadius: radius.card, marginTop: 6, padding: 12 },
  dangerButton: { alignItems: 'center', borderColor: colors.danger, borderRadius: radius.button, borderWidth: 1, justifyContent: 'center', marginTop: 8, minHeight: 50 },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
