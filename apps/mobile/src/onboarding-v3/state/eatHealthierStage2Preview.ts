export function isEatHealthierStage2PreviewEnabled(dev = typeof __DEV__ !== 'undefined' && __DEV__, envValue = process.env.EXPO_PUBLIC_OKYO_EAT_HEALTHIER_STAGE2_PREVIEW) {
  return dev === true && envValue === 'true';
}
