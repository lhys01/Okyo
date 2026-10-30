export type TourRect = { x: number; y: number; width: number; height: number };
export type SpotlightShape = 'capsule' | 'rounded' | 'circle' | 'pill';
export type ShapedTourRect = TourRect & { borderRadius: number; noBorder?: boolean };

const DEFAULT_SPOTLIGHT_PADDING = 4;
const DEFAULT_CARD_RADIUS = 18;

export function isValidTourRect(rect: TourRect | null | undefined): rect is TourRect {
  return Boolean(
    rect
      && Number.isFinite(rect.x)
      && Number.isFinite(rect.y)
      && Number.isFinite(rect.width)
      && Number.isFinite(rect.height)
      && rect.width > 0
      && rect.height > 0,
  );
}

/** Converts a real window-space measurement into the smallest matching mask. */
export function shapeSpotlightRect(rect: TourRect, shape: SpotlightShape, padding = DEFAULT_SPOTLIGHT_PADDING): ShapedTourRect {
  const padded = {
    height: rect.height + padding * 2,
    width: rect.width + padding * 2,
    x: rect.x - padding,
    y: rect.y - padding,
  };

  if (shape === 'circle') {
    const diameter = Math.max(padded.width, padded.height);
    return {
      borderRadius: diameter / 2,
      height: diameter,
      noBorder: true,
      width: diameter,
      x: padded.x + (padded.width - diameter) / 2,
      y: padded.y + (padded.height - diameter) / 2,
    };
  }

  return {
    ...padded,
    borderRadius: shape === 'capsule' || shape === 'pill' ? padded.height / 2 : DEFAULT_CARD_RADIUS,
  };
}

/** A complete target must fit in the portion of the screen the guide does not cover. */
export function isFullyInsideViewport(rect: TourRect, viewport: UsableViewport, margin = 0): boolean {
  return isValidTourRect(rect)
    && rect.y >= viewport.top + margin
    && rect.y + rect.height <= viewport.bottom - margin;
}

/** A stale async callback must never commit geometry for a newer step. */
export function isCurrentMeasurement(token: number, currentToken: number, stepIndex: number, currentStepIndex: number): boolean {
  return token === currentToken && stepIndex === currentStepIndex;
}

/** Dismissal controls are deliberately not tied to spotlight preparation. */
export function canDismissTour(): boolean {
  return true;
}

/** Next remains single-fire while the next target is being prepared. */
export function canAdvanceTourStep(preparing: boolean, hasRequiredSpotlight = true): boolean {
  return !preparing && hasRequiredSpotlight;
}

/** There is intentionally no visual step counter in the guided tour. */
export function shouldRenderTourProgress(): boolean {
  return false;
}

/**
 * Whether a measured target is visible enough to spotlight as-is — "on
 * screen at all", not "perfectly centered". A target sitting naturally near
 * the top of the ScrollView (like the Home calendar, right under the
 * greeting) must count as visible.
 *
 * Root cause of the tour never opening: this used to require the target's
 * top edge to sit a further ~140px below the safe-area inset before
 * accepting it. The calendar's real position never satisfies that, there is
 * nowhere further to scroll (it is already at the top), so the overlay
 * looped its bounded scroll-and-retry forever and never reached
 * setReady(true) — the tour stayed active but permanently invisible.
 */
export function isTargetOnScreen(rect: TourRect, insetsTop: number, bottomBound: number): boolean {
  return rect.y + rect.height > insetsTop && rect.y < bottomBound;
}

/**
 * The single gate deciding whether the overlay paints anything at all.
 *
 * `stepIndex` (and the message/copy derived from it) update synchronously
 * the instant Next/Skip fires. The measured spotlight rects only catch up
 * asynchronously, after a fade-out + navigate + measure round trip.
 * `readyStepIndex` is stamped onto the *last step whose rects were actually
 * committed* — requiring it to equal the live `stepIndex` is what makes it
 * impossible to ever paint one step's copy over another step's stale
 * spotlight (the exact bug this fixes: Grocery's text rendering while the
 * Calendar's rect was still on screen).
 */
export function shouldRenderTourStep(params: {
  active: boolean;
  paused: boolean;
  ready: boolean;
  readyStepIndex: number;
  stepIndex: number;
}): boolean {
  return params.active && !params.paused && params.ready && params.readyStepIndex === params.stepIndex;
}

export interface UsableViewport {
  /** First y-coordinate (screen space) not covered by the top progress bar. */
  top: number;
  /** Last y-coordinate (screen space) not covered by the fixed coach dock. */
  bottom: number;
}

/**
 * The "focus stage": the screen-space band a spotlighted target must land in
 * — below the top progress bar, above the fixed coach dock. Because the
 * coach dock never moves or resizes (that is the whole point of the
 * persistent shell), this is a fixed band for the entire tour, not something
 * recomputed per step.
 */
export function computeUsableViewport(params: {
  insetsTop: number;
  screenHeight: number;
  headerHeight: number;
  /** Total footprint of the fixed coach dock, from the screen's bottom edge
   * up past its top edge (dock bottom-offset + dock height). */
  footerHeight: number;
  margin: number;
}): UsableViewport {
  return {
    bottom: params.screenHeight - params.footerHeight - params.margin,
    top: params.insetsTop + params.headerHeight + params.margin,
  };
}

/**
 * How far (in screen-space points, same units `measureInWindow` returns) a
 * scrollable target needs to move so the whole rect sits inside `viewport`
 * with `edgeMargin` of breathing room on both sides. Returns null when the
 * rect already fits — callers must not scroll in that case, matching the
 * "don't just center everything" rule: a target that already fits stays
 * exactly where the user left it.
 *
 * Positive means "scroll further down" (add to the current content offset);
 * negative means "scroll up". Because `measureInWindow` reports window-space
 * coordinates, this same magnitude is the correct delta to add to whatever
 * the ScrollView's current content offset already is.
 */
export function computeScrollDelta(rect: TourRect, viewport: UsableViewport, edgeMargin: number): number | null {
  const topBound = viewport.top + edgeMargin;
  const bottomBound = viewport.bottom - edgeMargin;

  if (rect.y >= topBound && rect.y + rect.height <= bottomBound) return null;
  if (rect.y < topBound) return rect.y - topBound;
  return rect.y + rect.height - bottomBound;
}
