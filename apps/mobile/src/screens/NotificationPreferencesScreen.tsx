import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft } from 'iconoir-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScreenSkeleton } from '../components/Skeleton';
import type { MainTabParamList } from '../navigation/types';
import { requestPermissionWithNotice } from '../privacy/requestPermissionWithNotice';
import { resyncCookingReminderNow } from '../state/cookingReminder';
import { resyncGroceryReminderNow } from '../state/groceryReminder';
import { DEFAULT_NOTIFICATION_PREFERENCES, readNotificationPreferences, writeNotificationPreferences, type NotificationPreferences } from '../state/notificationPreferences';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';
import { loadNotificationsModule } from '../utils/notifications';

type Navigation = NativeStackNavigationProp<MainTabParamList>;
type PermissionState = 'loading' | 'granted' | 'denied' | 'undetermined';

export function NotificationPreferencesScreen() {
  const navigation = useNavigation<Navigation>();
  const [permission, setPermission] = useState<PermissionState>('loading');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  useEffect(() => { void Promise.all([loadNotificationsModule().then((notifications) => notifications?.getPermissionsAsync() ?? null), readNotificationPreferences()]).then(([status, saved]) => { setPermission(status?.granted ? 'granted' : status?.canAskAgain ? 'undetermined' : 'undetermined'); setPreferences(saved); }).catch(() => { setPermission('undetermined'); setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES }); }); }, []);
  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const requestPermission = async (): Promise<boolean> => {
    if (permission === 'denied') { await Linking.openSettings(); return false; }
    const notifications = await loadNotificationsModule();
    if (!notifications) {
      setPermission('undetermined');
      return false;
    }
    await requestPermissionWithNotice(
      'notifications',
      () => notifications.getPermissionsAsync(),
      () => notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }),
    );
    const status = await notifications.getPermissionsAsync();
    setPermission(status.granted ? 'granted' : status.canAskAgain ? 'undetermined' : 'denied');
    resyncGroceryReminderNow();
    resyncCookingReminderNow();
    return status.granted;
  };
  const setMaster = async (value: boolean) => {
    if (!preferences) return;
    if (value && permission !== 'granted') {
      if (await requestPermission()) {
        const next = { ...preferences, allowNotifications: true };
        setPreferences(next);
        await writeNotificationPreferences(next);
        resyncGroceryReminderNow();
        resyncCookingReminderNow();
      }
      return;
    }
    const next = { ...preferences, allowNotifications: value };
    setPreferences(next);
    await writeNotificationPreferences(next);
    resyncGroceryReminderNow();
    resyncCookingReminderNow();
  };
  const setPreference = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    void writeNotificationPreferences(next).then(() => {
      resyncGroceryReminderNow();
      resyncCookingReminderNow();
    });
  };
  if (!preferences || permission === 'loading') return <SafeAreaView style={styles.safeArea}><FormScreenSkeleton cards={3} /></SafeAreaView>;
  const enabled = permission === 'granted' && preferences.allowNotifications;
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Notifications</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.permissionCard}><View style={styles.permissionCopy}><Text style={styles.rowTitle}>Allow notifications</Text><Text style={styles.rowBody}>{enabled ? 'Okyo notifications are enabled.' : permission === 'denied' ? 'Notifications are blocked in iOS Settings.' : permission === 'granted' ? 'Okyo notifications are paused.' : 'Choose whether Okyo may send notifications.'}</Text></View>{permission === 'denied' ? <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={styles.permissionButton}><Text style={styles.permissionButtonText}>Open Settings</Text></Pressable> : <Switch accessibilityLabel="Allow notifications" onValueChange={(value) => void setMaster(value)} trackColor={{ false: colors.border, true: colors.coral }} value={enabled} />}</View>
      <PreferenceGroup enabled={enabled} label="COOKING" preferences={preferences} rows={[['cookingTimers', 'Cooking step alerts', 'Get a reminder when the current step’s estimated time is up.']]} onChange={setPreference} />
      <PreferenceGroup enabled={enabled} label="REMINDERS" preferences={preferences} rows={[['groceryReminders', 'Grocery reminders', 'A single reminder a few hours after you start a grocery list, while items are still unchecked.']]} onChange={setPreference} />
      <Text style={styles.footer}>Essential notifications only.</Text>
    </ScrollView>
  </SafeAreaView>;
}

function PreferenceGroup({ enabled, label, onChange, preferences, rows }: { enabled: boolean; label: string; onChange: (key: keyof NotificationPreferences, value: boolean) => void; preferences: NotificationPreferences; rows: Array<[keyof NotificationPreferences, string, string]> }) {
  return <View style={styles.section}><Text style={styles.sectionLabel}>{label}</Text><View style={styles.group}>{rows.map(([key, title, body], index) => <View key={key} style={[styles.row, index < rows.length - 1 && styles.divider]}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View><Switch accessibilityLabel={title} disabled={!enabled} onValueChange={(value) => onChange(key, value)} trackColor={{ false: colors.border, true: colors.coral }} value={enabled && preferences[key]} /></View>)}</View></View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 }, loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' }, header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 }, content: { paddingBottom: 150, paddingHorizontal: spacing.gutter },
  permissionCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 8, padding: 16 }, permissionCopy: { flex: 1 }, permissionButton: { borderColor: colors.coral, borderRadius: 14, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 }, permissionButtonText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13 },
  section: { marginTop: 24 }, sectionLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11.5, letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }, group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' }, row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 72, padding: 14 }, divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, rowCopy: { flex: 1 }, rowTitle: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 15 }, rowBody: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 12.5, lineHeight: 18, marginTop: 3 }, footer: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12.5, lineHeight: 18, marginTop: 20, textAlign: 'center' },
});
