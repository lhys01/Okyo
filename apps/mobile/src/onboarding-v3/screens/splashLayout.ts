const KIKO_MARK_ASPECT_RATIO = 143 / 132;

export const SPLASH_MARK_MAX_WIDTH = 96;

export function getSplashMarkSize(screenWidth: number) {
  const safeWidth = Math.max(0, screenWidth);
  const responsiveRatio = 0.24;
  const width = Math.min(SPLASH_MARK_MAX_WIDTH, safeWidth * responsiveRatio);

  return {
    width,
    height: width / KIKO_MARK_ASPECT_RATIO,
  };
}
