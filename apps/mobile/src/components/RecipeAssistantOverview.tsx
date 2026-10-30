import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Recipe } from '../mocks';
import { recipeShadows } from '../theme/recipeTheme';
import { getRecipeTiming } from '../utils/recipeIntegrity';
import { calculateRecipePrices } from '../utils/recipePricing';
import { colors, fontFamilies } from './OkyoUI';
import { FitText } from './FitText';

const formatMinutes = (minutes: number) => minutes >= 60
  ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
  : `${minutes} min`;

export function RecipeQuickFacts({ recipe }: { recipe: Recipe }) {
  const timing = getRecipeTiming(recipe);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const readyAt = useMemo(
    () => new Date(now + timing.totalMinutes * 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    [now, timing.totalMinutes],
  );

  const facts = [
    [recipe.difficulty, 'Difficulty'],
    [formatMinutes(timing.handsOnMinutes), 'Active'],
    [formatMinutes(timing.totalMinutes), 'Total'],
    [readyAt, 'Ready'],
  ];
  return (
    <View accessibilityLabel="Recipe quick facts" style={styles.factStrip}>
      {facts.map(([value, label], index) => (
        <View key={label} style={[styles.fact, index > 0 ? styles.factWithDivider : null]}>
          <FitText minimumFontScale={0.62} style={styles.factValue}>{value}</FitText>
          <FitText minimumFontScale={0.76} style={styles.factLabel}>{label}</FitText>
        </View>
      ))}
    </View>
  );
}

export function RecipeCostSummary({
  recipe,
  restaurantPrice,
  homemadePrice,
  servings = recipe.servings,
}: {
  recipe: Recipe;
  restaurantPrice?: number;
  homemadePrice?: number;
  servings?: number;
}) {
  const { makeAtHome, eatingOut } = calculateRecipePrices({ recipe, restaurantPrice, homemadePrice, servings });

  if (makeAtHome === null && eatingOut === null) return null;

  return (
    <View style={styles.costSection}>
      <Text style={styles.costEyebrow}>Pricing</Text>
      <View style={styles.costComparisonCard}>
        <PriceColumn label="Make at home" value={makeAtHome === null ? '—' : `$${makeAtHome.toFixed(2)}`} />
        <View style={styles.costDivider} />
        <PriceColumn label="Eating out" value={eatingOut === null ? '—' : `~$${eatingOut.toFixed(2)}`} />
      </View>
    </View>
  );
}

function PriceColumn({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.costColumn}>
      <FitText minimumFontScale={0.78} style={styles.costLabel}>{label}</FitText>
      <FitText minimumFontScale={0.68} style={styles.costValue}>{value}</FitText>
    </View>
  );
}

export function RecipeSubstitutions({ substitutions }: { substitutions: string[] | undefined }) {
  const safe = (Array.isArray(substitutions) ? substitutions : []).filter((item) => item.trim()).slice(0, 3);
  const [expanded, setExpanded] = useState(false);
  if (safe.length === 0) return null;
  const visible = expanded ? safe : safe.slice(0, 1);
  return (
    <View style={styles.substitutionSection}>
      <View style={styles.substitutionHeader}>
        <Text style={styles.sectionTitle}>Smart substitutions</Text>
        {safe.length > 1 ? (
          <Pressable accessibilityRole="button" hitSlop={7} onPress={() => setExpanded((value) => !value)}>
            <Text style={styles.moreText}>{expanded ? 'Show less' : `${safe.length - 1} more`}</Text>
          </Pressable>
        ) : null}
      </View>
      {visible.map((item) => <Text key={item} style={styles.substitutionText}>• {item}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  factStrip: { backgroundColor: '#FFF9F7', borderColor: '#F0E4DC', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginTop: 12, paddingVertical: 10 },
  fact: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  factWithDivider: { borderLeftColor: '#F0E4DC', borderLeftWidth: 1 },
  // Every fact owns one fixed-width quarter of the card. FitText keeps long
  // values such as a verbose difficulty or duration on one line without
  // changing the card's height or pushing into an adjacent fact.
  factValue: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 16, fontWeight: '800', lineHeight: 20, textAlign: 'center' },
  factLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 13, fontWeight: '700', lineHeight: 16, marginTop: 4, textAlign: 'center' },
  costSection: { marginTop: 16 },
  costEyebrow: { color: '#82776E', fontFamily: fontFamilies.bold, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8, textTransform: 'uppercase' },
  costComparisonCard: { alignItems: 'stretch', backgroundColor: '#FFFDFC', borderRadius: 18, flexDirection: 'row', minWidth: 0, overflow: 'hidden', paddingVertical: 12, ...recipeShadows.card },
  costColumn: { flex: 1, minWidth: 0, paddingHorizontal: 14 },
  costDivider: { backgroundColor: '#F0E4DC', marginVertical: 2, width: StyleSheet.hairlineWidth },
  costValue: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 19, fontWeight: '800', marginTop: 4 },
  costLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11.5, fontWeight: '700' },
  substitutionSection: { backgroundColor: '#FAF7FF', borderLeftColor: '#DCCBF0', borderLeftWidth: 3, borderRadius: 12, marginTop: 18, paddingHorizontal: 12, paddingVertical: 11 },
  substitutionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 15, fontWeight: '800' },
  substitutionText: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: 7 },
  moreText: { color: '#7451A2', fontFamily: fontFamilies.bold, fontSize: 12, fontWeight: '700' },
});
