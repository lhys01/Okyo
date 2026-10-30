import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, InteractionManager, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useAccessibilityPreferences';
import { colors, spacing, typography } from '../theme/okyoTheme';
import { CoachDock } from './CoachDock';
import { COACH_DOCK_BOTTOM_OFFSET, COACH_DOCK_ESTIMATED_HEIGHT, KIKO_OVERLAP, KIKO_SIZE } from './coachDockGeometry';
import { SpotlightMask, type ShapedRect } from './SpotlightMask';
import { useTour } from './TourContext';
import { canAdvanceTourStep, canDismissTour, computeScrollDelta, computeUsableViewport, isCurrentMeasurement, isValidTourRect, shapeSpotlightRect, shouldRenderTourStep, type TourRect } from './tourGeometry';
import { getHighlightedTourAnchorId, getTourSteps, resolveMountedTourTargets, TOUR_SCREENS, TOUR_STEP_COUNT, type TourStep, type TourTarget } from './tourSteps';
import { navigateToTourScreen } from './tourNavigation';

const MEASURE_RETRY_MS = 80;
const MEASURE_MAX_TRIES = 18;
const MAX_SCROLL_ATTEMPTS = 4;
const TOP_BAR_HEIGHT = 24;
const SCREEN_MARGIN = spacing.lg;
const FOCUS_MARGIN = 12;

function resolveTargets(step: TourStep, getAnchor: ReturnType<typeof useTour>['getAnchor']): readonly TourTarget[] {
  // A compound step may legitimately render fewer controls than the design
  // data describes (for example, dietary filtering can leave one Home
  // recommendation card). Spotlight the mounted controls that exist instead
  // of rejecting the whole step because one optional card is absent. A step
  // with no mounted targets still falls through to the bounded retry and
  // renders only the dimmed guide shell.
  return resolveMountedTourTargets(step, (anchorId) => Boolean(getAnchor(anchorId)?.current));
}

/** Keep the spotlight on any visible part of a real target when it cannot be
 * moved fully into the focus stage. This is especially useful for tall Home
 * cards on compact phones: dimming the whole card makes the tour target look
 * inactive even though its measured view is present. */
function shapeVisibleTargets(
  rects: readonly TourRect[],
  targets: readonly TourTarget[],
  viewport: { top: number; bottom: number },
  safeArea: { top: number; bottom: number },
  screenHeight: number,
): ShapedRect[] {
  return rects.flatMap((rect, index) => {
    const target = targets[index];
    // The empty-state Explore CTA sits immediately above the coach dock on
    // Liked. Clipping it to the coach's focus viewport cuts through the real
    // button and leaves the spotlight looking like a second, offset button.
    // It is already a real, measured control, so preserve its complete bounds
    // and let the coach layer provide the normal separation below it.
    const bounds = target?.anchorId === 'grocery-tab' || target?.anchorId === 'liked-explore-recipes'
      ? { top: safeArea.top, bottom: screenHeight - Math.max(4, safeArea.bottom) }
      : viewport;
    const top = Math.max(rect.y, bounds.top);
    const bottom = Math.min(rect.y + rect.height, bounds.bottom);
    if (!target || bottom <= top) return [];
    return [shapeSpotlightRect({ ...rect, y: top, height: bottom - top }, target.shape)];
  });
}

function measureNode(node: { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void }): Promise<TourRect | null> {
  return new Promise((resolve) => node.measureInWindow((x, y, width, height) => resolve(isValidTourRect({ x, y, width, height }) ? { x, y, width, height } : null)));
}

/** A persistent guide shell plus a current, window-coordinate spotlight. */
export function TourOverlay() {
  const { active, beginStepTransition, confirmPendingStart, done, getAnchor, getScrollOffset, getScrollRef, externallyPaused, mascotName, next, pendingStart, remeasureVersion, releaseStepTransition, requestRemeasure, setHighlightedAnchorId, skip, stepIndex } = useTour();
  const navigation = useNavigation<any>();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [shapedRects, setShapedRects] = useState<ShapedRect[]>([]);
  const [ready, setReady] = useState(false);
  const [readyStepIndex, setReadyStepIndex] = useState(-1);
  const [dockHeight, setDockHeight] = useState(COACH_DOCK_ESTIMATED_HEIGHT);
  const [dockTop, setDockTop] = useState<number | null>(null);
  const announcedStepRef = useRef(-1);
  const dockRef = useRef<View>(null);
  const measureTokenRef = useRef(0);
  const scrollAttemptsRef = useRef(0);
  const scheduledRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduledFramesRef = useRef<number[]>([]);
  const interactionRef = useRef<{ cancel: () => void } | null>(null);
  const spotlightOpacity = useRef(new Animated.Value(0)).current;

  const currentRouteName = useNavigationState((state) => {
    const directRoute = state?.index === undefined ? undefined : state.routes?.[state.index]?.name;
    if (directRoute && TOUR_SCREENS.includes(directRoute as (typeof TOUR_SCREENS)[number])) return directRoute;
    const mainTabsRoute = state?.routes?.find((route) => route.name === 'MainTabs');
    const nestedState = mainTabsRoute?.state;
    return nestedState?.index === undefined ? undefined : nestedState.routes?.[nestedState.index]?.name;
  });
  useEffect(() => { if (pendingStart && currentRouteName === 'HomeScreen') confirmPendingStart(); }, [confirmPendingStart, currentRouteName, pendingStart]);

  const tourSteps = useMemo(() => getTourSteps(mascotName), [mascotName]);
  const step = tourSteps[stepIndex];
  const noSpotlight = step.targets.length === 0;
  const isOnTourScreen = currentRouteName !== undefined && TOUR_SCREENS.includes(currentRouteName as (typeof TOUR_SCREENS)[number]);
  const paused = externallyPaused || (active && !step.isFinish && step.screen !== null && currentRouteName !== undefined && currentRouteName !== step.screen && !isOnTourScreen);
  // Target measurements use window coordinates. Once available, use the
  // guide's own measured window-space top as the bottom of the usable stage
  // instead of estimating it from device height. The mascot protrudes above
  // the card, so that visible portion is included too.
  const footerHeight = dockTop === null
    ? COACH_DOCK_BOTTOM_OFFSET + dockHeight + (KIKO_SIZE - KIKO_OVERLAP)
    // Kiko's PNG has transparent breathing room around the visible sticker.
    // Reserve the visible overlap rather than the full 58pt layout box so
    // recommendation and empty-state controls can sit just above the coach
    // card without being rejected as “under” the mascot.
    : screenHeight - dockTop + Math.max(0, KIKO_SIZE - KIKO_OVERLAP - 20);
  const usableViewport = useMemo(() => computeUsableViewport({ footerHeight, headerHeight: insets.top + TOP_BAR_HEIGHT, insetsTop: 0, margin: FOCUS_MARGIN, screenHeight }), [footerHeight, insets.top, screenHeight]);

  useEffect(() => {
    if (!active || paused) return undefined;
    const token = ++measureTokenRef.current;
    scheduledRef.current.forEach(clearTimeout);
    scheduledRef.current = [];
    scheduledFramesRef.current.forEach(cancelAnimationFrame);
    scheduledFramesRef.current = [];
    interactionRef.current?.cancel();
    scrollAttemptsRef.current = 0;
    setReady(false);
    setShapedRects([]);
    spotlightOpacity.setValue(0);
    const schedule = (callback: () => void, delay = MEASURE_RETRY_MS) => {
      const timer = setTimeout(() => {
        scheduledRef.current = scheduledRef.current.filter((item) => item !== timer);
        callback();
      }, delay);
      scheduledRef.current.push(timer);
    };
    const scheduleNextFrame = (callback: () => void) => {
      const frame = requestAnimationFrame(() => {
        scheduledFramesRef.current = scheduledFramesRef.current.filter((item) => item !== frame);
        callback();
      });
      scheduledFramesRef.current.push(frame);
    };
    const isCurrent = () => isCurrentMeasurement(token, measureTokenRef.current, stepIndex, stepIndex);
    const commitWithoutHole = () => {
      if (!isCurrent()) return;
      setShapedRects([]);
      setReady(true);
      setReadyStepIndex(stepIndex);
    };
    let tries = 0;
    const tryMeasure = () => {
      if (!isCurrent()) return;
      // Never measure a previous tab kept mounted by React Navigation.
      if (step.screen && currentRouteName !== step.screen) {
        if (tries++ < MEASURE_MAX_TRIES) schedule(tryMeasure); else commitWithoutHole();
        return;
      }
      if (noSpotlight) { commitWithoutHole(); return; }
      const targets = resolveTargets(step, getAnchor);
      const nodes = targets.map((target) => getAnchor(target.anchorId)?.current ?? null);
      if (nodes.some((node) => !node)) {
        if (tries++ < MEASURE_MAX_TRIES) schedule(tryMeasure); else commitWithoutHole();
        return;
      }
      Promise.all(nodes.map((node) => measureNode(node!))).then((rects) => {
        if (!isCurrent()) return;
        if (rects.some((rect) => !rect)) {
          if (tries++ < MEASURE_MAX_TRIES) schedule(tryMeasure); else commitWithoutHole();
          return;
        }
        const validRects = rects as TourRect[];
        const scrollRef = step.screen ? getScrollRef(step.screen) : undefined;
        // Compound steps (Today’s Ideas) must fit every highlighted control,
        // not just the first card. Pick the smallest single scroll that
        // resolves the largest edge violation, then measure the full set again.
        const delta = validRects
          .map((rect, index) => targets[index]?.anchorId === 'grocery-tab' ? null : computeScrollDelta(rect, usableViewport, FOCUS_MARGIN))
          .filter((value): value is number => value !== null)
          .reduce<number | null>((current, value) => current === null || Math.abs(value) > Math.abs(current) ? value : current, null);
        if (delta !== null && scrollRef?.current && scrollAttemptsRef.current < MAX_SCROLL_ATTEMPTS) {
          scrollAttemptsRef.current += 1;
          scrollRef.current.scrollTo({ animated: false, y: Math.max(0, getScrollOffset(step.screen!) + delta) });
          scheduleNextFrame(tryMeasure);
          return;
        }
        // The circular FAB sits beside—not under—the compact left-side guide.
        const visibleRects = shapeVisibleTargets(validRects, targets, usableViewport, insets, screenHeight);
        if (visibleRects.length === 0) { commitWithoutHole(); return; }
        setShapedRects(visibleRects);
        setReady(true);
        setReadyStepIndex(stepIndex);
      });
    };
    if (step.screen && currentRouteName !== step.screen) navigateToTourScreen(navigation.navigate, step.screen);
    interactionRef.current = InteractionManager.runAfterInteractions(() => schedule(tryMeasure, 0));
    return () => {
      ++measureTokenRef.current;
      scheduledRef.current.forEach(clearTimeout);
      scheduledRef.current = [];
      scheduledFramesRef.current.forEach(cancelAnimationFrame);
      scheduledFramesRef.current = [];
      interactionRef.current?.cancel();
      interactionRef.current = null;
    };
  }, [active, currentRouteName, dockHeight, getAnchor, getScrollOffset, getScrollRef, insets.top, navigation, noSpotlight, paused, screenHeight, step, stepIndex, usableViewport]);

  // Follow real scrolling and relayouts only after this step has committed.
  useEffect(() => {
    if (!active || paused || noSpotlight || !ready || readyStepIndex !== stepIndex) return;
    const targets = resolveTargets(step, getAnchor);
    const nodes = targets.map((target) => getAnchor(target.anchorId)?.current ?? null);
    if (nodes.some((node) => !node)) return;
    Promise.all(nodes.map((node) => measureNode(node!))).then((rects) => {
      if (rects.some((rect) => !rect)) return;
      const validRects = rects as TourRect[];
      setShapedRects(shapeVisibleTargets(validRects, targets, usableViewport, insets, screenHeight));
    });
  }, [active, getAnchor, insets.top, noSpotlight, paused, ready, readyStepIndex, remeasureVersion, screenHeight, step, stepIndex, usableViewport]);

  const spotlightCommitted = shouldRenderTourStep({ active, paused, ready, readyStepIndex, stepIndex });
  useEffect(() => {
    if (spotlightCommitted) releaseStepTransition();
  }, [releaseStepTransition, spotlightCommitted]);
  useEffect(() => {
    const mountedTargets = resolveTargets(step, getAnchor);
    setHighlightedAnchorId(spotlightCommitted && shapedRects.length > 0 ? getHighlightedTourAnchorId(mountedTargets) : null);
    return () => setHighlightedAnchorId(null);
  }, [getAnchor, setHighlightedAnchorId, shapedRects.length, spotlightCommitted, step]);

  useEffect(() => {
    if (!spotlightCommitted) return undefined;
    if (announcedStepRef.current !== stepIndex) {
      announcedStepRef.current = stepIndex;
      AccessibilityInfo.announceForAccessibility(step.body);
    };
    if (reduceMotion) {
      spotlightOpacity.setValue(1);
      return undefined;
    }
    Animated.timing(spotlightOpacity, { duration: 120, toValue: 1, useNativeDriver: true }).start();
  }, [reduceMotion, spotlightCommitted, step.body, stepIndex, spotlightOpacity]);

  // Commit the complete tour step atomically: no dim shell, Skip control, or
  // coach copy is painted until the matching route and target geometry exist.
  if (!spotlightCommitted) return null;

  const hasHole = spotlightCommitted && shapedRects.length > 0;
  // A measured spotlight is visual guidance, not a prerequisite for tour
  // navigation. If a native view cannot be measured on a particular frame,
  // keep Next usable; the destination step will still be measured normally.
  const controlsEnabled = canAdvanceTourStep(false);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.root]}>
      {hasHole ? (
        <SpotlightMask
          key={`${step.id}-${remeasureVersion}-${shapedRects.map((rect) => `${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.width)}:${Math.round(rect.height)}`).join('|')}`}
          opacity={spotlightOpacity}
          rects={shapedRects}
          screenHeight={screenHeight}
          screenWidth={screenWidth}
        />
      ) : null}
      {!hasHole ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.measuringDim]} /> : null}
      {hasHole ? shapedRects.filter((rect) => !rect.noBorder).map((rect, index) => <Animated.View key={`${step.id}-${index}`} pointerEvents="none" style={[styles.spotlightBorder, { borderRadius: rect.borderRadius, height: rect.height, left: rect.x, opacity: spotlightOpacity, top: rect.y, width: rect.width }]} />) : null}
      <Pressable accessibilityLabel="Skip guided tour" accessibilityRole="button" disabled={!canDismissTour()} hitSlop={12} onPress={skip} style={[styles.skipButton, { top: insets.top + 2 }]}><Text style={styles.skipText}>Skip</Text></Pressable>
      <CoachDock
        controlsEnabled={controlsEnabled}
        fullBody={step.body}
        isLastStep={stepIndex === TOUR_STEP_COUNT - 1}
        mascotName={mascotName}
        onDone={done}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          const nextHeight = Math.ceil(height);
          if (nextHeight > 0 && nextHeight !== dockHeight) { setDockHeight(nextHeight); requestRemeasure(); }
          dockRef.current?.measureInWindow((_x, y) => {
            if (Number.isFinite(y) && y >= 0 && y !== dockTop) { setDockTop(y); requestRemeasure(); }
          });
        }}
        onNext={() => { if (beginStepTransition()) next(); }}
        rootRef={dockRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  measuringDim: { backgroundColor: 'rgba(34, 32, 36, 0.22)' },
  root: { elevation: Platform.OS === 'android' ? 1000 : undefined, zIndex: 1000 },
  skipButton: { alignItems: 'center', height: TOP_BAR_HEIGHT, justifyContent: 'center', paddingHorizontal: SCREEN_MARGIN, position: 'absolute', right: 0 },
  skipText: { ...typography.bodySmall, color: colors.surface },
  spotlightBorder: { borderColor: colors.cream, borderWidth: 2, position: 'absolute', shadowColor: colors.coral, shadowOffset: { height: 0, width: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
});
