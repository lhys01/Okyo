import { NavArrowRight, Spark } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import appConfig from '../../app.json';
import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { SecondaryButton } from '../components/OkyoUI';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, spacing, typography } from '../theme/okyoTheme';
import { legalUrls } from '../config/legalConfig';
import { cancelOkyoDailyReminder, scheduleOkyoDailyReminder } from '../utils/notifications';
import { useReducedMotion } from '../utils/useReducedMotion';

export function SettingsScreen() {
  const resetOnboarding = useOkyoStore((state) => state.resetOnboarding);
  const clearSavedData = useOkyoStore((state) => state.clearSavedData);
  const notificationChoice = useOkyoStore((state) => state.notificationChoice);
  const setNotificationChoice = useOkyoStore((state) => state.setNotificationChoice);
  const reduceMotion = useReducedMotion();
  const [isUpdatingReminder, setIsUpdatingReminder] = useState(false);
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
      'Clear saved recipes and challenges?',
      'This removes all locally saved recipes, challenge progress, and XP from this device.',
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

  const updateDailyReminder = async (enabled: boolean) => {
    if (isUpdatingReminder) {
      return;
    }

    setIsUpdatingReminder(true);
    try {
      if (enabled) {
        const scheduled = await scheduleOkyoDailyReminder();
        if (!scheduled) {
          Alert.alert(
            'Notifications are off',
            'Allow notifications in your device settings to get Okyo cooking reminders.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        setNotificationChoice('remind_me');
      } else {
        await cancelOkyoDailyReminder();
        setNotificationChoice('not_now');
      }
    } finally {
      setIsUpdatingReminder(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Make Okyo work the way your kitchen does.</Text>

        <View style={styles.identityRow}>
          <View style={styles.heroMascotWrap}>
            <Spark color={colors.coral} height={28} strokeWidth={2.2} width={28} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Okyo</Text>
            <Text style={styles.description}>Your AI cooking companion · Version {appVersion}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Daily cooking reminder</Text>
              <Text style={styles.rowBody}>A gentle nudge at 6:00 PM.</Text>
            </View>
            <Switch
              accessibilityLabel="Daily cooking reminder"
              disabled={isUpdatingReminder}
              ios_backgroundColor={colors.creamDeep}
              onValueChange={updateDailyReminder}
              thumbColor={colors.card}
              trackColor={{ false: colors.creamDeep, true: colors.green }}
              value={notificationChoice === 'remind_me'}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Reduce Motion</Text>
              <Text style={styles.rowBody}>Follows your device setting · {reduceMotion ? 'On' : 'Off'}</Text>
            </View>
            <Text style={styles.systemBadge}>System</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy and help</Text>
          <View style={styles.privacyNote}>
            <Text style={styles.privacyTitle}>Your food photos stay temporary</Text>
            <Text style={styles.privacySummary}>
              Photos are sent through OpenRouter for analysis and are not retained by Okyo unless you save a recipe. AI results are estimates you can retry or edit.
            </Text>
          </View>
          <SettingsLink label="Privacy Policy" onPress={() => openLegalDestination('Privacy Policy', legalUrls.privacy)} />
          <SettingsLink label="Support" onPress={() => openLegalDestination('Support', legalUrls.support)} />
          <SettingsLink label="Terms" onPress={() => openLegalDestination('Terms', legalUrls.terms)} />
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
    </SafeAreaView>
  );
}

function SettingsLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={styles.linkRow} onPress={onPress}>
      <Text style={styles.linkText}>{label}</Text>
      <NavArrowRight color={colors.muted} height={19} strokeWidth={2} width={19} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    padding: spacing.screen,
    paddingBottom: 220,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  identityRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingBottom: 14,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    ...typography.heading,
    fontSize: 19,
  },
  description: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  heroMascotWrap: {
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  section: {
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
    marginTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  privacySummary: {
    ...typography.caption,
    color: colors.body,
    lineHeight: 19,
    marginBottom: 12,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
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
  systemBadge: {
    backgroundColor: colors.infoSoft,
    borderRadius: 8,
    color: colors.info,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  privacyNote: {
    backgroundColor: colors.greenSoft,
    borderRadius: 8,
    marginBottom: 4,
    padding: 14,
  },
  privacyTitle: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 5,
  },
  linkRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  linkText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: 8,
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
