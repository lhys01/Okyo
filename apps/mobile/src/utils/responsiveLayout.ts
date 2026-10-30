/** Compact loading artwork stays prominent without consuming the whole viewport. */
export function getScanLoadingVisualHeight(windowHeight: number): number {
  const safeHeight = Number.isFinite(windowHeight) ? windowHeight : 667;
  return Math.min(280, Math.max(190, Math.round(safeHeight * 0.34)));
}

/** Keep the photo-confirmation preview visible above its fixed actions on short phones. */
export function getScanPhotoPreviewHeight(windowHeight: number): number {
  const safeHeight = Number.isFinite(windowHeight) ? windowHeight : 667;
  return Math.min(330, Math.max(180, Math.round(safeHeight * 0.37)));
}

export function getNameFoxLayout(windowHeight: number): { artworkHeight: number; contentTop: number } {
  const safeHeight = Number.isFinite(windowHeight) ? windowHeight : 667;
  return {
    artworkHeight: Math.min(350, Math.round(safeHeight * 0.43)),
    contentTop: Math.min(190, Math.max(132, Math.round(safeHeight * 0.25))),
  };
}

/** Clearance for the floating scan FAB and tab pill above a scroll tail. */
export function getMainTabScrollClearance(bottomInset: number): number {
  const safeInset = Number.isFinite(bottomInset) ? Math.max(0, bottomInset) : 0;
  return 160 + safeInset;
}

/** Bottom breathing room for focused recipe pages where the floating tabs are hidden. */
export function getRecipeScrollBottomPadding(bottomInset: number): number {
  const safeInset = Number.isFinite(bottomInset) ? Math.max(0, bottomInset) : 0;
  return 24 + safeInset;
}

/** Three onboarding goal choices fit together on short phones; text can still grow and scroll. */
export function getOnboardingGoalCardLayout(windowHeight: number): { minHeight: number; paddingVertical: number; gap: number } {
  const compact = Number.isFinite(windowHeight) && windowHeight < 860;
  return compact
    ? { minHeight: 136, paddingVertical: 16, gap: 12 }
    : { minHeight: 176, paddingVertical: 20, gap: 14 };
}
