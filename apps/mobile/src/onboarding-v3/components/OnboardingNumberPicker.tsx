import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { useReduceMotion } from '../motion/useReduceMotion';
import {
  clampNumberPickerIndex,
  NUMBER_PICKER_ITEM_HEIGHT,
  numberPickerIndexFromOffset,
} from './numberPickerMath';

export { clampNumberPickerIndex, NUMBER_PICKER_ITEM_HEIGHT, numberPickerIndexFromOffset } from './numberPickerMath';

export type NumberPickerOption<T extends string | number> = Readonly<{
  value: T;
  label: string;
  accessibilityLabel?: string;
}>;

export function OnboardingNumberPicker<T extends string | number>({
  accessibilityLabel,
  onChange,
  options,
  selectedIndex,
  testID,
}: {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly NumberPickerOption<T>[];
  selectedIndex: number;
  testID: string;
}) {
  const listRef = useRef<FlatList<NumberPickerOption<T>>>(null);
  const lastCommittedIndex = useRef<number>(-1);
  const reduceMotion = useReduceMotion();
  const safeSelectedIndex = clampNumberPickerIndex(selectedIndex, options.length);
  const [visibleIndex, setVisibleIndex] = useState(safeSelectedIndex);
  const selected = options[safeSelectedIndex];
  const data = useMemo(() => options, [options]);

  useEffect(() => {
    lastCommittedIndex.current = safeSelectedIndex;
    setVisibleIndex(safeSelectedIndex);
    listRef.current?.scrollToOffset({ offset: safeSelectedIndex * NUMBER_PICKER_ITEM_HEIGHT, animated: !reduceMotion });
  }, [reduceMotion, safeSelectedIndex]);

  const commitIndex = (index: number) => {
    const nextIndex = clampNumberPickerIndex(index, options.length);
    setVisibleIndex(nextIndex);
    if (nextIndex === lastCommittedIndex.current) return;
    lastCommittedIndex.current = nextIndex;
    const next = options[nextIndex];
    if (!next) return;
    void Haptics.selectionAsync().catch(() => undefined);
    onChange(next.value);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setVisibleIndex(numberPickerIndexFromOffset(event.nativeEvent.contentOffset.y, options.length));
  };
  const handleSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitIndex(numberPickerIndexFromOffset(event.nativeEvent.contentOffset.y, options.length));
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={selected ? { text: selected.accessibilityLabel ?? selected.label } : undefined}
      style={styles.picker}
      testID={testID}
    >
      <View pointerEvents="none" style={styles.selectionWindow} />
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.listContent}
        data={data}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: NUMBER_PICKER_ITEM_HEIGHT, offset: NUMBER_PICKER_ITEM_HEIGHT * index, index })}
        keyExtractor={(item) => String(item.value)}
        onMomentumScrollEnd={handleSettled}
        onScroll={handleScroll}
        onScrollEndDrag={handleSettled}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={NUMBER_PICKER_ITEM_HEIGHT}
        renderItem={({ item, index }) => {
          const distance = Math.abs(index - visibleIndex);
          return <View key={String(item.value)} style={styles.row}>
            <Text accessibilityLabel={item.accessibilityLabel} numberOfLines={1} style={[styles.value, distance === 0 ? styles.valueSelected : distance === 1 ? styles.valueNearby : styles.valueFaded]}>{item.label}</Text>
          </View>;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { height: NUMBER_PICKER_ITEM_HEIGHT * 3, overflow: 'hidden', width: '100%' },
  listContent: { paddingVertical: NUMBER_PICKER_ITEM_HEIGHT },
  row: { alignItems: 'center', height: NUMBER_PICKER_ITEM_HEIGHT, justifyContent: 'center' },
  selectionWindow: { borderBottomColor: colors.coral, borderBottomWidth: 1, borderTopColor: colors.coral, borderTopWidth: 1, height: NUMBER_PICKER_ITEM_HEIGHT, left: 0, position: 'absolute', right: 0, top: NUMBER_PICKER_ITEM_HEIGHT, zIndex: 1 },
  value: { fontFamily: fontFamilies.bold, textAlign: 'center' },
  valueFaded: { color: colors.muted, fontSize: 20, opacity: 0.32 },
  valueNearby: { color: colors.body, fontSize: 24, opacity: 0.6 },
  valueSelected: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 34 },
});
