import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { HomeMetric, HomeMetricKind } from '../../state/homeMetrics';
import { colors } from '../../theme/okyoTheme';
import { MetricCard } from './MetricCard';

const gap = 12;

export function MetricCarousel({ cardHeight, cardWidth, futureDay = false, metrics, order }: { cardHeight: number; cardWidth: number; futureDay?: boolean; metrics: Record<HomeMetricKind, HomeMetric>; order: readonly HomeMetricKind[] }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<HomeMetricKind>>(null);
  const data = useMemo(() => [...order], [order]);
  const setPage = (nextIndex: number) => {
    const bounded = Math.max(0, Math.min(data.length - 1, nextIndex));
    listRef.current?.scrollToOffset({ animated: true, offset: bounded * (cardWidth + gap) });
  };
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(data.length - 1, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + gap))));
    if (next !== index) {
      setIndex(next);
      void Haptics.selectionAsync().catch(() => undefined);
    }
  };

  return (
    <View accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} accessibilityLabel={`${metrics[data[index]].label} dashboard metric, ${index + 1} of ${data.length}`} accessibilityRole="adjustable" onAccessibilityAction={(event) => setPage(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        decelerationRate="fast"
        horizontal
        keyExtractor={(kind) => kind}
        onMomentumScrollEnd={onMomentumScrollEnd}
        ref={listRef}
        renderItem={({ item }) => <MetricCard futureDay={futureDay} height={cardHeight} metric={metrics[item]} width={cardWidth} />}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
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
