// Semantic registry for the transparent Kiko variants.
// Sticker PNGs use the user-approved redraws from 2026-10-25.
// See docs/audits/KIKO_STICKER_MIGRATION_2026-10-25.md for the source mapping.

export const kikoTransparent = {
  sittingSide: require('./kiko-sitting-side-sticker.png'),
  sittingFront: require('./kiko-sitting-front-sticker.png'),
  standingReady: require('./kiko-standing-ready-sticker.png'),
  pawRaised: require('./kiko-paw-raised-sticker.png'),
  curious: require('./kiko-curious-sticker.png'),
  thoughtful: require('./kiko-thoughtful-sticker.png'),
  holdingBowl: require('./kiko-holding-bowl-sticker.png'),
  cheer: require('./kiko-cheer-sticker.png'),
} as const;

export type KikoPose = keyof typeof kikoTransparent;

export function kikoSource(pose: KikoPose) {
  return kikoTransparent[pose];
}
