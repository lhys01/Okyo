import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { HomeMetric, HomeMetricKind } from '../../state/homeMetrics';
import { colors } from '../../theme/okyoTheme';
import { useTour } from '../../tour/TourContext';
import { useReduceMotion } from '../../hooks/useAccessibilityPreferences';
import { MetricCard } from './MetricCard';
import { getMetricCarouselIndex } from './metricCarouselState';

const gap = 12;

export function MetricCarousel({ activeCardRef, cardHeight, cardWidth, futureDay = false, metrics, order }: { activeCardRef?: RefObject<View | null>; cardHeight: number; cardWidth: number; futureDay?: boolean; metrics: Record<HomeMetricKind, HomeMetric>; order: readonly HomeMetricKind[] }) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const listRef = useRef<FlatList<HomeMetricKind>>(null);
  const data = useMemo(() => [...order], [order]);
  const { requestRemeasure } = useTour();
  const reduceMotion = useReduceMotion();
  const updateIndex = (nextIndex: number) => {
    if (data.length === 0) return;
    const bounded = Math.max(0, Math.min(data.length - 1, nextIndex));
    if (bounded === indexRef.current) return;
    indexRef.current = bounded;
    setIndex(bounded);
    void Haptics.selectionAsync().catch(() => undefined);
    // If the guided tour is spotlighting this carousel, tell it the active
    // card changed so it re-measures and moves the spotlight.
    requestRemeasure();
  };
  const setPage = (nextIndex: number) => {
    if (data.length === 0) return;
    const bounded = Math.max(0, Math.min(data.length - 1, nextIndex));
    updateIndex(bounded);
    listRef.current?.scrollToOffset({ animated: !reduceMotion, offset: bounded * (cardWidth + gap) });
  };
  const syncIndexToScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateIndex(getMetricCarouselIndex(event.nativeEvent.contentOffset.x, cardWidth + gap, data.length));
  };

  return (
    <View accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} accessibilityLabel={`${metrics[data[index]].label} dashboard metric, ${index + 1} of ${data.length}`} accessibilityRole="adjustable" onAccessibilityAction={(event) => setPage(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        decelerationRate="fast"
        extraData={metrics}
        horizontal
        keyExtractor={(kind) => kind}
        onMomentumScrollEnd={syncIndexToScroll}
        onScroll={syncIndexToScroll}
        ref={listRef}
        renderItem={({ item }) => (
          <View ref={item === data[index] ? activeCardRef : undefined}>
            <MetricCard futureDay={futureDay} height={cardHeight} metric={metrics[item]} width={cardWidth} />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
        scrollEventThrottle={16}
        snapToInterval={cardWidth + gap}
        snapToAlignment="start"
        ItemSeparatorComponent={Separator}
      />
      <View style={styles.dots}>
        {data.map((kind, dotIndex) => <View key={kind} style={[styles.dot, dotIndex === index ? styles.dotActive : null]} />)}
      </View>
    </View>
  );
}

function Separator() { return <View style={{ width: gap }} />; }

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  dot: { backgroundColor: colors.border, borderRadius: 4, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.ink },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12 },
  list: { overflow: 'visible' },
});
