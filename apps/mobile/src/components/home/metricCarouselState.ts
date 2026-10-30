export function getMetricCarouselIndex(offsetX: number, pageExtent: number, itemCount: number): number {
  if (itemCount <= 0 || !Number.isFinite(offsetX) || !Number.isFinite(pageExtent) || pageExtent <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, Math.round(Math.max(0, offsetX) / pageExtent)));
}
