import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { onboardingFontFamilies as fontFamilies } from "../../theme/okyoTheme";
import { branchSurfaces } from "../branch-ui/branchTheme";

type SliderVariant = "standard" | "weightChange";

export function StartingEstimateSlider({
  label,
  value,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  valueLabel,
  onChange,
  testID,
  variant = "standard",
  compact = false,
  bubbleWidth = 104,
}: {
  label?: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  valueLabel: (value: number | null) => string;
  onChange: (value: number) => void;
  testID: string;
  variant?: SliderVariant;
  compact?: boolean;
  bubbleWidth?: number;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef<number | null>(value);
  const progress = value === null ? 0 : (value - min) / (max - min);
  const progressAnimated = useSharedValue(progress);
  const trackWidthAnimated = useSharedValue(0);
  valueRef.current = value;

  useEffect(() => {
    // Keep the thumb and fill synchronized with each drag update. A timing
    // animation here made the displayed value feel like it lagged behind the
    // user's finger on longer tracks.
    progressAnimated.value = progress;
  }, [progress, progressAnimated]);

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
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
      dragStartX.current = event.nativeEvent.locationX;
      setFromX(dragStartX.current);
    },
        // Move relative to the initial touch; locationX can stay attached to a child target.
    onPanResponderMove: (_event, gesture) => setFromX(dragStartX.current + gesture.dx),
      }),
    [trackWidth, min, max, step],
  );
  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setTrackWidth(width);
    trackWidthAnimated.value = width;
  };
  const fillStyle = useAnimatedStyle(() => ({
    width: progressAnimated.value * trackWidthAnimated.value,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progressAnimated.value * trackWidthAnimated.value -
          (compact ? 13 : 16),
      },
    ],
  }));
  const activeColor =
    variant === "weightChange"
      ? (value ?? 0) < 0
        ? "#59C3D2"
        : (value ?? 0) > 0
          ? "#F58CA8"
          : "#A6A7B8"
      : "#59C3D2";
  const bubbleLeft = Math.max(
    0,
    Math.min(
      Math.max(0, trackWidth - bubbleWidth),
      progress * trackWidth - bubbleWidth / 2,
    ),
  );
  const pointerLeft = Math.max(
    5,
    Math.min(bubbleWidth - 15, progress * trackWidth - bubbleLeft - 5),
  );
  const adjust = (direction: 1 | -1) => {
    const next =
      value === null
        ? min
        : Math.max(min, Math.min(max, value + direction * step));
    if (next !== value) {
      onChange(next);
      void Haptics.selectionAsync();
    }
  };

  return (
    <View style={[styles.section, compact && styles.compactSection]}>
      {label ? (
        <Text style={[styles.label, compact && styles.compactLabel]}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.bubbleSpace, compact && styles.compactBubbleSpace]}>
        <View
          pointerEvents="none"
          style={[
            styles.bubble,
            compact && styles.compactBubble,
            { left: bubbleLeft, width: bubbleWidth },
          ]}
        >
          <Text style={[styles.bubbleText, { color: activeColor }]}>
            {valueLabel(value)}
          </Text>
          <View style={[styles.pointer, { left: pointerLeft }]} />
        </View>
      </View>
      <View
        accessible
        accessibilityActions={[
          { name: "increment", label: `Increase by ${step}` },
          { name: "decrement", label: `Decrease by ${step}` },
        ]}
        accessibilityLabel={`${label}: ${valueLabel(value)}`}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min,
          max,
          now: value ?? min,
          text: valueLabel(value),
        }}
        onAccessibilityAction={(event) =>
          adjust(event.nativeEvent.actionName === "increment" ? 1 : -1)
        }
        onLayout={onLayout}
        style={[styles.trackTouch, compact && styles.compactTrackTouch]}
        testID={testID}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.track,
            compact && styles.compactTrack,
            variant === "weightChange" && styles.weightChangeTrack,
          ]}
        >
          {variant === "weightChange" ? (
            <>
              <View style={styles.loseZone} />
              <View style={styles.maintainZone} />
              <View style={styles.gainZone} />
            </>
          ) : null}
          <Animated.View
            style={[styles.fill, { backgroundColor: activeColor }, fillStyle]}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, compact && styles.compactThumb, thumbStyle]}
        >
          <View
            style={[
              styles.thumbCenter,
              compact && styles.compactThumbCenter,
              { backgroundColor: activeColor },
            ]}
          />
        </Animated.View>
      </View>
      <View style={[styles.range, compact && styles.compactRange]}>
        <Text style={styles.rangeText}>{minLabel}</Text>
        {variant === "weightChange" ? (
          <Text style={styles.centerLabel}>Maintain</Text>
        ) : null}
        <Text style={styles.rangeText}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 7 },
  compactSection: { gap: 4 },
  label: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  compactLabel: { fontSize: 14, lineHeight: 19 },
  bubbleSpace: { height: 48, marginTop: 2, position: "relative" },
  compactBubbleSpace: { height: 36, marginTop: 0 },
  bubble: {
    alignItems: "center",
    backgroundColor: "#F6FCFC",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8,
    position: "absolute",
    shadowColor: "#1E2A32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  compactBubble: { borderRadius: 12, minHeight: 28 },
  bubbleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
  pointer: {
    backgroundColor: "#F6FCFC",
    bottom: -5,
    height: 10,
    position: "absolute",
    transform: [{ rotate: "45deg" }],
    width: 10,
  },
  trackTouch: {
    height: 42,
    justifyContent: "center",
    marginTop: 4,
  },
  compactTrackTouch: { height: 30, marginTop: 0 },
  track: {
    backgroundColor: "#F2F0ED",
    borderRadius: 99,
    height: 8,
    overflow: "hidden",
  },
  compactTrack: { height: 7 },
  weightChangeTrack: { flexDirection: "row" },
  loseZone: { backgroundColor: "#E7F6F8", flex: 1 },
  maintainZone: { backgroundColor: "#F2F0ED", flex: 1 },
  gainZone: { backgroundColor: "#FDECEE", flex: 1 },
  fill: {
    borderRadius: 99,
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
  },
  thumb: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#2D3037",
    borderRadius: 99,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 5,
    shadowColor: "#20242A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    width: 32,
  },
  thumbCenter: { borderRadius: 99, height: 20, width: 20 },
  compactThumb: { height: 26, top: 2, width: 26 },
  compactThumbCenter: { height: 16, width: 16 },
  range: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  rangeText: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  compactRange: { marginTop: 0 },
  centerLabel: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
});
