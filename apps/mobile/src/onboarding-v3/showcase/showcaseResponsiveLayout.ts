export const COMPACT_SHOWCASE_USABLE_HEIGHT = 760;

export type ShowcaseResponsiveLayout = Readonly<{
  compact: boolean;
  usableHeight: number;
  headlineSize: number;
  headlineLineHeight: number;
  bodyLineHeight: number;
  fontScale: number;
  heroHeight: number;
  framePaddingTop: number;
  artworkTextGap: number;
  titleMarginTop: number;
  contentBottomPadding: number;
}>;

export function getShowcaseResponsiveLayout({
  windowHeight,
  topInset,
  bottomInset,
  fontScale: requestedFontScale,
}: {
  windowHeight: number;
  topInset: number;
  bottomInset: number;
  fontScale?: number;
}): ShowcaseResponsiveLayout {
  const usableHeight = Math.max(0, windowHeight - topInset - bottomInset);
  const fontScale = Math.max(1, requestedFontScale ?? 1);
  const compact = usableHeight < COMPACT_SHOWCASE_USABLE_HEIGHT || (fontScale > 1.2 && usableHeight < 850);

  return Object.freeze({
    compact,
    usableHeight,
    // Keep the existing full-size artwork on 16e/17 Pro. Only the short
    // viewport uses a smaller artwork slot; copy remains at its established
    // readable size and can scroll independently of the pinned CTA.
    headlineSize: 27,
    headlineLineHeight: 31 * fontScale,
    bodyLineHeight: 19 * fontScale,
    fontScale,
    heroHeight: compact ? 250 : 430,
    framePaddingTop: compact ? 8 : 16,
    artworkTextGap: compact ? 8 : 14,
    titleMarginTop: compact ? 8 : 16,
    contentBottomPadding: 16,
  });
}
