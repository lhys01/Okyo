import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import appConfig from '../../app.json';
import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { SecondaryButton, colors, sharedStyles } from '../components/OkyoUI';
import { useOkyoStore } from '../state/useOkyoStore';

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

  const showUnavailable = (label: string) => {
    Alert.alert(label, 'This setting is not enabled in this preview build.');
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
      'Clear saved recipes and challenges?',
      'This clears local saved dupes, challenge results, XP, and badges for testing.',
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
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.rowBody}>Okyo is not requesting push notifications in this build.</Text>
          </View>
          <Switch value={false} onValueChange={() => showUnavailable('Notifications')} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Dark theme</Text>
            <Text style={styles.rowBody}>The editorial light theme is active for this preview.</Text>
          </View>
          <Switch value={false} onValueChange={() => showUnavailable('Theme')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help and legal</Text>
        <Pressable style={styles.linkRow} onPress={() => showUnavailable('Privacy Policy')}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => showUnavailable('Support')}>
          <Text style={styles.linkText}>Support</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => showUnavailable('Terms')}>
          <Text style={styles.linkText}>Terms</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Development</Text>
        <SecondaryButton onPress={confirmResetOnboarding}>Reset Onboarding</SecondaryButton>
        <Pressable style={styles.dangerButton} onPress={confirmClearData}>
          <Text style={styles.dangerButtonText}>Delete Saved Data</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: 24,
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
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
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
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 74,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  rowBody: {
    color: colors.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
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
    borderColor: '#c98a80',
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 18,
  },
  dangerButtonText: {
    color: '#8c2f21',
    fontSize: 15,
    fontWeight: '800',
  },
});
