import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Crown,
  NavArrowRight,
  Settings,
  StatsUpSquare,
  Trophy,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KikoMascot } from '../components/KikoMascot';
import { colors, typography } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';
import { uiLog } from '../utils/uiDebug';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const totalMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const xp = useOkyoStore((state) => state.xp);
  const unlockedBadges = useOkyoStore((state) => state.unlockedBadges);
  const isPremium = useOkyoStore((state) => state.isPremium);

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes : [];
  const safeChallenges = Array.isArray(completedChallenges) ? completedChallenges : [];
  const safeXp = getFiniteNumber(xp);
  const level = Math.floor(safeXp / 100) + 1;
  const xpIntoLevel = safeXp % 100;
  const recipeSavings = safeSavedRecipes.reduce((total, recipe) => total + getFiniteNumber(recipe.estimatedSavings), 0);
  const challengeSavings = safeChallenges.reduce((total, challenge) => total + getFiniteNumber(challenge.moneySaved), 0);
  const estimatedSaved = getFiniteNumber(totalMoneySaved) + recipeSavings + challengeSavings;
  const badgeCount = Array.isArray(unlockedBadges) ? unlockedBadges.length : 0;

  const goTo = (screen: 'SavingsDashboardScreen' | 'RankingsScreen' | 'SettingsScreen' | 'PaywallScreen') => {
    uiLog('ProfileScreen', 'open_row', { screen });
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <KikoMascot pose="happy" size={82} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Profile</Text>
            <Text style={styles.title}>Your Okyo kitchen</Text>
            <Text style={styles.body}>Level {level} · {safeXp} XP · {weeklyScanCount} scans this week</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Level {level} progress</Text>
            <Text style={styles.progressValue}>{xpIntoLevel}/100 XP</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${xpIntoLevel}%` }]} />
          </View>
        </View>

        <View style={styles.statGrid}>
          <ProfileStat label="Saved" value={formatCurrency(estimatedSaved)} />
          <ProfileStat label="Recipes" value={safeSavedRecipes.length.toString()} />
          <ProfileStat label="Wins" value={safeChallenges.length.toString()} />
          <ProfileStat label="Badges" value={badgeCount.toString()} />
        </View>

        <View style={styles.menu}>
          <ProfileRow
            icon={<StatsUpSquare color={colors.green} height={22} strokeWidth={2} width={22} />}
            label="Savings"
            meta="Kitchen ledger"
            onPress={() => goTo('SavingsDashboardScreen')}
          />
          <ProfileRow
            icon={<Trophy color={colors.coral} height={22} strokeWidth={2} width={22} />}
            label="Rankings"
            meta="XP and badges"
            onPress={() => goTo('RankingsScreen')}
          />
          <ProfileRow
            icon={<Crown color={colors.charcoal} height={22} strokeWidth={2} width={22} />}
            label={isPremium ? 'Okyo Plus active' : 'Okyo Plus'}
            meta={isPremium ? 'Unlimited scans enabled' : 'Unlimited scans preview'}
            onPress={() => goTo('PaywallScreen')}
          />
          <ProfileRow
            icon={<Settings color={colors.charcoal} height={22} strokeWidth={2} width={22} />}
            label="Settings"
            meta="App and local data"
            onPress={() => goTo('SettingsScreen')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ProfileRow({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]} onPress={onPress}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <NavArrowRight color={colors.muted} height={21} strokeWidth={2} width={21} />
    </Pressable>
  );
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    padding: spacing.screen,
    paddingBottom: 132,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.hero,
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    padding: 20,
    ...shadows.hero,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 32,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    ...typography.caption,
    color: colors.coral,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
    marginTop: 8,
  },
  progressCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    marginTop: 18,
    padding: 18,
    ...shadows.card,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressLabel: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
  },
  progressValue: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    height: 10,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    height: '100%',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    minHeight: 86,
    padding: 16,
    width: '48%',
    ...shadows.card,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.charcoal,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 9,
  },
  menu: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    marginTop: spacing.section,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 78,
    paddingHorizontal: 16,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '700',
  },
  rowMeta: {
    ...typography.caption,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
