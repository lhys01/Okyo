import { PiggyBank, StatsUpSquare } from 'iconoir-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { HomeMetric, HomeMetricKind } from '../../state/homeMetrics';
import { colors, radius, shadows, typography } from '../../theme/okyoTheme';

const metricArtwork: Partial<Record<HomeMetricKind, number>> = {
  savings: require('../../../assets/food/home-savings-transparent.png'),
};

// These are bundled app-owned illustrations supplied for the macro card. Keep
// them as static requires so they remain available independently of user data.
const macroArtwork = {
  calories: require('../../../assets/food/macros/calories-kcal-new.png'),
  carbs: require('../../../assets/food/macros/carbs-bread.png'),
  fat: require('../../../assets/food/macros/fat-droplet.png'),
  protein: require('../../../assets/food/macros/protein-dumbbell.png'),
} as const;

const accents: Record<HomeMetricKind, string> = {
  health: colors.health,
  macros: colors.ink,
  savings: colors.savings,
};

export function MetricCard({ futureDay, height, metric, width }: { futureDay?: boolean; height: number; metric: HomeMetric; width: number }) {
  const accent = accents[metric.kind];
  const futureMessage = futureDay
    ? 'Cook a meal to see this.\nYour totals will appear here.'
    : null;
  const accessibilityLabel = futureMessage
    ? `${metric.label}. Nothing to see here yet. Let's see what you can do.`
    : metric.accessibilityLabel;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ width }}>
      <View
        style={[styles.card, { height }]}
      >
        <Text style={styles.label}>{metric.label}</Text>
        <View style={styles.primaryRow}>
          <View style={styles.primaryCopy}>
            {futureMessage ? <Text maxFontSizeMultiplier={1.25} style={styles.futureMessage}>{futureMessage}</Text> : <>
              <Text maxFontSizeMultiplier={1.2} style={[styles.value, metric.kind === 'macros' || metric.available ? { color: accent } : null]}>{metric.value}</Text>
              <Text maxFontSizeMultiplier={1.5} style={styles.caption}>{metric.caption}</Text>
            </>}
          </View>
          <MetricVisual accent={accent} kind={metric.kind} progress={metric.progress} />
        </View>
      </View>
      {!futureMessage ? <View style={styles.stats}>
        {metric.stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <View style={styles.statCopy}>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.statValue}>{stat.value}</Text>
              <Text maxFontSizeMultiplier={1.5} numberOfLines={2} style={styles.statLabel}>{stat.label}</Text>
            </View>
          </View>
        ))}
      </View> : null}
    </View>
  );
}

function MetricVisual({ accent, kind, progress }: { accent: string; kind: HomeMetricKind; progress: number | null }) {
  // A ring only appears where `progress` is a real ratio (Health). Savings and
  // Macros have no target to progress toward, so they get a plain icon rather
  // than a chart — a chart there would imply a trend the data cannot support.
  if (progress !== null) return <ProgressRing accent={accent} progress={progress} />;
  return <MetricIcon accent={accent} kind={kind} />;
}

function MetricIcon({ accent, kind }: { accent: string; kind: HomeMetricKind }) {
  if (kind === 'macros') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.iconVisual}>
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={macroArtwork.calories} style={styles.macroPrimaryArtwork} />
      </View>
    );
  }
  const Icon = kind === 'savings' ? PiggyBank : StatsUpSquare;
  const artwork = metricArtwork[kind];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.iconVisual}
    >
      {artwork ? <Image accessibilityIgnoresInvertColors resizeMode="contain" source={artwork} style={styles.metricArtwork} /> : <Icon color={accent} height={34} width={34} />}
    </View>
  );
}

function ProgressRing({ accent, progress }: { accent: string; progress: number }) {
  const radiusValue = 40;
  const circumference = 2 * Math.PI * radiusValue;
  const safeProgress = Math.max(0, Math.min(1, progress));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.ring}>
      <Svg height={96} viewBox="0 0 96 96" width={96}>
        <Circle cx="48" cy="48" fill="none" r={radiusValue} stroke={colors.border} strokeWidth="8" />
        <Circle cx="48" cy="48" fill="none" origin="48, 48" r={radiusValue} rotation="-90" stroke={accent} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - safeProgress)} strokeLinecap="round" strokeWidth="8" x="0" y="0" />
      </Svg>
      <View style={[styles.ringCore, { backgroundColor: `${accent}18` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { ...typography.caption, color: colors.body, marginTop: 3 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, ...shadows.card },
  // The bundled illustrations include transparent breathing room, so give
  // their containers a little more room while keeping the same card layout.
  iconVisual: { alignItems: 'center', height: 136, justifyContent: 'center', width: 136 },
  macroPrimaryArtwork: { height: 148, width: 148 },
  metricArtwork: { height: 136, width: 136 },
  futureMessage: { color: colors.ink, fontFamily: typography.heading.fontFamily, fontSize: 14, fontWeight: '700', lineHeight: 19, maxWidth: 190 },
  label: { ...typography.label },
  primaryCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  primaryRow: { alignItems: 'center', flex: 1, flexDirection: 'row', marginTop: 2 },
  ring: { alignItems: 'center', height: 104, justifyContent: 'center', width: 104 },
  ringCore: { borderRadius: 14, height: 26, position: 'absolute', width: 26 },
  stat: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: StyleSheet.hairlineWidth, flex: 1, minHeight: 70, minWidth: 0, padding: 10, ...shadows.card },
  statCopy: { flex: 1, minWidth: 0 },
  statLabel: { ...typography.caption, fontSize: 11, marginTop: 3 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statValue: { ...typography.numericStat, fontSize: 18 },
  // The number is the point of the card, so it outweighs the surface around it.
  value: { ...typography.numericLarge, fontSize: 40, lineHeight: 44 },
});
