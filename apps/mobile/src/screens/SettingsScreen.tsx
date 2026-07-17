import { useEffect, useRef } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import appConfig from '../../app.json';
import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { SecondaryButton, sharedStyles } from '../components/OkyoUI';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, radius, spacing, typography } from '../theme/okyoTheme';
import { legalUrls } from '../config/legalConfig';

export function SettingsScreen() {
  const resetOnboarding = useOkyoStore((state) => state.resetOnboarding);
  const clearSavedData = useOkyoStore((state) => state.clearSavedData);
  const appVersion = appConfig.expo.version;
  const didTrackView = useRef(false);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    uiLog('SettingsScreen', 'enter');

    didTrackView.current = true;
    track(analyticsEvents.SETTINGS_VIEWED, { screen: 'SettingsScreen' });
  }, []);

  const openLegalDestination = async (label: string, url: string | undefined) => {
    if (!url) {
      Alert.alert(label, `${label} is not configured for this development build.`);
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(label, `Okyo could not open the ${label.toLowerCase()} destination.`);
    }
  };

  const confirmResetOnboarding = () => {
    Alert.alert('Reset onboarding?', 'You will see the Okyo onboarding flow again. Your saved recipes are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          uiLog('SettingsScreen', 'reset_onboarding');
          resetOnboarding();
          track(analyticsEvents.ONBOARDING_RESET, { screen: 'SettingsScreen' });
        },
      },
    ]);
  };

  const confirmClearData = () => {
    Alert.alert(
      'Clear saved Okyo data?',
      'This removes locally saved recipes, food ideas, scan results, photo copies, and XP from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            uiLog('SettingsScreen', 'clear_saved_data');
            clearSavedData();
            track(analyticsEvents.LOCAL_DATA_CLEARED, { screen: 'SettingsScreen' });
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Okyo</Text>
      <Text style={styles.description}>Version {appVersion}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help and legal</Text>
        <Text style={styles.privacySummary}>
          Food photos are sent to OpenRouter and downstream AI providers for analysis. The backend processes the upload without retaining the raw image, while user-scoped scan metadata and generated recipes are stored in Okyo's backend with expiry. Saving a recipe also keeps a local recipe and photo copy on this device until you remove it or clear local data. During the cohort, backend operational logs may include dish labels, status, timing, model and token usage, but not raw photo contents. Mobile analytics and crash reporting are not enabled in this build.
        </Text>
        <Pressable style={styles.linkRow} onPress={() => openLegalDestination('Privacy Policy', legalUrls.privacy)}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => openLegalDestination('Support', legalUrls.support)}>
          <Text style={styles.linkText}>Support</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => openLegalDestination('Terms', legalUrls.terms)}>
          <Text style={styles.linkText}>Terms</Text>
        </Pressable>
      </View>

      {__DEV__ ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Development</Text>
          <SecondaryButton onPress={confirmResetOnboarding}>Reset Onboarding</SecondaryButton>
          <Pressable style={styles.dangerButton} onPress={confirmClearData}>
            <Text style={styles.dangerButtonText}>Delete Saved Data</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.screen,
    paddingBottom: 220,
  },
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 39,
  },
  description: {
    ...typography.body,
    marginTop: 8,
  },
  section: {
    ...sharedStyles.card,
    marginTop: 18,
    padding: 18,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  privacySummary: {
    ...typography.caption,
    color: colors.body,
    lineHeight: 19,
    marginBottom: 12,
  },
  linkRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radius.chip,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 18,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
});
