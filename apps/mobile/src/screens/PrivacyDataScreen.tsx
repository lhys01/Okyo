import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowDown, NavArrowLeft, NavArrowRight } from 'iconoir-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList } from '../navigation/types';
import { checkAccountDeletionSession, deleteAuthenticatedAccount } from '../api/client';
import { reset as resetAnalyticsIdentity } from '../analytics/analyticsClient';
import { analyticsEvents, track } from '../analytics/track';
import { useOkyoAuth } from '../auth/useOkyoAuth';
import { resetRevenueCatIdentity } from '../services/revenueCat';
import { clearAllPersonalOkyoData } from '../state/dietaryDeletion';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';
import { clearCookingStepReminder, clearGroceryReminder } from '../utils/notifications';
import { openSupportEmail, SUPPORT_EMAIL } from '../support/supportContact';
import { accountDeletionFailure } from './accountDeletionFeedback';
import { cleanupDeletedAccountDevice } from './accountDeletionDeviceCleanup';

type Navigation = NativeStackNavigationProp<MainTabParamList>;

const DATA_SECTIONS = [
  ['What Okyo stores', 'Okyo stores generated recipes, scan results, saved and grocery selections, cooking progress, recipe feedback, savings estimates, preferences, and app progress locally on this device.'],
  ['Photos & food scans', 'A photo selected for scanning is copied into Okyo’s local app storage and sent to the Okyo API for analysis. The image may be included in a saved recipe record. Delete all data removes Okyo’s local scan-image folder.'],
  ['Recipe and cooking history', 'Scan results, generated recipes, likes, grocery selections, completion state, and active cooking progress are stored locally so the app can restore them.'],
  ['Dietary preferences', 'Allergies, restrictions, avoidances, and dislikes are stored locally and sent with relevant AI requests so recipes can be adapted. Allergen detection is not guaranteed.'],
  ['AI processing', 'Food images, meal descriptions, recipe context, and relevant preferences may be sent to the Okyo API and its configured AI service to identify food, generate recipes, answer questions, or revise a recipe. External providers handle retention under their own policies and agreements.'],
] as const;

export function PrivacyDataScreen() {
  const navigation = useNavigation<Navigation>();
  const clearSavedData = useOkyoStore((state) => state.clearSavedData);
  const resetOnboarding = useOkyoStore((state) => state.resetOnboarding);
  const auth = useOkyoAuth();
  const [open, setOpen] = useState<string | null>('What Okyo stores');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const deletingAccountRef = useRef(false);
  const cleanupDeletedAccountDeviceData = () => cleanupDeletedAccountDevice({
    clearLocalData: async () => {
      await Promise.all([
        clearAllPersonalOkyoData(clearSavedData),
        clearGroceryReminder(),
        clearCookingStepReminder(),
      ]);
    },
    resetRevenueCatIdentity: () => resetRevenueCatIdentity({ strict: true }),
    resetAnalyticsIdentity,
    signOut: () => auth.signOut(),
    resetOnboarding,
  });
  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const contactSupport = () => {
    void openSupportEmail((url) => Linking.openURL(url)).catch(() => {
      Alert.alert('Email Okyo support', `Please email ${SUPPORT_EMAIL}.`);
    });
  };
  const deleteAllData = () => Alert.alert('Delete all Okyo data?', 'This removes local recipes, scan and cooking history, grocery state, preferences, progress, and locally stored scan images. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete data', style: 'destructive', onPress: () => void clearAllPersonalOkyoData(clearSavedData, { clearReminder: async () => { await Promise.all([clearGroceryReminder(), clearCookingStepReminder()]); } })
      .then(() => { track(analyticsEvents.LOCAL_DATA_CLEARED, { result: 'success' }); Alert.alert('Local data deleted', 'Okyo’s locally stored recipes, scans, cooking history, preferences, and progress were removed.'); })
      .catch(() => Alert.alert('Couldn’t delete all data', 'Try again in a moment.')) },
  ]);
  const retryDeviceCleanup = async () => {
    if (deletingAccountRef.current) return;
    deletingAccountRef.current = true;
    try {
      await cleanupDeletedAccountDeviceData();
      Alert.alert('Device data deleted', 'The remaining Okyo data on this device has been removed. Your account had already been deleted.');
    } catch {
      Alert.alert(
        'Device cleanup still incomplete',
        `Your account was deleted, but Okyo could not confirm that every local item was removed. Retry device cleanup or email ${SUPPORT_EMAIL}.`,
        [
          { text: 'Retry device cleanup', onPress: () => void retryDeviceCleanup() },
          { text: 'Contact Support', onPress: contactSupport },
        ],
      );
    } finally {
      deletingAccountRef.current = false;
    }
  };
  const completeAccountDeletion = async () => {
    if (deletingAccountRef.current) return;
    deletingAccountRef.current = true;
    setDeletingAccount(true);
    let accountDeleted = false;
    let appleAuthorizationRevocation: 'not_applicable' | 'revoked' | 'manual_action_required' | 'unknown' = 'not_applicable';
    try {
      track(analyticsEvents.ACCOUNT_DELETION_STARTED, { flow: 'account_deletion' });
      const token = await auth.getToken();
      if (__DEV__) console.info('account_deletion_auth_state', {
        clerkLoaded: auth.isLoaded,
        clerkSignedIn: auth.isSignedIn,
        activeSessionPresent: auth.hasActiveSession,
        tokenAvailable: Boolean(token),
        authorizationBearerSent: Boolean(token),
      });
      if (!token) {
        Alert.alert('Sign in again', 'Your session has expired. Sign in again before deleting your account.');
        return;
      }
      const deletion = await deleteAuthenticatedAccount(token);
      accountDeleted = true;
      track(analyticsEvents.ACCOUNT_DELETION_SUCCEEDED, { flow: 'account_deletion', result: 'success' });
      appleAuthorizationRevocation = deletion.appleAuthorizationRevocation;
      await cleanupDeletedAccountDeviceData();
      Alert.alert(
        'Account deleted',
        appleAuthorizationRevocation === 'manual_action_required'
          ? 'Your Okyo account and data saved on this device have been deleted. Apple access could not be revoked automatically. On your iPhone, open Settings › your name › Sign-In & Security › Sign in with Apple › Okyo, then choose Stop Using Apple ID. Deleting an account does not cancel an App Store subscription; manage or cancel it in your App Store subscription settings.'
          : appleAuthorizationRevocation === 'unknown'
            ? 'Your Okyo account and data saved on this device have been deleted. I could not verify the Apple authorization status from the earlier attempt. If you signed in with Apple, open Settings › your name › Sign-In & Security › Sign in with Apple › Okyo and choose Stop Using Apple ID if Okyo is still listed. Deleting an account does not cancel an App Store subscription; manage or cancel it in your App Store subscription settings.'
            : 'Your Okyo account and data saved on this device have been deleted. Deleting an account does not cancel an App Store subscription; manage or cancel it in your App Store subscription settings.',
      );
    } catch (caught: unknown) {
      if (!accountDeleted) track(analyticsEvents.ACCOUNT_DELETION_FAILED, { flow: 'account_deletion', result: 'failure', reason: 'unknown' });
      if (accountDeleted) {
        const appleFollowup = appleAuthorizationRevocation === 'manual_action_required'
          ? ' Apple access could not be revoked automatically; after cleanup, remove Okyo from your Apple account’s Sign in with Apple settings.'
          : appleAuthorizationRevocation === 'unknown'
            ? ' Apple authorization could not be verified; if you signed in with Apple, check your Apple account’s Sign in with Apple settings.'
            : '';
        Alert.alert(
          'Account deleted, device reset incomplete',
          `Your account deletion was confirmed, but Okyo could not finish clearing this device. Retry device cleanup; the server deletion will not be sent again.${appleFollowup} If cleanup still fails, email ${SUPPORT_EMAIL}.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Retry device cleanup', onPress: () => void retryDeviceCleanup() },
            { text: 'Contact Support', onPress: contactSupport },
          ],
        );
      } else {
        const failure = accountDeletionFailure(caught);
        Alert.alert(
          failure.title,
          failure.message,
          [
            { text: 'Not now', style: 'cancel' },
            ...(failure.canRetry ? [{ text: 'Retry', onPress: confirmAccountDeletion }] : []),
            { text: 'Contact Support', onPress: contactSupport },
          ],
        );
      }
    } finally {
      deletingAccountRef.current = false;
      setDeletingAccount(false);
    }
  };

  const confirmAccountDeletion = async () => {
    if (deletingAccountRef.current) return;
    if (!auth.isAvailable || !auth.isLoaded || !auth.isSignedIn || !auth.hasActiveSession) {
      Alert.alert('No account signed in', 'Sign in with email and password or Google first if you want to delete an Okyo account. Apple sign-in can be used when it is enabled for this release. “Delete all my data” removes the data stored on this device.');
      return;
    }
    deletingAccountRef.current = true;
    setDeletingAccount(true);
    try {
      const token = await auth.getToken();
      if (__DEV__) console.info('account_deletion_preflight_auth_state', {
        clerkLoaded: auth.isLoaded,
        clerkSignedIn: auth.isSignedIn,
        activeSessionPresent: auth.hasActiveSession,
        tokenAvailable: Boolean(token),
        authorizationBearerSent: Boolean(token),
      });
      if (!token) {
        Alert.alert('Sign in again', 'Your session has expired. Sign in again before deleting your account. No deletion was started.');
        return;
      }
      await checkAccountDeletionSession(token);
    } catch (caught: unknown) {
      const failure = accountDeletionFailure(caught);
      Alert.alert(failure.title, failure.message, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Contact Support', onPress: contactSupport },
      ]);
      return;
    } finally {
      deletingAccountRef.current = false;
      setDeletingAccount(false);
    }
    Alert.alert(
      'Delete your Okyo account?',
      'This permanently deletes your Okyo account and data saved on this device, and requests removal of the linked RevenueCat customer record when subscriptions are configured. This cannot be undone. Your App Store subscription, if any, continues until you cancel it with Apple.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'This cannot be undone',
            'Do you want to permanently delete your account now?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete account', style: 'destructive', onPress: () => void completeAccountDeletion() },
            ],
          ),
        },
      ],
    );
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Privacy & data</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>Control your information and understand how Okyo uses it.</Text>
      <Text style={styles.sectionLabel}>YOUR DATA</Text>
      <View style={styles.group}>{DATA_SECTIONS.map(([title, body], index) => <Pressable key={title} accessibilityLabel={`Section ${title}`} accessibilityRole="button" accessibilityState={{ expanded: open === title }} onPress={() => setOpen(open === title ? null : title)} style={[styles.accordion, index < DATA_SECTIONS.length - 1 && styles.divider]}><View style={styles.accordionHeading}><Text style={styles.rowTitle}>{title}</Text>{open === title ? <NavArrowDown color={colors.muted} height={18} width={18} /> : <NavArrowRight color={colors.muted} height={18} width={18} />}</View>{open === title ? <Text style={styles.body}>{body}</Text> : null}</Pressable>)}</View>

      <Text style={styles.sectionLabel}>CONTROLS</Text>
      <View style={styles.group}><View style={styles.infoRow}><Text style={styles.rowTitle}>Data export</Text><Text style={styles.body}>For a copy of information held by Okyo, email support.okyo@gmail.com.</Text></View><Pressable accessibilityLabel="Delete all my data" accessibilityRole="button" onPress={deleteAllData} style={[styles.actionRow, styles.dangerTop]}><Text style={styles.dangerText}>Delete all my data</Text><NavArrowRight color={colors.danger} height={18} width={18} /></Pressable></View>

      <Text style={styles.sectionLabel}>LEGAL</Text>
      <View style={styles.group}><Pressable accessibilityLabel="Privacy Policy and Terms" accessibilityRole="button" onPress={() => navigation.navigate('LegalScreen')} style={styles.actionRow}><Text style={styles.rowTitle}>Privacy Policy & Terms</Text><NavArrowRight color={colors.muted} height={18} width={18} /></Pressable></View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.group}><Pressable accessibilityLabel="Delete account" accessibilityRole="button" disabled={deletingAccount} onPress={confirmAccountDeletion} style={styles.actionRow}><View style={styles.flex}><Text style={styles.dangerText}>{deletingAccount ? 'Deleting account…' : 'Delete account'}</Text><Text style={styles.body}>{auth.isSignedIn ? 'Permanently remove your signed-in Okyo account and local data.' : 'No account is signed in. Local data can still be deleted above.'}</Text></View>{deletingAccount ? <ActivityIndicator color={colors.danger} /> : <NavArrowRight color={colors.danger} height={18} width={18} />}</Pressable></View>
      <Text style={styles.review}>Questions about AI-provider retention or your regional privacy rights? Contact {SUPPORT_EMAIL}.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { backgroundColor: colors.background, flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 }, content: { paddingBottom: 150, paddingHorizontal: spacing.gutter }, intro: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, marginBottom: 6 }, sectionLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11.5, letterSpacing: 0.8, marginBottom: 8, marginLeft: 4, marginTop: 26 }, group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' }, accordion: { padding: 15 }, accordionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, rowTitle: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 15 }, body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: 6 }, infoRow: { padding: 15 }, actionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, padding: 15 }, dangerTop: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, dangerText: { color: colors.danger, fontFamily: fontFamilies.bold, fontSize: 15 }, flex: { flex: 1 }, review: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11.5, lineHeight: 17, marginTop: 24 }, });
