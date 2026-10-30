export type ScanImageResize = { height?: number; width?: number };

/**
 * Returns a proportional resize for the longest side. Bounding only width
 * lets tall phone photos keep an enormous height and exceed the upload limit.
 */
export function getScanImageResize(width: number, height: number, maxDimension: number): ScanImageResize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || maxDimension <= 0) {
    return null;
  }

  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) return null;

  return width >= height
    ? { width: Math.round(maxDimension) }
    : { height: Math.round(maxDimension) };
}
