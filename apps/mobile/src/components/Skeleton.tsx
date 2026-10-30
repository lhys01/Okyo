import { useEffect, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';

import { colors } from '../theme/okyoTheme';

// ponytail: one shared pulse drives every Skeleton on screen, so N boxes = 1
// animation, not N. Opacity pulse instead of a moving shimmer gradient — no
// lib, reads fine. Swap for a gradient sweep only if design asks.
const sharedPulse = new Animated.Value(0.45);
let refCount = 0;

function useSharedPulse() {
  useEffect(() => {
    refCount += 1;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sharedPulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(sharedPulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    if (refCount === 1) loop.start();
    return () => {
      refCount -= 1;
      if (refCount === 0) loop.stop();
    };
  }, []);
  return sharedPulse;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 10,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const opacity = useSharedPulse();
  return (
    <Animated.View
      style={[{ backgroundColor: colors.border, borderRadius: radius, height, width }, style, { opacity }]}
    />
  );
}

// Wraps a set of Skeletons so assistive tech announces one "Loading" region.
export function SkeletonGroup({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={style}>
      {children}
    </View>
  );
}

// A few lines of text with the last one short — the usual paragraph placeholder.
export function SkeletonLines({ count = 3, lineHeight = 14, gap = 10 }: { count?: number; lineHeight?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={lineHeight} width={index === count - 1 ? '55%' : '100%'} />
      ))}
    </View>
  );
}

// Full-screen placeholder for the settings/profile-style form screens: a title
// bar plus a stack of card-height blocks. Matches their padding so the swap in
// and out doesn't jump.
export function FormScreenSkeleton({ cards = 4, cardHeight = 66 }: { cards?: number; cardHeight?: number }) {
  return (
    <SkeletonGroup style={skeletonStyles.screen}>
      <Skeleton height={26} radius={8} width="55%" />
      <View style={{ gap: 14, marginTop: 8 }}>
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} height={cardHeight} radius={16} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

// Home: greeting, the week strip, the metric card, then a couple of section
// stacks. Rough shapes only — enough that the real screen doesn't jump in.
export function HomeSkeleton() {
  return (
    <SkeletonGroup style={skeletonStyles.screen}>
      <Skeleton height={22} width="45%" />
      <View style={skeletonStyles.weekRow}>
        {Array.from({ length: 7 }, (_, index) => (
          <View key={index} style={skeletonStyles.weekCell}>
            <Skeleton height={10} radius={4} width={14} />
            <Skeleton height={36} radius={18} width={36} />
          </View>
        ))}
      </View>
      <Skeleton height={150} radius={20} />
      <View style={{ gap: 12, marginTop: 6 }}>
        <Skeleton height={16} width="40%" />
        <Skeleton height={92} radius={16} />
        <Skeleton height={92} radius={16} />
      </View>
    </SkeletonGroup>
  );
}

// Library: title, search field, filter chips, then a few recipe rows
// (thumb + text lines).
export function LibrarySkeleton() {
  return (
    <SkeletonGroup style={skeletonStyles.screen}>
      <Skeleton height={24} style={{ alignSelf: 'center' }} width="30%" />
      <Skeleton height={48} radius={16} />
      <View style={skeletonStyles.chipRow}>
        {[64, 38, 46, 40].map((pct, index) => (
          <Skeleton key={index} height={32} radius={999} width={`${pct}%`} />
        ))}
      </View>
      <View style={{ gap: 16, marginTop: 4 }}>
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} style={skeletonStyles.recipeRow}>
            <Skeleton height={84} radius={14} width={84} />
            <View style={{ flex: 1, gap: 9 }}>
              <Skeleton height={15} width="80%" />
              <Skeleton height={12} width="55%" />
              <Skeleton height={12} width="45%" />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

export const skeletonStyles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 8 },
  recipeRow: { flexDirection: 'row', gap: 12 },
  screen: { flex: 1, gap: 22, paddingHorizontal: 20, paddingTop: 24 },
  weekCell: { alignItems: 'center', flex: 1, gap: 6 },
  weekRow: { flexDirection: 'row', width: '100%' },
});
