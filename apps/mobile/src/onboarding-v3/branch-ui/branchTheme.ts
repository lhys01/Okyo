import { colors, homeRecipeCardShadow, radius, spacing } from '../../theme/okyoTheme';

// Shared visual language for the development-preview goal branches. Every value
// resolves to an existing Okyo token so the branches match the real app.

export type BranchId = 'save_money' | 'eat_healthier' | 'hit_macros';

export type BranchPalette = Readonly<{
  /** Branch identity colour. Used for bars, icon tiles, and large numerals. */
  accent: string;
  /** Tinted fill behind accent content. Always safe under ink-coloured text. */
  accentSoft: string;
  /** Full-bleed ground for the emotional interstitial moments. */
  ground: string;
}>;

export const branchPalettes: Readonly<Record<BranchId, BranchPalette>> = Object.freeze({
  save_money: { accent: colors.savings, accentSoft: colors.savingsSoft, ground: colors.savingsSoft },
  eat_healthier: { accent: colors.health, accentSoft: colors.healthSoft, ground: colors.healthSoft },
  // Macros uses the same coral action language as the rest of Okyo. Macro
  // categories may use restrained supporting tints inside data visuals, but
  // selection, progress, and calls to action must never look like a separate
  // purple product.
  hit_macros: { accent: colors.coral, accentSoft: colors.coralSoft, ground: colors.canvas },
});

// The primary action colour for onboarding. Coral, never charcoal.
export const BRANCH_CTA_COLOR = colors.coral;

export const branchSurfaces = Object.freeze({
  card: colors.surface,
  cardBorder: colors.border,
  cardRadius: radius.card,
  tileRadius: radius.panel,
  gutter: spacing.gutter,
  // Body text stays ink/body coloured on every surface so contrast never
  // depends on the branch accent.
  ink: colors.ink,
  body: colors.body,
  muted: colors.muted,
} as const);

/** The exact native elevation used by the Today’s ideas recipe cards. */
export const onboardingShadow = homeRecipeCardShadow;
export const onboardingElevation = onboardingShadow;

/** Compatibility alias for the existing V3 branch-ui components. */
export const branchShadow = onboardingElevation;
