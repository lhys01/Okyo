import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft } from 'iconoir-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList } from '../navigation/types';
import type { CompletedMeal } from '../state/completedMeals';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Navigation = NativeStackNavigationProp<MainTabParamList>;
type Range = '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
type MacroKey = 'proteinGrams' | 'carbohydratesGrams' | 'fatGrams';
type ProgressPoint = { label: string; savings: number; macro: number };
const RANGES: Range[] = ['7D', '1M', '3M', '6M', '1Y', 'ALL'];
const MACROS: Array<{ key: MacroKey; label: string }> = [
  { key: 'proteinGrams', label: 'Protein' },
  { key: 'carbohydratesGrams', label: 'Carbs' },
  { key: 'fatGrams', label: 'Fat' },
];

export function StatsProgressScreen() {
  const navigation = useNavigation<Navigation>();
  const completedMeals = useOkyoStore((state) => state.completedMeals);
  const recipesById = useOkyoStore((state) => state.recipesById);
  const savedRecipeIds = useOkyoStore((state) => state.savedRecipeIds);
  const [range, setRange] = useState<Range>('1M');
  const [macroKey, setMacroKey] = useState<MacroKey>('proteinGrams');
  const recipes = useMemo(() => Object.values(recipesById).filter((recipe) => !recipe.id.startsWith('mock-') && inRange(recipe.scanCompletedAt, range)), [range, recipesById]);
  const completed = useMemo(() => completedMeals.filter((meal) => inRange(meal.completedAt, range)), [completedMeals, range]);
  const nutrition = completed.filter((meal) => meal.proteinGrams !== undefined || meal.carbohydratesGrams !== undefined || meal.fatGrams !== undefined);
  const savedCount = savedRecipeIds.filter((id) => recipesById[id] && recipes.some((recipe) => recipe.id === id)).length;
  const savings = sum(completed.map((meal) => positive(meal.estimatedSavings)));
  const averageSavings = completed.length ? savings / completed.length : 0;
  const macroTotal = (key: MacroKey) => Math.round(sum(nutrition.map((meal) => positive(meal[key]))));
  const macroAverage = nutrition.length ? Math.round(macroTotal(macroKey) / nutrition.length) : 0;
  const selectedMacro = MACROS.find((item) => item.key === macroKey) ?? MACROS[0];
  const points = useMemo(() => buildProgressPoints(completed, range, macroKey), [completed, macroKey, range]);
  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.headerTitle}>Your progress</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}><Text style={styles.heroValue}>{money(savings)}</Text><Text style={styles.heroLabel}>estimated saved from completed meals</Text><View style={styles.heroStats}><Mini value={String(completed.length)} label="recipes cooked" /><Mini value={String(recipes.length)} label="scans" /><Mini value={String(savedCount)} label="saved" /></View></View>
      <RangeSelector selected={range} onSelect={setRange} />
      <View style={styles.section}><Text style={styles.sectionTitle}>Progress</Text><Text style={styles.sectionSubtitle}>Savings across completed meals · Average protein across completed recipes</Text><MacroSelector selected={macroKey} onSelect={setMacroKey} /><ProgressGraph empty={completed.length === 0 ? 'Cook a few meals with Okyo to see your progress.' : null} macro={selectedMacro.label} points={points} /></View>
      <View style={styles.summaryRow}><SummaryDot color={colors.coral} label="Savings" value={`${money(savings)} from completed meals`} /><SummaryDot color={colors.macros} label={selectedMacro.label} value={nutrition.length ? `${macroAverage}g avg across completed recipes` : 'No nutrition data yet'} /></View>
      <View style={styles.overview}><Mini value={money(averageSavings)} label="average savings / meal" /><Mini value={nutrition.length ? `${macroTotal(macroKey)}g` : '—'} label={`${selectedMacro.label.toLowerCase()} total`} /></View>
      <Text style={styles.disclosure}>Savings and nutrition are estimates. Cooking metrics use recipes marked completed; saved recipes are not counted as meals.</Text>
    </ScrollView>
  </SafeAreaView>;
}

function RangeSelector({ onSelect, selected }: { onSelect: (range: Range) => void; selected: Range }) { return <View accessibilityRole="tablist" style={styles.ranges}>{RANGES.map((range) => <Pressable key={range} accessibilityRole="tab" accessibilityState={{ selected: range === selected }} onPress={() => onSelect(range)} style={[styles.range, range === selected && styles.rangeSelected]}><Text style={[styles.rangeText, range === selected && styles.rangeTextSelected]}>{range}</Text></Pressable>)}</View>; }
function MacroSelector({ onSelect, selected }: { onSelect: (key: MacroKey) => void; selected: MacroKey }) { return <View accessibilityRole="tablist" style={styles.macroSelector}>{MACROS.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.key === selected }} onPress={() => onSelect(item.key)} style={[styles.macroChip, item.key === selected && styles.macroChipSelected]}><Text style={[styles.macroChipText, item.key === selected && styles.macroChipTextSelected]}>{item.label}</Text></Pressable>)}</View>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>; }
function SummaryDot({ color, label, value }: { color: string; label: string; value: string }) { return <View style={styles.summary}><View style={[styles.dot, { backgroundColor: color }]} /><View style={styles.summaryCopy}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View></View>; }

function ProgressGraph({ empty, macro, points }: { empty: string | null; macro: string; points: ProgressPoint[] }) {
  if (empty) return <View style={styles.graph}><Text style={styles.empty}>{empty}</Text></View>;
  const width = 320; const height = 190; const plot = { left: 34, right: 12, top: 18, bottom: 32 };
  const maxSavings = Math.max(...points.map((point) => point.savings), 1); const maxMacro = Math.max(...points.map((point) => point.macro), 1);
  const toX = (index: number) => plot.left + (index / Math.max(points.length - 1, 1)) * (width - plot.left - plot.right);
  const toY = (value: number, max: number) => plot.top + (1 - value / max) * (height - plot.top - plot.bottom);
  const savingsLine = points.map((point, index) => `${toX(index)},${toY(point.savings, maxSavings)}`).join(' ');
  const macroLine = points.map((point, index) => `${toX(index)},${toY(point.macro, maxMacro)}`).join(' ');
  return <View style={styles.graph}><Svg height="190" viewBox="0 0 320 190" width="100%"><SvgText fill={colors.muted} fontSize="10" x="2" y="22">{money(maxSavings)}</SvgText><SvgText fill={colors.muted} fontSize="10" x="2" y="102">$0</SvgText><SvgText fill={colors.muted} fontSize="10" textAnchor="end" x="318" y="22">{Math.round(maxMacro)}g</SvgText><SvgText fill={colors.muted} fontSize="10" textAnchor="end" x="318" y="102">0g</SvgText>{[0, 0.5, 1].map((ratio) => <Line key={ratio} stroke={colors.border} strokeDasharray="3 5" x1={plot.left} x2={width - plot.right} y1={plot.top + ratio * (height - plot.top - plot.bottom)} y2={plot.top + ratio * (height - plot.top - plot.bottom)} />)}<Polyline fill="none" points={savingsLine} stroke={colors.coral} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /><Polyline fill="none" points={macroLine} stroke={colors.macros} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />{points.map((point, index) => <Circle key={`savings-${point.label}-${index}`} cx={toX(index)} cy={toY(point.savings, maxSavings)} fill={colors.surface} r="3.5" stroke={colors.coral} strokeWidth="2" />)}{points.map((point, index) => <Circle key={`macro-${point.label}-${index}`} cx={toX(index)} cy={toY(point.macro, maxMacro)} fill={colors.surface} r="3.5" stroke={colors.macros} strokeWidth="2" />)}<SvgText fill={colors.muted} fontSize="10" textAnchor="start" x={plot.left} y={height - 8}>{points[0]?.label}</SvgText><SvgText fill={colors.muted} fontSize="10" textAnchor="end" x={width - plot.right} y={height - 8}>{points[points.length - 1]?.label}</SvgText></Svg><Text style={styles.graphHint}>Savings · {macro}</Text></View>;
}

function inRange(value: string, range: Range) { if (range === 'ALL') return true; const days = { '7D': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[range]; return new Date(value).getTime() >= Date.now() - days * 86_400_000; }
function buildProgressPoints(completed: CompletedMeal[], range: Range, macroKey: MacroKey): ProgressPoint[] { const count = range === '7D' ? 7 : 6; const span = range === '7D' ? 7 : ({ '1M': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: 180 } as Record<Range, number>)[range]; const unit = span / count; return Array.from({ length: count }, (_, index) => { const end = Date.now() - (count - 1 - index) * unit * 86_400_000; const start = end - unit * 86_400_000; const bucket = completed.filter((meal) => { const time = new Date(meal.completedAt).getTime(); return time > start && time <= end; }); const withNutrition = bucket.filter((meal) => meal[macroKey] !== undefined); return { label: new Date(end).toLocaleDateString(undefined, { month: 'short', day: range === '7D' ? 'numeric' : undefined }), savings: sum(bucket.map((meal) => positive(meal.estimatedSavings))), macro: withNutrition.length ? sum(withNutrition.map((meal) => positive(meal[macroKey]))) / withNutrition.length : 0 }; }); }
function positive(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function money(value: number) { return `$${positive(value).toFixed(value >= 100 ? 0 : 2)}`; }

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, headerTitle: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 }, content: { paddingBottom: 150, paddingHorizontal: spacing.gutter }, hero: { paddingBottom: 20, paddingTop: 12 }, heroValue: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 46, letterSpacing: -1.8 }, heroLabel: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15 }, heroStats: { flexDirection: 'row', gap: 22, marginTop: 20 }, mini: { flex: 1 }, miniValue: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 20 }, miniLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11.5, marginTop: 2 }, ranges: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 4 }, range: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 34 }, rangeSelected: { backgroundColor: colors.ink }, rangeText: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11 }, rangeTextSelected: { color: colors.surface }, section: { marginTop: 30 }, sectionTitle: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 26 }, sectionSubtitle: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, marginTop: 3 }, macroSelector: { flexDirection: 'row', gap: 8, marginTop: 16 }, macroChip: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 }, macroChipSelected: { backgroundColor: colors.macros, borderColor: colors.macros }, macroChipText: { color: colors.body, fontFamily: fontFamilies.bold, fontSize: 11.5 }, macroChipTextSelected: { color: colors.surface }, graph: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, justifyContent: 'center', marginTop: 14, minHeight: 222, padding: 12 }, graphHint: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11, marginTop: 2, textAlign: 'center' }, empty: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, textAlign: 'center' }, summaryRow: { gap: 12, marginTop: 18 }, summary: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 }, summaryCopy: { flex: 1 }, dot: { borderRadius: 5, height: 10, marginTop: 5, width: 10 }, summaryLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 13 }, summaryValue: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 12, marginTop: 2 }, overview: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 20, marginTop: 22, paddingTop: 16 }, disclosure: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11.5, lineHeight: 17, marginTop: 28, textAlign: 'center' },
});
