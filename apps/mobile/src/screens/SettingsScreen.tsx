import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Leaf,
  Lock,
  HelpCircle,
  LightBulb,
  NavArrowRight,
  PrivacyPolicy,
  Sparks,
  StatsUpSquare,
  WarningTriangle,
} from 'iconoir-react-native';
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import appConfig from '../../app.json';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { saveMoneyBranchPersistence } from '../onboarding-v3/state/saveMoneyBranchPersistence';
import { healthBranchPersistence } from '../onboarding-v3/state/healthBranchPersistence';
import { macrosBranchPersistence } from '../onboarding-v3/state/macrosBranchPersistence';
import { onboardingQuestionExperiment, type OnboardingQuestionVariant } from '../onboarding-v3/state/onboardingQuestionExperiment';
import { getAccountCapabilities } from '../api/client';
import { canonicalOnboardingPersistence } from '../onboarding/canonical/persistence';
import { resetCanonicalOnboarding } from '../onboarding/canonical/reset';
import { primaryGoalLabels } from '../onboarding-v3/state/personalizedOnboarding';
import { getFoxDisplayName } from '../state/foxDisplayName';
import { useOkyoStore } from '../state/useOkyoStore';
import { useTour } from '../tour/TourContext';
import { tourPersistence } from '../tour/tourPersistence';
import { useOkyoAuth } from '../auth/useOkyoAuth';
import { resetRevenueCatIdentity } from '../services/revenueCat';
import { colors, fontFamilies, mainTabHeading, radius, spacing } from '../theme/okyoTheme';
import type { MainTabParamList } from '../navigation/types';
import { uiLog } from '../utils/uiDebug';

type Navigation = NativeStackNavigationProp<MainTabParamList>;

type IconComponent = ComponentType<{ color?: string; height?: number; width?: number }>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarImage = require('../../assets/profile/okyo-avatar-sticker.png');

/**
 * Loaded lazily for the same reason AuthGate does it: SignInScreen pulls in
 * Clerk's native modules at import time, so a build without Clerk configured
 * must never evaluate it. The row that mounts this is itself gated on
 * `auth.isAvailable`, so the import only ever runs in a Clerk-enabled build.
 */
const LazySignInScreen = lazy(async () => ({
  default: (await import('../auth/SignInScreen')).SignInScreen,
}));

/** Bottom nav is absolutely positioned, so content needs clearance to scroll past it. */
const NAV_CLEARANCE = 132;

type ProfileSummary = {
  name: string | null;
  goalLabel: string | null;
  dietaryCount: number;
  nutritionTargetSummary: string | null;
  mascotName: string | null;
};

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const resetOnboarding = useOkyoStore((state) => state.resetOnboarding);
  const personalizationComplete = useOkyoStore((state) => state.personalizationComplete);
  const appVersion = appConfig.expo.version;
  const didTrackView = useRef(false);
  const resetOnboardingInFlight = useRef(false);
  const [profile, setProfile] = useState<ProfileSummary>({
    name: null,
    goalLabel: null,
    dietaryCount: 0,
    nutritionTargetSummary: null,
    mascotName: null,
  });
  const [experimentAssignment, setExperimentAssignment] = useState('Loading');

  useEffect(() => {
    if (didTrackView.current) return;
    didTrackView.current = true;
    uiLog('SettingsScreen', 'enter');

  }, []);

  // Real persisted onboarding data drives the profile card. Nothing is invented:
  // any field that was never captured simply does not render.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void Promise.all([
      canonicalOnboardingPersistence.readSnapshot(),
      onboardingV3Persistence.readDietary(),
      onboardingV3Persistence.readChosenMascotName(),
    ])
      .then(([snapshot, dietary, mascotName]) => {
        if (cancelled) return;
        const personalized = snapshot.profile;
        setProfile({
          name: personalized.name.trim() || null,
          goalLabel: personalized.primaryGoal ? primaryGoalLabels[personalized.primaryGoal] : null,
          dietaryCount: dietary.allergies.length + dietary.restrictions.length + dietary.avoidances.length + dietary.dislikes.length,
          nutritionTargetSummary: personalized.nutritionTargets ? `${personalized.nutritionTargets.calories} cal · ${personalized.nutritionTargets.proteinGrams}g protein` : null,
          mascotName,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []));

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void Promise.all([onboardingQuestionExperiment.getAssignment(), onboardingQuestionExperiment.getOverride()]).then(([assignment, override]) => {
      if (!cancelled) setExperimentAssignment(override ? `${override} · forced` : `${assignment} · random`);
    });
    return () => { cancelled = true; };
  }, []));

  const setExperimentVariant = useCallback((variant: OnboardingQuestionVariant | null, randomize = false) => {
    const update = randomize
      ? onboardingQuestionExperiment.resetAssignment()
      : onboardingQuestionExperiment.setOverride(variant);
    void update.then(async () => {
      const assignment = await onboardingQuestionExperiment.getAssignment();
      const override = await onboardingQuestionExperiment.getOverride();
      setExperimentAssignment(override ? `${override} · forced` : `${assignment} · random`);
    }).catch(() => setExperimentAssignment('Unavailable'));
  }, []);

  const chooseExperimentVariant = useCallback(() => {
    Alert.alert('Onboarding experiment', 'Choose a version, then reset onboarding to preview it.', [
      { text: 'A · Keep all questions', onPress: () => setExperimentVariant('A') },
      { text: 'B · Remove score 3 questions', onPress: () => setExperimentVariant('B') },
      { text: 'C · Short flow', onPress: () => setExperimentVariant('C') },
    ]);
  }, [setExperimentVariant]);

  const go = useCallback(
    (screen: keyof MainTabParamList) => {
      void Haptics.selectionAsync().catch(() => undefined);
      navigation.navigate(screen);
    },
    [navigation],
  );

  const confirmResetOnboarding = useCallback(() => {
    Alert.alert('Reset onboarding?', 'You will see the Okyo onboarding flow again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          if (resetOnboardingInFlight.current) return;
          resetOnboardingInFlight.current = true;
          uiLog('SettingsScreen', 'reset_onboarding');
          // Onboarding-owned reset only touches onboarding state — but the
          // guided tour must be able to run again once the user completes
          // onboarding a second time, so its own persisted status resets
          // too. This does NOT open the tour now: MainTabs (and therefore
          // TourProvider) doesn't mount again until onboarding is completed
          // and the app lands on Home, which is exactly when it should.
          void resetCanonicalOnboarding({
            resetCanonicalPersistence: () => Promise.all([
              canonicalOnboardingPersistence.reset(),
              saveMoneyBranchPersistence.reset(),
              healthBranchPersistence.reset(),
              macrosBranchPersistence.reset(),
            ]).then(() => undefined),
            resetSession: resetOnboarding,
            resetTour: () => tourPersistence.resetStatus(),
            onError: (scope, error) => uiLog('SettingsScreen', scope === 'persistence' ? 'reset_onboarding_v3_failed' : 'reset_tour_for_onboarding_replay_failed', { error: String(error) }),
          })
            .then((result) => {

            })
            .finally(() => { resetOnboardingInFlight.current = false; });
        },
      },
    ]);
  }, [resetOnboarding]);

  const auth = useOkyoAuth();
  const [experimentCapability, setExperimentCapability] = useState<{ userId: string | null; allowed: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    setExperimentCapability(null);
    if (__DEV__ && auth.isLoaded && auth.isSignedIn) {
      void auth.getToken().then(token => token ? getAccountCapabilities(token) : null).then(capabilities => {
        if (active) setExperimentCapability({ userId: auth.userId, allowed: capabilities?.canManageOnboardingExperiments === true });
      }).catch(() => { /* Keep development controls hidden when verification fails. */ });
    }
    return () => { active = false; };
  }, [auth.isLoaded, auth.isSignedIn, auth.userId]);
  const canManageOnboardingExperiment = __DEV__ && auth.isSignedIn && experimentCapability?.userId === auth.userId && experimentCapability?.allowed === true;
  const [signInVisible, setSignInVisible] = useState(false);
  const openSignIn = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSignInVisible(true);
  }, []);
  const closeSignIn = useCallback(() => setSignInVisible(false), []);
  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'Your saved recipes stay on this device. Sign back in any time with email and password, Apple, or Google.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          uiLog('SettingsScreen', 'sign_out');
          void Promise.all([
            auth.signOut(),
            resetRevenueCatIdentity(),
          ]).catch(() => {
            // Clerk/native errors can contain sensitive response details. Keep
            // the event useful without forwarding raw exception text to logs.
            uiLog('SettingsScreen', 'sign_out_failed');
          });
        },
      },
    ]);
  }, [auth]);

  const { devReset: devResetTour } = useTour();
  const confirmResetTour = useCallback(() => {
    Alert.alert('Reset guided tour?', 'You will see the post-onboarding feature tour again, starting now.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          uiLog('SettingsScreen', 'reset_feature_tour');
          // Order matters: reset persisted state, THEN navigate to Home.
          // `devResetTour()` only arms `pendingStart` — TourOverlay itself
          // waits for Home to actually be focused before flipping the tour
          // active, so it can never paint over this Settings screen.
          devResetTour();
          (navigation as any).navigate('MainTabs', { screen: 'HomeScreen' });
        },
      },
    ]);
  }, [devResetTour, navigation]);

  const profileSubtitle = [profile.goalLabel, profile.dietaryCount > 0 ? `${profile.dietaryCount} food preferences` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <Pressable
          accessibilityHint="Opens your Okyo profile"
          accessibilityLabel={profile.name ? `Profile, ${profile.name}` : 'Your Okyo profile'}
          accessibilityRole="button"
          onPress={() => go('ProfileScreen')}
          style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
        >
          <Image accessibilityIgnoresInvertColors source={avatarImage} style={styles.avatar} />
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={styles.profileName}>
              {profile.name ?? 'Your Okyo profile'}
            </Text>
            <Text numberOfLines={1} style={styles.profileMeta}>
              {profileSubtitle || 'Personalize your food journey'}
            </Text>
          </View>
          <NavArrowRight color={colors.muted} height={20} width={20} />
        </Pressable>

        <Section label="PREFERENCES">
          <Row
            icon={Leaf}
            label="Dietary preferences"
            onPress={() => go('DietaryPreferencesScreen')}
            tint={colors.savingsSoft}
            tintIcon={colors.savings}
            value={profile.dietaryCount > 0 ? String(profile.dietaryCount) : 'None set'}
          />
          {profile.nutritionTargetSummary ? <Row
            icon={StatsUpSquare}
            label="Nutrition targets"
            onPress={() => go('NutritionTargetsScreen')}
            tint={colors.macrosSoft}
            tintIcon={colors.macros}
            value={profile.nutritionTargetSummary}
          /> : null}
          <Row
            icon={Bell}
            label="Notifications"
            onPress={() => go('NotificationPreferencesScreen')}
            tint={colors.coralSoft}
            tintIcon={colors.coralDark}
          />
          <Row
            icon={Sparks}
            isLast
            label="Personalization"
            onPress={() => go('PersonalizationScreen')}
            tint={colors.coralSoft}
            tintIcon={colors.coralDark}
            value={personalizationComplete ? getFoxDisplayName(profile.mascotName) : 'Finish personalization'}
          />
        </Section>

        <Section label="ACTIVITY">
          <Row
            icon={LightBulb}
            label="Idea board"
            onPress={() => go('IdeaBoardScreen')}
            tint={colors.coralSoft}
            tintIcon={colors.coralDark}
          />
          <Row
            icon={StatsUpSquare}
            isLast
            label="Stats & progress"
            onPress={() => go('StatsProgressScreen')}
            tint={colors.coralSoft}
            tintIcon={colors.coralDark}
          />
        </Section>

        <Section label="PRIVACY & ACCOUNT">
          <Row
            icon={Lock}
            label="Privacy & data"
            onPress={() => go('PrivacyDataScreen')}
            tint={colors.macrosSoft}
            tintIcon={colors.macros}
          />
          {auth.isAvailable && !auth.isSignedIn ? (
            <Row
              icon={Sparks}
              label="Sign in"
              onPress={openSignIn}
              tint="#f3f0ff"
              tintIcon={colors.charcoal}
              value="Email, Apple, Google"
            />
          ) : null}
          {auth.isAvailable && auth.isSignedIn ? (
            <Row
              icon={WarningTriangle}
              label="Sign out"
              onPress={confirmSignOut}
              tint="#f3f0ff"
              tintIcon={colors.charcoal}
              value={auth.accountLabel ?? 'Signed in'}
            />
          ) : null}
          <Row
            icon={WarningTriangle}
            isLast
          label="Delete account"
            onPress={() => go('PrivacyDataScreen')}
            tint="#fff0ee"
            tintIcon={colors.danger}
            value={auth.isSignedIn ? (auth.accountLabel ?? 'Signed in') : 'Not connected'}
          />
        </Section>

        <Section label="SUPPORT">
          <Row
            icon={HelpCircle}
            label="Help & support"
            onPress={() => go('HelpSupportScreen')}
            tint={colors.healthSoft}
            tintIcon={colors.health}
          />
          <Row
            icon={PrivacyPolicy}
            isLast
            label="Terms & privacy"
            onPress={() => go('LegalScreen')}
            tint={colors.canvasSunk}
            tintIcon={colors.body}
          />
        </Section>

        {canManageOnboardingExperiment ? (
          <Section label="ADMIN TOOLS">
            <Row
              icon={StatsUpSquare}
              label="Preview onboarding A/B/C"
              onPress={chooseExperimentVariant}
              tint={colors.canvasSunk}
              tintIcon={colors.body}
              value={experimentAssignment}
            />
            <Row
              icon={Sparks}
              label="Randomize onboarding version"
              onPress={() => setExperimentVariant(null, true)}
              tint={colors.canvasSunk}
              tintIcon={colors.body}
            />
          </Section>
        ) : null}

        {__DEV__ ? (
          <Section label="DEVELOPER TOOLS">
            <Row
              icon={Sparks}
              label="Reset onboarding"
              onPress={confirmResetOnboarding}
              tint={colors.canvasSunk}
              tintIcon={colors.body}
            />
            <Row
              icon={Sparks}
              isLast
              label="Reset guided tour"
              onPress={confirmResetTour}
              tint={colors.canvasSunk}
              tintIcon={colors.body}
            />
          </Section>
        ) : null}

        <Text style={styles.version}>Okyo v{appVersion}</Text>
      </ScrollView>

      {signInVisible ? (
        <Modal
          animationType="slide"
          onRequestClose={closeSignIn}
          presentationStyle="pageSheet"
          transparent={false}
        >
          <Suspense fallback={null}>
            {/* onDone fires only after a real session is created; onSkip on
                cancel/dismiss. Both just close the sheet — Settings re-reads
                auth state from Clerk on the next render. */}
            <LazySignInScreen onDone={closeSignIn} onSkip={closeSignIn} />
          </Suspense>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  onPress,
  tint,
  tintIcon,
  value,
  isLast,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  tint: string;
  tintIcon: string;
  value?: string;
  isLast?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={[styles.iconTile, { backgroundColor: tint }]}>
        <Icon color={tintIcon} height={19} width={19} />
      </View>
      <Text numberOfLines={1} style={styles.rowLabel}>
        {label}
      </Text>
      {value ? (
        <Text numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      <NavArrowRight color={colors.muted} height={19} width={19} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: {
    paddingBottom: NAV_CLEARANCE,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
  title: {
    ...mainTabHeading,
    marginBottom: spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: {
    color: colors.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  profileMeta: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 13,
  },
  section: { marginTop: spacing.lg },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
    letterSpacing: 0.9,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconTile: {
    alignItems: 'center',
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rowLabel: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    minWidth: 0,
  },
  rowValue: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    maxWidth: 108,
  },
  version: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12.5,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  pressed: { opacity: 0.6 },
});
