import {
  CheckCircle,
  Spark,
} from 'iconoir-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { RecipeQualityReport } from '../mocks';
import { colors, fontFamilies, radius, shadows, spacing, typography } from '../theme/okyoTheme';
import { getRecipeQualityStatusLabel } from '../utils/recipeQuality';

type RecipeQualityCardProps = {
  report: RecipeQualityReport;
  compact?: boolean;
};

export function RecipeQualityCard({ compact = false, report }: RecipeQualityCardProps) {
  const cookabilityStatus = getSafeCookabilityStatus(report.cookabilityStatus);
  const score = getSafeScore(report.score);
  const summary = typeof report.userFacingSummary === 'string' && report.userFacingSummary.trim().length > 0
    ? report.userFacingSummary.trim()
    : 'Okyo checked this recipe and found a few practical things to review before cooking.';
  const missingIngredients = getSafeList(report.missingIngredients);
  const missingSteps = getSafeList(report.missingSteps);
  const vagueInstructions = getSafeList(report.vagueInstructions);
  const timeWarnings = getSafeList(report.timeWarnings);
  const equipmentWarnings = getSafeList(report.equipmentWarnings);
  const fixesApplied = getSafeList(report.fixesApplied);
  const budgetOpportunities = getSafeList(report.budgetOpportunities);
  const speedOpportunities = getSafeList(report.speedOpportunities);
  const pantryStaples = getSafeList(report.pantryStaples);
  const topIssues = [
    ...missingIngredients,
    ...missingSteps,
    ...vagueInstructions.map((instruction) => `Vague step: ${instruction}`),
    ...timeWarnings,
    ...equipmentWarnings,
  ].slice(0, compact ? 2 : 3);
  const helpfulWins = [
    ...fixesApplied,
    ...budgetOpportunities,
    ...speedOpportunities,
  ].slice(0, compact ? 2 : 3);
  const statusTone = cookabilityStatus === 'cookable'
    ? styles.statusGood
    : cookabilityStatus === 'needs_quick_fix'
      ? styles.statusCareful
      : styles.statusRisky;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBubble}>
          <Spark color={colors.coral} height={20} strokeWidth={2.25} width={20} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Okyo Recipe Check</Text>
          <Text numberOfLines={2} style={styles.title}>{getRecipeQualityStatusLabel(cookabilityStatus)}</Text>
        </View>
        <View style={[styles.scorePill, statusTone]}>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      <Text style={styles.summary}>{summary}</Text>

      {topIssues.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Check before cooking</Text>
          {topIssues.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {helpfulWins.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Okyo helped with</Text>
          {helpfulWins.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.row}>
              <CheckCircle color={colors.green} height={15} strokeWidth={2.3} width={15} />
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pantryStaples.length > 0 ? (
        <View style={styles.chipRow}>
          {pantryStaples.slice(0, 4).map((item, index) => (
            <View key={`${item}-${index}`} style={styles.chip}>
              <Text numberOfLines={1} style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function getSafeList(value: string[] | undefined) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0) : [];
}

function getSafeCookabilityStatus(value: RecipeQualityReport['cookabilityStatus']) {
  if (value === 'cookable' || value === 'needs_quick_fix' || value === 'too_vague_to_trust') {
    return value;
  }
  return 'needs_quick_fix';
}

function getSafeScore(value: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 72;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardWarm,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.card,
    ...shadows.soft,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    ...typography.label,
    color: colors.coralDark,
  },
  title: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  scorePill: {
    alignItems: 'center',
    borderRadius: 999,
    minWidth: 46,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusGood: {
    backgroundColor: colors.greenSoft,
  },
  statusCareful: {
    backgroundColor: colors.cream,
  },
  statusRisky: {
    backgroundColor: colors.dangerSoft,
  },
  scoreText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  summary: {
    ...typography.body,
  },
  block: {
    gap: 8,
  },
  blockTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    backgroundColor: colors.coral,
    borderRadius: 4,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  rowText: {
    color: colors.body,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radius.chip,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: colors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
});
