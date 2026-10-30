import type { MainTabParamList } from '../navigation/types';
import { getFoxDisplayName } from '../state/foxDisplayName';

export type TourStepId =
  | 'intro'
  | 'home-calendar'
  | 'home-savings-macros'
  | 'home-recommended'
  | 'home-add-scan'
  | 'grocery-list'
  | 'saved-meals'
  | 'finish';

export type TourStepScreen = keyof Pick<MainTabParamList, 'HomeScreen' | 'GroceryListScreen' | 'LibraryScreen'> | null;

/** How the dim overlay cuts a hole around a measured target. All are expressible as a rect + borderRadius, so no SVG path math is needed for the border/glow — only the dim mask needs a true shape cut. */
export type SpotlightShape = 'capsule' | 'rounded' | 'circle' | 'pill';

export interface TourTarget {
  /** Anchor id registered by the real component via useTourAnchor(anchorId). */
  anchorId: string;
  shape: SpotlightShape;
  /**
   * A real alternative for a state where the primary control does not exist.
   * This is deliberately data-driven: the overlay never invents an invisible
   * button just to make the tour look complete.
   */
  alternatives?: readonly Omit<TourTarget, 'alternatives'>[];
}

export interface TourStep {
  id: TourStepId;
  /** Tab screen this step lives on. null means no specific anchor (finish). */
  screen: TourStepScreen;
  /** Short bold coachmark title. */
  title: string;
  /** One short supporting sentence, under ~14 words. */
  body: string;
  /** One or more real targets spotlighted together as a compound mask — never one bounding box around unrelated space. */
  targets: readonly TourTarget[];
  /** No spotlighted anchor — the coach dock stays, but nothing is cut out. */
  isFinish?: boolean;
}

/** Resolve only anchors that are actually mounted; alternatives are used for
 * the populated Liked state without inventing a placeholder control. */
export function resolveTourTargets(step: TourStep, hasAnchor: (anchorId: string) => boolean): readonly TourTarget[] {
  return step.targets.map((target) => {
    const candidates = [target, ...(target.alternatives ?? [])];
    return candidates.find((candidate) => hasAnchor(candidate.anchorId)) ?? target;
  });
}

/** Return only the targets that are mounted in the current screen state. */
export function resolveMountedTourTargets(step: TourStep, hasAnchor: (anchorId: string) => boolean): readonly TourTarget[] {
  return resolveTourTargets(step, hasAnchor).filter((target) => hasAnchor(target.anchorId));
}

/**
 * Some tour targets are mirrored by a control that owns its own native layer
 * (the floating scan button). Prefer that control as the published highlight
 * while still allowing the overlay to cut holes for every mounted target.
 */
export function getHighlightedTourAnchorId(targets: readonly TourTarget[]): string | null {
  return targets.find((target) => target.anchorId === 'home-add-scan')?.anchorId
    ?? targets[0]?.anchorId
    ?? null;
}

/**
 * Kiko and the coach dock are the same for every step — the persistent shell
 * owns that geometry once (see CoachDock.tsx), not per-step config. This
 * keeps the data purely about WHAT is being taught, never WHERE the mascot
 * or card render.
 */
const TOUR_STEP_DEFINITIONS: readonly TourStep[] = [
  {
    id: 'intro',
    screen: 'HomeScreen',
    title: '',
    body: '',
    targets: [],
  },
  {
    id: 'home-calendar',
    screen: 'HomeScreen',
    title: '',
    body: 'Tap a day to plan your week.',
    targets: [{ anchorId: 'home-calendar', shape: 'capsule' }],
  },
  {
    id: 'home-savings-macros',
    screen: 'HomeScreen',
    title: '',
    body: 'Your savings and progress live here.',
    targets: [{ anchorId: 'home-savings-macros', shape: 'rounded' }],
  },
  {
    id: 'home-recommended',
    screen: 'HomeScreen',
    title: '',
    body: 'Recipes picked for you appear here.',
    targets: [{ anchorId: 'home-recommended-section', shape: 'rounded' }],
  },
  {
    id: 'grocery-list',
    screen: 'GroceryListScreen',
    title: '',
    body: 'Scan a dish to start your grocery list.',
    targets: [{ anchorId: 'grocery-tab', shape: 'rounded' }],
  },
  {
    id: 'saved-meals',
    screen: 'LibraryScreen',
    title: '',
    body: 'Save recipes here so they\'re easy to find.',
    targets: [{
      anchorId: 'liked-explore-recipes',
      shape: 'pill',
      alternatives: [{ anchorId: 'liked-first-saved-recipe', shape: 'rounded' }],
    }],
  },
  {
    id: 'home-add-scan',
    screen: 'HomeScreen',
    title: '',
    body: 'Tap + to scan, upload, or describe a dish.',
    targets: [
      { anchorId: 'home-first-use-scan', shape: 'pill' },
      { anchorId: 'home-add-scan', shape: 'circle' },
    ],
  },
  {
    id: 'finish',
    screen: 'HomeScreen',
    title: '',
    body: 'You\'re ready. Let\'s find your first dish.',
    targets: [],
    isFinish: true,
  },
] as const;

export function buildFoxIntroduction(mascotName?: string | null): string {
  return `Hi, I’m ${getFoxDisplayName(mascotName)}. I’ll show you around.`;
}

export function getTourSteps(mascotName?: string | null): readonly TourStep[] {
  return TOUR_STEP_DEFINITIONS.map((step) => step.id === 'intro'
    ? { ...step, body: buildFoxIntroduction(mascotName) }
    : step);
}

/** Default copy for callers that only need stable tour structure. */
export const TOUR_STEPS = getTourSteps();
export const TOUR_STEP_COUNT = TOUR_STEPS.length;

/** Screens the tour ever navigates to. A route outside this set means the user drilled into a detail screen from a highlighted target — the tour pauses rather than losing progress. */
export const TOUR_SCREENS: readonly NonNullable<TourStepScreen>[] = ['HomeScreen', 'GroceryListScreen', 'LibraryScreen'];
