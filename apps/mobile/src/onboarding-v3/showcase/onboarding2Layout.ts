export const ONBOARDING2_SOURCE_SIZE = Object.freeze({ width: 852, height: 1847 });

export type ImageFrame = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type NormalizedRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const onboarding2HitTargets = Object.freeze({
  getStarted: { x: 0.25, y: 0.805, width: 0.5, height: 0.07 },
  account: { x: 0.25, y: 0.855, width: 0.5, height: 0.07 },
  terms: { x: 0.3, y: 0.91, width: 0.22, height: 0.07 },
  privacy: { x: 0.52, y: 0.91, width: 0.24, height: 0.07 },
} satisfies Record<string, NormalizedRect>);

export function getCoverImageFrame(containerWidth: number, containerHeight: number): ImageFrame {
  const safeWidth = Math.max(0, containerWidth);
  const safeHeight = Math.max(0, containerHeight);
  if (safeWidth === 0 || safeHeight === 0) return { left: 0, top: 0, width: 0, height: 0 };

  const scale = Math.max(
    safeWidth / ONBOARDING2_SOURCE_SIZE.width,
    safeHeight / ONBOARDING2_SOURCE_SIZE.height,
  );
  const width = ONBOARDING2_SOURCE_SIZE.width * scale;
  const height = ONBOARDING2_SOURCE_SIZE.height * scale;
  return {
    left: (safeWidth - width) / 2,
    top: (safeHeight - height) / 2,
    width,
    height,
  };
}

export function mapNormalizedRect(frame: ImageFrame, rect: NormalizedRect): ImageFrame {
  return {
    left: frame.left + rect.x * frame.width,
    top: frame.top + rect.y * frame.height,
    width: rect.width * frame.width,
    height: rect.height * frame.height,
  };
}
