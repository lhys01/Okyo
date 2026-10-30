export type AnalysisScreenLayout = {
  compact: boolean;
  imageHeight: number;
  iconSize: number;
};

export function getAnalysisScreenLayout(
  windowHeight: number,
  topInset: number,
  bottomInset: number,
): AnalysisScreenLayout {
  const availableHeight = Math.max(0, windowHeight - topInset - bottomInset);
  const compact = availableHeight < 700;

  return {
    compact,
    imageHeight: Math.min(compact ? 220 : 340, Math.max(compact ? 170 : 230, availableHeight * (compact ? 0.3 : 0.35))),
    iconSize: compact ? 82 : 104,
  };
}
