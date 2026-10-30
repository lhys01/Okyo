import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as NativeAnimated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { BranchIcon } from './BranchControls';
import { branchShadow, branchSurfaces } from './branchTheme';

const CORAL = colors.coral;
const GREEN = colors.savings;
const THUMB_SIZE = 28;
const TRACK_INSET = THUMB_SIZE / 2;

export type SavingsTileOption<T extends string> = Readonly<{
  id: T;
  label: string;
  icon: BranchIcon;
  imageSource?: number;
  quiet?: boolean;
}>;

export function SavingsOptionGrid<T extends string>({
  options,
  selected,
  multi = false,
  onSelect,
  accessibilityHint,
  layout = 'stacked',
  compact = false,
}: {
  options: readonly SavingsTileOption<T>[];
  selected: readonly T[];
  multi?: boolean;
  onSelect: (id: T) => void;
  accessibilityHint?: string;
  layout?: 'stacked' | 'priorityGrid';
  compact?: boolean;
}) {
  return (
    <View style={[styles.tileGrid, compact && styles.tileGridCompact, layout === 'priorityGrid' && styles.tileGridTwoColumn]}>
      {options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <Pressable
            accessibilityHint={accessibilityHint}
            accessibilityLabel={option.label}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: active, selected: active }}
            key={option.id}
            onPress={() => {
              onSelect(option.id);
              void Haptics.selectionAsync();
            }}
            style={({ pressed }) => [
              styles.tile,
              layout === 'priorityGrid' && styles.tileGridItem,
              compact && layout === 'priorityGrid' && styles.tileGridItemCompact,
              active && styles.tileActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.tileIcon, layout === 'priorityGrid' && styles.tileIconGrid, compact && styles.tileIconCompact]}>
              {option.imageSource ? (
                <Image accessibilityIgnoresInvertColors contentFit="contain" source={option.imageSource} style={styles.tileImage} />
              ) : (
                <option.icon color={active ? colors.coralDark : colors.savings} height={38} strokeWidth={2} width={38} />
              )}
            </View>
            <Text maxFontSizeMultiplier={1.3} numberOfLines={layout === 'priorityGrid' ? 2 : 1} style={[styles.tileLabel, layout === 'priorityGrid' && styles.tileLabelGrid, compact && styles.tileLabelCompact, active && styles.tileLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SavingsValueSlider({
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  minLabel,
  maxLabel,
  onChange,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  minLabel: string;
  maxLabel: string;
  onChange: (value: number) => void;
  testID: string;
}) {
  const [width, setWidth] = useState(0);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const range = Math.max(step, max - min);
  const ratio = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / range));
  const usableWidth = Math.max(0, width - TRACK_INSET * 2);
  const centerX = TRACK_INSET + ratio * usableWidth;

  const setFromX = useCallback((x: number) => {
    if (!usableWidth || max === min) return;
    const nextRatio = Math.max(0, Math.min(1, (x - TRACK_INSET) / usableWidth));
    const stepped = Math.round((min + nextRatio * (max - min)) / step) * step;
    const next = Math.max(min, Math.min(max, stepped));
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChangeRef.current(next);
      void Haptics.selectionAsync();
    }
  }, [max, min, step, usableWidth]);
  const dragStartX = useRef(0);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      dragStartX.current = event.nativeEvent.locationX;
      setFromX(dragStartX.current);
    },
    // Move relative to the initial touch; locationX can stay attached to a child target.
    onPanResponderMove: (_event, gesture) => setFromX(dragStartX.current + gesture.dx),
    onPanResponderTerminationRequest: () => false,
  }), [setFromX]);
  const adjust = (direction: 1 | -1) => {
    const next = Math.max(min, Math.min(max, value + direction * step));
    if (next !== value) {
      onChange(next);
      void Haptics.selectionAsync();
    }
  };
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.sliderSection}>
      <View style={styles.sliderTopline}>
        <Text maxFontSizeMultiplier={1.25} style={styles.sliderLabel}>{label}</Text>
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.2} style={styles.sliderValue}>{valueLabel}</Text>
      </View>
      <View
        accessible
        accessibilityActions={[{ name: 'increment', label: `Increase ${label}` }, { name: 'decrement', label: `Decrease ${label}` }]}
        accessibilityLabel={`${label}, ${valueLabel}`}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value, text: valueLabel }}
        onAccessibilityAction={(event) => adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        onLayout={onLayout}
        style={styles.sliderTouch}
        testID={testID}
        {...panResponder.panHandlers}
      >
        <View style={[styles.sliderTrack, { left: TRACK_INSET, right: TRACK_INSET }]}>
          <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
        </View>
        <View pointerEvents="none" style={[styles.sliderThumb, { left: centerX - THUMB_SIZE / 2 }]}>
          <View style={styles.sliderThumbCenter} />
        </View>
      </View>
      <View style={styles.sliderRange}>
        <Text maxFontSizeMultiplier={1.2} style={styles.sliderRangeText}>{minLabel}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.sliderRangeText}>{maxLabel}</Text>
      </View>
    </View>
  );
}

export function WeeklySnapshotSummary({ eatingOut, replacement, costCents }: { eatingOut: number; replacement: number; costCents: number }) {
  const weekly = eatingOut * costCents;
  return (
    <View accessibilityLabel={`${eatingOut} meals out, ${replacement} meals at home, about ${formatMoney(weekly)} spent eating out each week`} style={styles.snapshotSummary}>
      <Text style={styles.snapshotSummaryLabel}>Current eating-out estimate</Text>
      <Text accessibilityLiveRegion="polite" allowFontScaling={false} style={styles.snapshotSummaryValue}>{formatMoney(weekly)} / week</Text>
      <Text style={styles.snapshotSummaryBody}>{replacement} of {eatingOut} {eatingOut === 1 ? 'meal' : 'meals'} could move home</Text>
    </View>
  );
}

export type SavingsProjection = Readonly<{
  currentWeeklyCostCents: number;
  projectedWeeklyCostCents: number;
  weeklyPotentialSavingsCents: number;
  monthlyPotentialSavingsCents: number;
  annualPotentialSavingsCents: number;
  replacements: number;
}>;

export function SavingsProjectionChart({ projection }: { projection: SavingsProjection }) {
  const reduceMotion = useReduceMotion();
  const entrance = useRef(new NativeAnimated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    NativeAnimated.timing(entrance, { duration: 420, toValue: 1, useNativeDriver: true }).start();
  }, [entrance, reduceMotion]);
  const width = 350;
  const height = 196;
  const left = 16;
  const right = 278;
  const top = 18;
  const bottom = 154;
  const maxAnnual = Math.max(1, projection.currentWeeklyCostCents * 52);
  const currentAnnual = projection.currentWeeklyCostCents * 52;
  const projectedAnnual = projection.projectedWeeklyCostCents * 52;
  const points = Array.from({ length: 13 }, (_, month) => ({
    x: left + ((right - left) * month) / 12,
    currentY: bottom - ((bottom - top) * currentAnnual * curveProgress(month / 12)) / maxAnnual,
    projectedY: bottom - ((bottom - top) * projectedAnnual * curveProgress(month / 12)) / maxAnnual,
  }));
  const currentPath = smoothPath(points, 'currentY');
  const projectedPath = smoothPath(points, 'projectedY');
  const currentAreaPath = `M ${points[0].x} ${bottom} ${currentPath.slice(1)} L ${points[points.length - 1].x} ${bottom} Z`;
  const projectedAreaPath = `M ${points[0].x} ${bottom} ${projectedPath.slice(1)} L ${points[points.length - 1].x} ${bottom} Z`;
  const accessibility = `Twelve month estimate. Current eating-out pattern reaches ${formatMoney(currentAnnual)}. With ${projection.replacements} meals at home each week, projected cost reaches ${formatMoney(projectedAnnual)}. Potential savings ${formatMoney(projection.annualPotentialSavingsCents)}.`;
  const axisLabels = [1, 0.66, 0.33, 0].map((ratio) => formatAxisMoney(currentAnnual * ratio));
  return (
    <NativeAnimated.View accessibilityLabel={accessibility} accessibilityRole="image" style={[styles.chartCard, branchShadow, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <View style={styles.chartLegend}>
        <Legend color={CORAL} label="Current eating-out pattern" />
        <Legend color={GREEN} label={`With ${projection.replacements} at home`} />
      </View>
      <View style={styles.chartBody}>
        <View style={styles.chartYAxis}>{axisLabels.map((label) => <Text key={label} style={styles.chartAxisText}>{label}</Text>)}</View>
        <View style={styles.chartPlot}>
          <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
            <Defs>
              <LinearGradient id="currentArea" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={CORAL} stopOpacity={0.2} />
                <Stop offset="1" stopColor={CORAL} stopOpacity={0.03} />
              </LinearGradient>
              <LinearGradient id="projectedArea" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={GREEN} stopOpacity={0.24} />
                <Stop offset="1" stopColor={GREEN} stopOpacity={0.08} />
              </LinearGradient>
            </Defs>
            {[0, 1, 2, 3].map((line) => <Line key={line} stroke={colors.savingsChartGrid} strokeDasharray="3 5" strokeWidth={1} x1={left} x2={right} y1={top + ((bottom - top) * line) / 3} y2={top + ((bottom - top) * line) / 3} />)}
            <Path d={currentAreaPath} fill="url(#currentArea)" />
            <Path d={projectedAreaPath} fill="url(#projectedArea)" />
            <Path d={currentPath} fill="none" stroke={CORAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} />
            <Path d={projectedPath} fill="none" stroke={GREEN} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} />
            <Circle cx={right} cy={points[12].currentY} fill={CORAL} r={5} />
            <Circle cx={right} cy={points[12].projectedY} fill={GREEN} r={5} />
            <SvgText fill={GREEN} fontSize="11" fontWeight="700" textAnchor="start" x={right + 12} y={points[12].projectedY - 5}>{formatMoney(projection.weeklyPotentialSavingsCents)} saved</SvgText>
            <SvgText fill={GREEN} fontSize="10" fontWeight="700" textAnchor="start" x={right + 12} y={points[12].projectedY + 9}>per week</SvgText>
          </Svg>
          <View style={styles.chartAxis}><Text style={styles.chartAxisText}>Now</Text><Text style={styles.chartAxisText}>12 months</Text></View>
        </View>
      </View>
    </NativeAnimated.View>
  );
}

/** Keep the canonical endpoints while giving the illustration the gentle curve
 * used by the Savings reference instead of a button-like straight polygon. */
function curveProgress(progress: number): number {
  return progress * (0.82 + progress * 0.18);
}

function smoothPath(points: readonly { x: number; currentY: number; projectedY: number }[], key: 'currentY' | 'projectedY'): string {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0][key]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const c1x = current.x + (next.x - previous.x) / 6;
    const c1y = current[key] + (next[key] - previous[key]) / 6;
    const c2x = next.x - (afterNext.x - current.x) / 6;
    const c2y = next[key] - (afterNext[key] - current[key]) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${next.x} ${next[key]}`;
  }
  return path;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

export function PotentialSavingsStats({ projection, largeText = false }: { projection: SavingsProjection; largeText?: boolean }) {
  return (
    <View style={[styles.statsRow, largeText && styles.statsColumn]}>
      <SavingsStat largeText={largeText} label="Weekly" cents={projection.weeklyPotentialSavingsCents} />
      <SavingsStat largeText={largeText} label="Monthly" cents={projection.monthlyPotentialSavingsCents} />
      <SavingsStat largeText={largeText} label="Yearly" cents={projection.annualPotentialSavingsCents} />
    </View>
  );
}

function SavingsStat({ label, cents, largeText }: { label: string; cents: number; largeText: boolean }) {
  return (
    <View accessibilityLabel={`${label} potential savings ${formatMoney(cents)}`} style={[styles.stat, largeText && styles.statFullWidth]}>
      <Text maxFontSizeMultiplier={largeText ? 2 : 1.2} style={styles.statLabel}>{label}</Text>
      <AnimatedMoney cents={cents} />
    </View>
  );
}

function AnimatedMoney({ cents }: { cents: number }) {
  const reduceMotion = useReduceMotion();
  const animated = useRef(new NativeAnimated.Value(cents)).current;
  const [displayed, setDisplayed] = useState(cents);
  useEffect(() => {
    if (reduceMotion) {
      animated.setValue(cents);
      setDisplayed(cents);
      return;
    }
    const listener = animated.addListener(({ value }) => setDisplayed(Math.round(value)));
    NativeAnimated.timing(animated, { duration: 480, toValue: cents, useNativeDriver: false }).start();
    return () => animated.removeListener(listener);
  }, [animated, cents, reduceMotion]);
  return <Text accessibilityLiveRegion="polite" adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.statValue}>{formatMoney(displayed)}</Text>;
}

export function HouseholdSegment<T extends string | number>({ options, selected, onSelect }: { options: readonly { id: T; label: string }[]; selected: T | null; onSelect: (id: T) => void }) {
  return (
    <View accessibilityLabel="Cooking for" accessibilityRole="radiogroup" style={styles.segment}>
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <Pressable
            accessibilityLabel={`Cooking for ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, selected: active }}
            key={option.id}
            onPress={() => { onSelect(option.id); void Haptics.selectionAsync(); }}
            style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.3} style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function formatMoney(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: dollars % 1 === 0 ? 0 : 2 }).format(dollars);
}

function formatAxisMoney(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars % 1000 === 0 ? 0 : 1)}k`;
  return `$${dollars}`;
}

const styles = StyleSheet.create({
  tileGrid: { gap: 8, width: '100%' },
  tileGridCompact: { gap: 6 },
  tileGridTwoColumn: { alignContent: 'stretch', flexDirection: 'row', flexGrow: 1, flexWrap: 'wrap' },
  tile: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', gap: 14, minHeight: 68, paddingHorizontal: 18, paddingVertical: 11, ...branchShadow },
  tileGridItem: { flexBasis: '48%', flexDirection: 'column', flexGrow: 1, gap: 5, justifyContent: 'center', minHeight: 110, paddingHorizontal: 10, paddingVertical: 12 },
  tileGridItemCompact: { gap: 2, minHeight: 80, paddingVertical: 5 },
  tileActive: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  tileIcon: { alignItems: 'center', flexShrink: 0, height: 44, justifyContent: 'center', width: 44 },
  tileIconGrid: { height: 40, width: 44 },
  tileIconCompact: { height: 32 },
  tileImage: { height: 42, width: 42 },
  tileLabel: { color: branchSurfaces.ink, flex: 1, fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 21 },
  tileLabelGrid: { flex: 0, fontSize: 14, lineHeight: 19, minHeight: 38, textAlign: 'center' },
  tileLabelCompact: { fontSize: 13, lineHeight: 17, minHeight: 34 },
  tileLabelActive: { color: colors.coralDark },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },

  sliderSection: { gap: 3 },
  sliderTopline: { alignItems: 'baseline', columnGap: 12, flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { color: branchSurfaces.ink, flex: 1, fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 21 },
  sliderValue: { color: colors.coralDark, fontFamily: fontFamilies.extraBold, fontSize: 20, lineHeight: 25, textAlign: 'right' },
  sliderTouch: { height: 50, justifyContent: 'center', position: 'relative' },
  sliderTrack: { backgroundColor: colors.savingsSliderTrack, borderRadius: 99, height: 7, overflow: 'hidden', position: 'absolute' },
  sliderFill: { backgroundColor: colors.coral, borderRadius: 99, height: '100%' },
  sliderThumb: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: THUMB_SIZE / 2, borderWidth: 2, height: THUMB_SIZE, justifyContent: 'center', position: 'absolute', shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, width: THUMB_SIZE },
  sliderThumbCenter: { backgroundColor: colors.coral, borderRadius: 8, height: 16, width: 16 },
  sliderRange: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: TRACK_INSET },
  sliderRangeText: { color: branchSurfaces.muted, fontFamily: fontFamilies.medium, fontSize: 11, lineHeight: 15 },
  snapshotSummary: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 2, marginTop: 2, paddingHorizontal: 16, paddingVertical: 13 },
  snapshotSummaryLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12, lineHeight: 17 },
  snapshotSummaryValue: { color: colors.savings, fontFamily: fontFamilies.extraBold, fontSize: 27, letterSpacing: -0.5, lineHeight: 33 },
  snapshotSummaryBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  chartCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, paddingHorizontal: 12, paddingTop: 14 },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 5 },
  chartBody: { flexDirection: 'row', marginTop: 4 },
  chartYAxis: { justifyContent: 'space-between', paddingBottom: 25, paddingTop: 9, width: 34 },
  chartPlot: { flex: 1, minWidth: 0 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 11, lineHeight: 15 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -19, paddingBottom: 12, paddingHorizontal: 6 },
  chartAxisText: { color: branchSurfaces.muted, fontFamily: fontFamilies.medium, fontSize: 10, lineHeight: 14 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statsColumn: { flexDirection: 'column' },
  stat: { backgroundColor: colors.savingsSoft, borderRadius: 18, flex: 1, gap: 3, minWidth: 0, paddingHorizontal: 10, paddingVertical: 12 },
  statFullWidth: { alignSelf: 'stretch', flex: 0 },
  statLabel: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 11, lineHeight: 15 },
  statValue: { color: colors.savings, fontFamily: fontFamilies.extraBold, fontSize: 20, letterSpacing: -0.4, lineHeight: 25, width: '100%' },

  segment: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 3 },
  segmentButtonActive: { backgroundColor: colors.coral, shadowColor: colors.coralDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
  segmentText: { color: branchSurfaces.body, fontFamily: fontFamilies.bold, fontSize: 13 },
  segmentTextActive: { color: colors.surface },
});
