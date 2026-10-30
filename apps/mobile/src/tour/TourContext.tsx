import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ScrollView, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { onboardingV3Persistence, subscribeToMascotName } from '../onboarding-v3/state/onboardingV3Persistence';
import { getFoxDisplayName } from '../state/foxDisplayName';
import { shouldStartTour, tourPersistence, type TourPersistedStatus } from './tourPersistence';
import { TOUR_STEP_COUNT, type TourStepScreen } from './tourSteps';

/** The tour only ever navigates onto these three tabs, each with one scrollable container it can measure/scroll/follow. */
export type TourScrollableScreen = NonNullable<TourStepScreen>;

interface TourContextValue {
  hydrated: boolean;
  homeReady: boolean;
  reportHomeReady: () => void;
  mascotName: string;
  active: boolean;
  stepIndex: number;
  next: () => void;
  /** Starts one guarded transition; repeated taps while the destination is
   * mounting/measuring are ignored until the overlay releases the lock. */
  beginStepTransition: () => boolean;
  releaseStepTransition: () => void;
  skip: () => void;
  done: () => void;
  /** Dev-only: clears persisted status and restarts on Home. */
  devReset: () => void;
  registerAnchor: (id: string, ref: RefObject<View | null>) => void;
  unregisterAnchor: (id: string) => void;
  getAnchor: (id: string) => RefObject<View | null> | undefined;
  registerScrollRef: (screen: TourScrollableScreen, ref: RefObject<ScrollView | null>) => void;
  getScrollRef: (screen: TourScrollableScreen) => RefObject<ScrollView | null> | undefined;
  /** The screen's own onScroll reports its live content offset here so the
   * overlay can compute an absolute scrollTo() target instead of guessing
   * from window-space coordinates alone. */
  reportScrollOffset: (screen: TourScrollableScreen, offsetY: number) => void;
  getScrollOffset: (screen: TourScrollableScreen) => number;
  /** Bumped whenever a spotlighted component reports its own layout moved
   * (e.g. the metric carousel swiped to a new card, or the user manually
   * scrolled the screen) so the overlay re-measures the current step's
   * target in place — without replaying the fade/navigate/measure sequence,
   * and without changing step. */
  remeasureVersion: number;
  requestRemeasure: () => void;
  /** Lets a real interactive component (e.g. the floating scan button) expose
   * its own trigger under a stable id, so the tour's completion screen can
   * invoke the SAME real action rather than reimplementing it. */
  registerAction: (id: string, fn: () => void) => void;
  unregisterAction: (id: string) => void;
  getAction: (id: string) => (() => void) | undefined;
  /** Set by a real component (e.g. the scan sheet) while it is genuinely
   * open over a highlighted target, so the tour hides without losing its
   * place and resumes cleanly once the component reports closed. */
  externallyPaused: boolean;
  setExternallyPaused: (paused: boolean) => void;
  /** The anchor id the tour is currently spotlighting, or null when the tour
   * isn't actively showing a spotlight. A real component that sits outside
   * the tour overlay's own z-order (e.g. the floating scan button, hosted by
   * React Navigation's own tab-bar layer) reads this to dim ITSELF when it
   * isn't the current target — sidestepping any native stacking-context
   * fight with the overlay's dim layer. */
  highlightedAnchorId: string | null;
  setHighlightedAnchorId: (id: string | null) => void;
  /** True from the moment Reset Guided Tour is pressed until Home is
   * confirmed focused. The tour must not visually activate (and must not
   * paint over whatever screen the reset was pressed from) until then. */
  pendingStart: boolean;
  confirmPendingStart: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);
const ANALYTICS_TOUR_STEPS = ['tour_1', 'tour_2', 'tour_3', 'tour_4', 'tour_5', 'tour_6', 'tour_7', 'tour_8'] as const;

export function TourProvider({ canStart, children }: { canStart: boolean; children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const [mascotName, setMascotName] = useState(getFoxDisplayName(null));
  const [persistedStatus, setPersistedStatus] = useState<TourPersistedStatus>('not_started');
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [remeasureVersion, setRemeasureVersion] = useState(0);
  const anchorsRef = useRef(new Map<string, RefObject<View | null>>());
  const scrollRefsRef = useRef(new Map<TourScrollableScreen, RefObject<ScrollView | null>>());
  const scrollOffsetsRef = useRef(new Map<TourScrollableScreen, number>());
  const actionsRef = useRef(new Map<string, () => void>());
  const [externallyPaused, setExternallyPaused] = useState(false);
  const [highlightedAnchorId, setHighlightedAnchorId] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState(false);
  const transitionLockedRef = useRef(false);
  const previouslyActiveRef = useRef(false);
  const lastTrackedStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (active && !previouslyActiveRef.current) {
      track(analyticsEvents.GUIDED_TOUR_STARTED, { flow: 'guided_tour' });
      lastTrackedStepRef.current = null;
    }
    if (!active) lastTrackedStepRef.current = null;
    previouslyActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active || lastTrackedStepRef.current === stepIndex) return;
    lastTrackedStepRef.current = stepIndex;
    track(analyticsEvents.GUIDED_TOUR_STEP_VIEWED, {
      flow: 'guided_tour',
      step: ANALYTICS_TOUR_STEPS[Math.min(stepIndex, ANALYTICS_TOUR_STEPS.length - 1)] ?? 'tour_1',
    });
  }, [active, stepIndex]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      tourPersistence.readStatus().catch((): TourPersistedStatus => 'not_started'),
      onboardingV3Persistence.readChosenMascotName().catch(() => null),
    ])
      .then(([status, savedMascotName]) => {
        if (!isMounted) return;
        setPersistedStatus(status);
        setMascotName(getFoxDisplayName(savedMascotName));
        setHydrated(true);
      })
      .catch(() => { if (isMounted) setHydrated(true); });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => subscribeToMascotName(() => {
    void onboardingV3Persistence.readChosenMascotName()
      .then((name) => setMascotName(getFoxDisplayName(name)))
      .catch(() => undefined);
  }), []);

  useEffect(() => {
    if (!shouldStartTour({ authReady: canStart, homeReady, hydrated, pendingStart, status: persistedStatus })) {
      if (!canStart || persistedStatus !== 'not_started') setActive(false);
      return;
    }
    setActive(true);
  }, [canStart, homeReady, hydrated, pendingStart, persistedStatus]);

  const reportHomeReady = useCallback(() => setHomeReady(true), []);

  const next = useCallback(() => {
    setStepIndex((current) => {
      const nextIndex = current + 1;
      if (nextIndex >= TOUR_STEP_COUNT) {
        track(analyticsEvents.GUIDED_TOUR_COMPLETED, { flow: 'guided_tour', action: 'completed' });
        setActive(false);
        setPersistedStatus('completed');
        void tourPersistence.writeStatus('completed');
        return current;
      }
      return nextIndex;
    });
  }, []);

  const beginStepTransition = useCallback(() => {
    if (transitionLockedRef.current) return false;
    transitionLockedRef.current = true;
    return true;
  }, []);
  const releaseStepTransition = useCallback(() => {
    transitionLockedRef.current = false;
  }, []);

  const skip = useCallback(() => {
    track(analyticsEvents.GUIDED_TOUR_SKIPPED, { flow: 'guided_tour', result: 'skipped' });
    transitionLockedRef.current = false;
    setActive(false);
    setPersistedStatus('skipped');
    void tourPersistence.writeStatus('skipped');
  }, []);

  const done = useCallback(() => {
    track(analyticsEvents.GUIDED_TOUR_COMPLETED, { flow: 'guided_tour', action: 'completed' });
    transitionLockedRef.current = false;
    setActive(false);
    setPersistedStatus('completed');
    void tourPersistence.writeStatus('completed');
  }, []);

  // Reset Guided Tour arms step one after persistence is cleared. The overlay
  // still has a route guard, so if Settings has not finished navigating yet it
  // stays hidden; as soon as Home is focused it measures and appears. Keeping
  // the activation in the provider (rather than relying on a one-shot route
  // effect) also works when MainTabs stays mounted across tab changes.
  const devReset = useCallback(() => {
    transitionLockedRef.current = false;
    void tourPersistence.resetStatus().then(() => {
      setPersistedStatus('not_started');
      setStepIndex(0);
      setPendingStart(true);
      setActive(false);
    });
  }, []);

  const confirmPendingStart = useCallback(() => {
    setPendingStart(false);
  }, []);

  const registerAnchor = useCallback((id: string, ref: RefObject<View | null>) => {
    anchorsRef.current.set(id, ref);
  }, []);
  const unregisterAnchor = useCallback((id: string) => {
    anchorsRef.current.delete(id);
  }, []);
  const getAnchor = useCallback((id: string) => anchorsRef.current.get(id), []);

  const registerScrollRef = useCallback((screen: TourScrollableScreen, ref: RefObject<ScrollView | null>) => {
    scrollRefsRef.current.set(screen, ref);
  }, []);
  const getScrollRef = useCallback((screen: TourScrollableScreen) => scrollRefsRef.current.get(screen), []);

  const reportScrollOffset = useCallback((screen: TourScrollableScreen, offsetY: number) => {
    scrollOffsetsRef.current.set(screen, offsetY);
  }, []);
  const getScrollOffset = useCallback((screen: TourScrollableScreen) => scrollOffsetsRef.current.get(screen) ?? 0, []);

  const requestRemeasure = useCallback(() => {
    setRemeasureVersion((v) => v + 1);
  }, []);

  const registerAction = useCallback((id: string, fn: () => void) => {
    actionsRef.current.set(id, fn);
  }, []);
  const unregisterAction = useCallback((id: string) => {
    actionsRef.current.delete(id);
  }, []);
  const getAction = useCallback((id: string) => actionsRef.current.get(id), []);

  const value = useMemo<TourContextValue>(() => ({
    hydrated,
    homeReady,
    reportHomeReady,
    mascotName,
    active,
    stepIndex,
    next,
    beginStepTransition,
    releaseStepTransition,
    skip,
    done,
    devReset,
    registerAnchor,
    unregisterAnchor,
    getAnchor,
    registerScrollRef,
    getScrollRef,
    reportScrollOffset,
    getScrollOffset,
    remeasureVersion,
    requestRemeasure,
    registerAction,
    unregisterAction,
    getAction,
    externallyPaused,
    setExternallyPaused,
    highlightedAnchorId,
    setHighlightedAnchorId,
    pendingStart,
    confirmPendingStart,
  }), [active, beginStepTransition, confirmPendingStart, devReset, done, externallyPaused, getAction, getAnchor, getScrollOffset, getScrollRef, highlightedAnchorId, homeReady, hydrated, mascotName, next, pendingStart, registerAction, registerAnchor, registerScrollRef, releaseStepTransition, remeasureVersion, reportHomeReady, reportScrollOffset, requestRemeasure, skip, stepIndex, unregisterAction, unregisterAnchor]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
}

/** Registers a target view as a tour anchor. Attach the returned ref to the real component being highlighted — no coordinates are hard-coded. */
export function useTourAnchor(id: string): RefObject<View | null> {
  const ref = useRef<View | null>(null);
  const { registerAnchor, unregisterAnchor } = useTour();

  useEffect(() => {
    registerAnchor(id, ref);
    return () => unregisterAnchor(id);
  }, [id, registerAnchor, unregisterAnchor]);

  return ref;
}
