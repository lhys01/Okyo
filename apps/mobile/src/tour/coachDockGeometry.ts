/**
 * The coach dock's fixed geometry — plain numeric constants, deliberately
 * kept in a file with NO React Native import. `CoachDock.tsx` and
 * `TourOverlay.tsx` both import these; `tourGeometry.test.ts` also imports
 * them directly, which only works because this file stays RN-free (React
 * Native's own entry point uses Flow syntax that plain Node can't parse).
 */
export const KIKO_SIZE = 84;
export const KIKO_OUTLINE_THICKNESS = 6;
export const KIKO_OVERLAP = 26;

export const COACH_DOCK_HORIZONTAL_INSET = 18;
/** Keep the panel clear of the right-side floating scan button. */
export const COACH_DOCK_RIGHT_INSET = 106;
export const COACH_DOCK_MAX_WIDTH = 300;
/** Content determines the card's height. This is only the conservative
 * initial estimate used before its first layout callback. */
export const COACH_DOCK_ESTIMATED_HEIGHT = 108;
/** Floating tab bar footprint (34 + 70) plus a compact 12px breathing gap. */
export const COACH_DOCK_BOTTOM_OFFSET = 34 + 70 + 12;
/** Extra scrollable tail used only while the fixed tour dock is present.
 * It lets the final Home card clear both the card and Kiko without changing
 * the ordinary Home layout or relying on a device-specific offset. */
export const COACH_DOCK_TARGET_CLEARANCE = (KIKO_SIZE - KIKO_OVERLAP) + 24;
