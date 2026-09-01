import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { branchPalettes, branchShadow, branchSurfaces, type BranchId } from './branchTheme';

// Small magnitudes still need to be visible next to a yearly total.
const MIN_BAR_HEIGHT = 10;
// Horizontal bars scale rather than resize, so the floor is a fraction.
const MIN_BAR_FRACTION = 0.04;

export function formatDollars(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString()}`;
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;
const PROJECTION_HEIGHT = 190;
const MONTH_REVEAL_STEP_MS = 55;

export type SpendHorizon = Readonly<{ id: string; label: string; cents: number }>;

/**
 * A fixed 26pt reads clearly for the amounts this branch actually produces
 * ($10s-$1,000s). Rather than let the OS auto-shrink text (which collapsed
 * to near-illegible sizes when the card's height was ambiguous), larger
 * formatted amounts step down through a small set of deliberate sizes so the
 * number always stays the dominant, single-line element in its card.
 */
function statValueFontSize(formatted: string): number {
  if (formatted.length <= 4) return 26;
  if (formatted.length <= 6) return 22;
  if (formatted.length <= 8) return 18;
  return 15;
}

/**
 * Personalised eating-out projection. The three horizons are read as their own
 * stat cards rather than as bars on one axis, because a week next to a year on
 * a shared scale is unreadable. The year is then shown as twelve months
 * accumulating, so each month is legible on its own.
 */
export function SpendProjection({
  branch,
  horizons,
  annualCents,
  caption,
}: {
  branch: BranchId;
  horizons: readonly SpendHorizon[];
  annualCents: number;
  caption?: string;
}) {
  const palette = branchPalettes[branch];
  const monthlyCents = Math.round(annualCents / 12);
  return (
    <View style={styles.projection}>
      <View style={styles.horizonRow}>
        {horizons.map((horizon) => (
          <View
            accessibilityLabel={`${horizon.label}: ${formatDollars(horizon.cents)}`}
            key={horizon.id}
            style={[styles.horizonCard, branchShadow]}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.horizonLabel}>{horizon.label}</Text>
            <Text
              adjustsFontSizeToFit
              allowFontScaling={false}
              minimumFontScale={0.7}
              numberOfLines={1}
              style={[
                styles.horizonValue,
                { color: palette.accent, fontSize: statValueFontSize(formatDollars(horizon.cents)) },
              ]}
            >
              {formatDollars(horizon.cents)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, branchShadow]}>
        <View style={styles.projectionHeader}>
          <Text maxFontSizeMultiplier={1.2} style={styles.projectionTitle}>Eating out, month by month</Text>
          <Text maxFontSizeMultiplier={1.2} style={[styles.projectionTotal, { color: palette.accent }]}>
            {formatDollars(annualCents)}
          </Text>
        </View>
        <View
          accessibilityLabel={`Twelve months of eating out, about ${formatDollars(monthlyCents)} each month, reaching ${formatDollars(annualCents)} across the year`}
          accessibilityRole="image"
          style={styles.months}
        >
          {MONTH_INITIALS.map((initial, index) => (
            <View key={`${initial}-${index}`} style={styles.month}>
              <View style={styles.monthTrack}>
                <RisingMonth index={index} tint={palette.accent} total={MONTH_INITIALS.length} />
              </View>
              <Text accessibilityElementsHidden allowFontScaling={false} style={styles.monthLabel}>{initial}</Text>
            </View>
          ))}
        </View>
        {caption ? <Text maxFontSizeMultiplier={1.3} style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

/**
 * One month of the accumulation. Height is the running share of the year, so
 * the twelve columns climb steadily instead of one column dwarfing the rest.
 * Reduce Motion draws the finished shape immediately, with no stagger.
 */
function RisingMonth({ index, tint, total }: { index: number; tint: string; total: number }) {
  const reduceMotion = useReduceMotion();
  const share = (index + 1) / total;
  const grown = useSharedValue<number>(0);

  useEffect(() => {
    grown.value = withDelay(
      reduceMotion ? 0 : index * MONTH_REVEAL_STEP_MS,
      withTiming(1, { duration: reduceMotion ? 0 : motionTokens.enter.durationMs }),
    );
  }, [grown, index, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(MIN_BAR_HEIGHT, grown.value * share * PROJECTION_HEIGHT),
    opacity: 0.55 + share * 0.45,
  }));

  return <Animated.View style={[styles.monthBar, { backgroundColor: tint }, animatedStyle]} />;
}

export type CompareRow = Readonly<{ id: string; label: string; cents: number; tint: string }>;

/**
 * Side-by-side comparison of two costs for the same meals. Used for the savings
 * payoff, where the difference between the rows is the whole point.
 */
export function CompareBars({
  rows,
  footnote,
}: {
  rows: readonly CompareRow[];
  footnote?: string;
}) {
  const max = Math.max(...rows.map((row) => row.cents), 1);
  return (
    <View style={[styles.card, branchShadow]}>
      <View style={styles.compareRows}>
        {rows.map((row) => (
          <View key={row.id} style={styles.compareRow}>
            <View style={styles.compareHeader}>
              <Text maxFontSizeMultiplier={1.2} style={styles.compareLabel}>{row.label}</Text>
              <Text allowFontScaling={false} style={[styles.compareValue, { color: row.tint }]}>{formatDollars(row.cents)}</Text>
            </View>
            <View style={styles.compareTrack}>
              <GrowingBar accessibilityLabel={`${row.label}: ${formatDollars(row.cents)}`} fraction={row.cents / max} tint={row.tint} />
            </View>
          </View>
        ))}
      </View>
      {footnote ? <Text maxFontSizeMultiplier={1.3} style={styles.caption}>{footnote}</Text> : null}
    </View>
  );
}

/** A single result figure with its own label, used beneath a chart. */
export function StatTile({ branch, label, value, note }: { branch: BranchId; label: string; value: string; note?: string }) {
  const palette = branchPalettes[branch];
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={[styles.statTile, { backgroundColor: palette.accentSoft }]}>
      <Text maxFontSizeMultiplier={1.2} style={styles.statLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        allowFontScaling={false}
        minimumFontScale={0.6}
        numberOfLines={1}
        style={[styles.statValue, { color: palette.accent }]}
      >
        {value}
      </Text>
      {note ? <Text maxFontSizeMultiplier={1.2} style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

/**
 * Horizontal bar that scales from its left edge to its share of the largest
 * value in the set. Under Reduce Motion it snaps straight to its final size —
 * the comparison is fully readable without any animation.
 */
function GrowingBar({ accessibilityLabel, fraction, tint }: { accessibilityLabel: string; fraction: number; tint: string }) {
  const reduceMotion = useReduceMotion();
  const target = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const grown = useSharedValue<number>(0);

  useEffect(() => {
    grown.value = withTiming(target, { duration: reduceMotion ? 0 : motionTokens.graphDraw.durationMs });
  }, [grown, reduceMotion, target]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(MIN_BAR_FRACTION, grown.value) }] }));

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[styles.barHorizontal, { backgroundColor: tint }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 18, paddingHorizontal: 18, paddingVertical: 24,
  },
  barHorizontal: { borderRadius: 999, height: 16, transformOrigin: 'left', width: '100%' },

  projection: { gap: 16 },
  horizonRow: { flexDirection: 'row', gap: 10 },
  horizonCard: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.tileRadius,
    borderWidth: 1, flex: 1, gap: 8, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 20,
  },
  horizonLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  horizonValue: { fontFamily: fontFamilies.extraBold, fontSize: 26, lineHeight: 30 },
  projectionHeader: { alignItems: 'baseline', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  projectionTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15 },
  projectionTotal: { fontFamily: fontFamilies.extraBold, fontSize: 20, lineHeight: 24 },
  months: { alignItems: 'flex-end', flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  month: { alignItems: 'center', flex: 1, gap: 6 },
  monthTrack: { height: PROJECTION_HEIGHT, justifyContent: 'flex-end', width: '100%' },
  monthBar: { borderRadius: 6, width: '100%' },
  monthLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 10 },

  compareRows: { gap: 18 },
  compareRow: { gap: 8 },
  compareHeader: { alignItems: 'baseline', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  compareLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15 },
  compareValue: { fontFamily: fontFamilies.extraBold, fontSize: 22, lineHeight: 26 },
  compareTrack: { backgroundColor: colors.canvasSunk, borderRadius: 999, height: 16, overflow: 'hidden', width: '100%' },

  caption: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  statTile: { borderRadius: branchSurfaces.tileRadius, flex: 1, gap: 2, minWidth: 96, paddingHorizontal: 14, paddingVertical: 14 },
  statLabel: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 12 },
  statValue: { fontFamily: fontFamilies.extraBold, fontSize: 24, lineHeight: 28 },
  statNote: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 15 },
});
