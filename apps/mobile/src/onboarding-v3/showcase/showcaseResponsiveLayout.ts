export const COMPACT_SHOWCASE_USABLE_HEIGHT = 700;

export type ShowcaseResponsiveLayout = Readonly<{
  compact: boolean;
  usableHeight: number;
  headlineSize: number;
  headlineLineHeight: number;
  bodyLineHeight: number;
  heroHeight: number;
}>;

export function getShowcaseResponsiveLayout({
  windowHeight,
  topInset,
  bottomInset,
}: {
  windowHeight: number;
  topInset: number;
  bottomInset: number;
}): ShowcaseResponsiveLayout {
  const usableHeight = Math.max(0, windowHeight - topInset - bottomInset);
  const compact = usableHeight < COMPACT_SHOWCASE_USABLE_HEIGHT;

  return Object.freeze({
    compact,
    usableHeight,
    headlineSize: compact ? 27 : 30,
    headlineLineHeight: compact ? 31 : 35,
    bodyLineHeight: compact ? 20 : 22,
    heroHeight: compact ? 250 : Math.min(360, usableHeight * 0.45),
  });
}
