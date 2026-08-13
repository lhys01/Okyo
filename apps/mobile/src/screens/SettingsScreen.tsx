import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Leaf,
  Lock,
  HelpCircle,
  NavArrowRight,
  PrivacyPolicy,
  Sparks,
  StatsUpSquare,
  WarningTriangle,
} from 'iconoir-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import appConfig from '../../app.json';
import { analyticsEvents, track } from '../analytics/track';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { primaryGoalLabels } from '../onboarding-v3/state/personalizedOnboarding';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';
import type { MainTabParamList } from '../navigation/types';
import { uiLog } from '../utils/uiDebug';

type Navigation = NativeStackNavigationProp<MainTabParamList>;

type IconComponent = ComponentType<{ color?: string; height?: number; width?: number }>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const avatarImage = require('../../assets/profile/okyo-avatar.png');

/** Bottom nav is absolutely positioned, so content needs clearance to scroll past it. */
const NAV_CLEARANCE = 132;

type ProfileSummary = {
  name: string | null;
  goalLabel: string | null;
  dietaryCount: number;
  nutritionTargetSummary: string | null;
};

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const resetOnboarding = useOkyoStore((state) => state.resetOnboarding);
  const appVersion = appConfig.expo.version;
  const didTrackView = useRef(false);
  const [profile, setProfile] = useState<ProfileSummary>({
    name: null,
    goalLabel: null,
    dietaryCount: 0,
    nutritionTargetSummary: null,
  });

  useEffect(() => {
    if (didTrackView.current) return;
    didTrackView.current = true;
    uiLog('SettingsScreen', 'enter');
    track(analyticsEvents.SETTINGS_VIEWED, { screen: 'SettingsScreen' });
  }, []);

  // Real persisted onboarding data drives the profile card. Nothing is invented:
  // any field that was never captured simply does not render.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void Promise.all([
      onboardingV3Persistence.readPersonalizedProfile(),
      onboardingV3Persistence.readDietary(),
    ])
      .then(([personalized, dietary]) => {
        if (cancelled) return;
        setProfile({
          name: personalized.name.trim() || null,
          goalLabel: personalized.primaryGoal ? primaryGoalLabels[personalized.primaryGoal] : null,
          dietaryCount: dietary.allergies.length + dietary.restrictions.length + dietary.avoidances.length + dietary.dislikes.length,
          nutritionTargetSummary: personalized.nutritionTargets ? `${personalized.nutritionTargets.calories} cal · ${personalized.nutritionTargets.proteinGrams}g protein` : null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []));

  const go = useCallback(
    (screen: keyof MainTabParamList) => {
      void Haptics.selectionAsync().catch(() => undefined);
      navigation.navigate(screen);
    },
    [navigation],
  );

  const explainAccountDeletion = useCallback(() => {
    Alert.alert('No Okyo account is connected', 'This build does not have an account or sign-in backend to delete. You can remove all locally stored Okyo data from Privacy & data.');
  }, []);

  const confirmResetOnboarding = useCallback(() => {
    Alert.alert('Reset onboarding?', 'You will see the Okyo onboarding flow again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          uiLog('SettingsScreen', 'reset_onboarding');
          void onboardingV3Persistence.reset().catch((error: unknown) => {
            uiLog('SettingsScreen', 'reset_onboarding_v3_failed', { error: String(error) });
          });
          resetOnboarding();
          track(analyticsEvents.ONBOARDING_RESET, { screen: 'SettingsScreen' });
        },
      },
    ]);
  }, [resetOnboarding]);

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
            isLast
            label="Notifications"
            onPress={() => go('NotificationPreferencesScreen')}
            tint={colors.coralSoft}
            tintIcon={colors.coralDark}
          />
        </Section>

        <Section label="YOUR OKYO">
          <Row
            icon={StatsUpSquare}
            isLast
            label="Stats & progress"
            onPress={() => go('StatsProgressScreen')}
            tint={colors.coralSoft}
            tintIcon={colors.coralDark}
          />
        </Section>

        <Section label="PRIVACY">
          <Row
            icon={Lock}
            isLast
            label="Privacy & data"
            onPress={() => go('PrivacyDataScreen')}
            tint={colors.macrosSoft}
            tintIcon={colors.macros}
          />
        </Section>

        <Section label="ACCOUNT">
          <Row
            icon={WarningTriangle}
            isLast
            label="Delete account"
            onPress={explainAccountDeletion}
            tint="#fff0ee"
            tintIcon={colors.danger}
            value="No account connected"
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

        {__DEV__ ? (
          <Section label="DEVELOPMENT">
            <Row
              icon={Sparks}
              isLast
              label="Reset onboarding"
              onPress={confirmResetOnboarding}
              tint={colors.canvasSunk}
              tintIcon={colors.body}
            />
          </Section>
        ) : null}

        <Text style={styles.version}>Okyo v{appVersion}</Text>
      </ScrollView>
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
    color: colors.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 28,
    letterSpacing: -0.4,
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
  section: { marginTop: spacing.xl },
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
    gap: spacing.md,
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
    fontSize: 15.5,
  },
  rowValue: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    maxWidth: 130,
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
