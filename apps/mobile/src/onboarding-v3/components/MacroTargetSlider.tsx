import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';

export function MacroTargetSlider({ label, value, min, max, step, unit, onChange, testID }: {
  label: string; value: number | null; min: number; max: number; step: number; unit: string;
  onChange: (value: number) => void; testID: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef<number | null>(value);
  valueRef.current = value;
  const setFromX = (x: number) => {
    if (!trackWidth) return;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const next = Math.round((min + ratio * (max - min)) / step) * step;
    const clamped = Math.max(min, Math.min(max, next));
    if (clamped !== valueRef.current) {
      valueRef.current = clamped;
      onChange(clamped);
      void Haptics.selectionAsync();
    }
  };
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
  }), [trackWidth, min, max, step]);
  const progress = value === null ? 0 : (value - min) / (max - min);
  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);
  const adjust = (direction: 1 | -1) => onChange(value === null ? min : Math.max(min, Math.min(max, value + direction * step)));
  return <View style={styles.screen}>
    <View accessibilityLabel={`${label}: ${value === null ? 'not set' : `${value} ${unit}`}`} accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value ?? min, text: value === null ? 'Not set' : `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment', label: `Increase by ${step}` }, { name: 'decrement', label: `Decrease by ${step}` }]}
      onAccessibilityAction={(event) => adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.valueCard, branchShadow]} testID={testID}>
      <Text style={[styles.value, value === null && styles.valueUnset]}>{value === null ? 'Not set' : value.toLocaleString()}</Text>
      <Text style={styles.unit}>{unit}</Text>
    </View>
    <View onLayout={onLayout} style={styles.touchTrack} {...panResponder.panHandlers}>
      <View style={styles.track}>
        <View style={[styles.activeTrack, { width: `${progress * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, progress * trackWidth - 15) }]} />
    </View>
    <View style={styles.range}><Text style={styles.rangeText}>{min.toLocaleString()}</Text><Text style={styles.rangeText}>{max.toLocaleString()}</Text></View>
    <Text style={styles.note}>{value === null ? 'Optional — choose a value only if you know it.' : 'This is your target. You can change it anytime.'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { alignItems: 'stretch', gap: 12, paddingHorizontal: 4, paddingTop: 18 },
  valueCard: { alignItems: 'baseline', alignSelf: 'center', backgroundColor: '#FFF9FA', borderColor: '#F7C8D6', borderRadius: 24, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minWidth: 180, paddingHorizontal: 24, paddingVertical: 18 },
  value: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 40, letterSpacing: -1.2, lineHeight: 46 }, valueUnset: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 24, letterSpacing: 0 },
  unit: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 16 },
  touchTrack: { height: 52, justifyContent: 'center', marginTop: 8 },
  track: { backgroundColor: colors.canvasSunk, borderRadius: 99, height: 8, overflow: 'hidden' },
  activeTrack: { backgroundColor: colors.coral, borderRadius: 99, height: '100%' },
  thumb: { backgroundColor: colors.coral, borderColor: colors.surface, borderRadius: 99, borderWidth: 4, height: 30, position: 'absolute', shadowColor: '#C74870', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 5, width: 30 },
  range: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  note: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
