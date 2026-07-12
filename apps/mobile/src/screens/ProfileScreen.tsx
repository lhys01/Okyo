import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  NavArrowRight,
  Settings,
  StatsUpSquare,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KikoMascot } from '../components/KikoMascot';
import { ProgressFill } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, layout, spacing, surfaces, typography } from '../theme/okyoTheme';
import { uiLog } from '../utils/uiDebug';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const weeklyGoal = useOkyoStore((state) => state.weeklyGoal);

  const weeklyTarget = getWeeklyGoalCount(weeklyGoal);

  const goTo = (screen: 'SavingsDashboardScreen' | 'SettingsScreen') => {
    uiLog('ProfileScreen', 'open_row', { screen });
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <KikoMascot animated="success" pose="happy" size={82} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Profile</Text>
            <Text style={styles.title}>Your Okyo kitchen</Text>
            <Text style={styles.body}>{weeklyScanCount} scans this week</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Weekly cooking rhythm</Text>
            <Text style={styles.progressValue}>{weeklyScanCount}/{weeklyTarget}</Text>
          </View>
          <ProgressFill progress={Math.min(weeklyScanCount / weeklyTarget, 1)} tone="green" style={styles.progressFillMeter} />
          <Text style={styles.progressHint}>
            {weeklyScanCount >= weeklyTarget
              ? 'You have a solid week of meal ideas ready.'
              : 'Scan meals you actually want to remake. That is the whole habit.'}
          </Text>
        </View>

        <View style={styles.menu}>
          <ProfileRow
            icon={<StatsUpSquare color={colors.green} height={22} strokeWidth={2} width={22} />}
            label="Savings"
            meta="Kitchen ledger"
            onPress={() => goTo('SavingsDashboardScreen')}
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

function getWeeklyGoalCount(goal: string | null) {
  switch (goal) {
    case '1_meal':
      return 1;
    case '5_meals':
      return 5;
    case '7_meals':
      return 7;
    case '3_meals':
    default:
      return 3;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    padding: spacing.screen,
    paddingBottom: layout.scrollClearance,
  },
  headerCard: {
    ...surfaces.card,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    padding: 20,
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
    ...typography.label,
    color: colors.coralDark,
    marginBottom: 8,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
    marginTop: 8,
  },
  progressCard: {
    ...surfaces.panel,
    marginTop: 18,
    padding: 18,
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
  progressFillMeter: {
    marginTop: 14,
  },
  progressHint: {
    ...typography.caption,
    marginTop: 10,
  },
  menu: {
    gap: 10,
    marginTop: spacing.section,
  },
  row: {
    ...surfaces.panel,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
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
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
