export function isHitMacrosStage2PreviewEnabled(dev = typeof __DEV__ !== 'undefined' && __DEV__, envValue = process.env.EXPO_PUBLIC_OKYO_HIT_MACROS_STAGE2_PREVIEW) {
  return dev === true && envValue === 'true';
}
