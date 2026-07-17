// Okyo design tokens — "warm cookbook" pass. This is the ONLY source of design
// tokens (colors, spacing, radius, typography, shadows, surfaces, layout).
// OkyoUI.tsx must not re-export these — import tokens from here directly.
//
// Material language (three layers, applied consistently):
//   canvas — warm ivory background
//   card   — soft white surface + hairline warm border + soft warm shadow
//   glass  — translucent fill + blur, reserved for floating chrome only
//     (tab bar, floating headers, sheets). Scrolling content never blurs.

export const colors = {
  background: '#faf7f0',
  card: '#ffffff',
  cardWarm: '#fffdf8',
  cream: '#f6efe2',
  creamDeep: '#eadfcb',
  coral: '#e9552f',
  coralDark: '#c2401f',
  coralSoft: '#fdeee7',
  green: '#1d7a4d',
  greenSoft: '#e9f5ee',
  charcoal: '#1c1813',
  body: '#575047',
  // AA at caption sizes on the ivory canvas (≥4.5:1). Use mutedSoft only for
  // decorative/disabled elements, never for text that must be read.
  muted: '#6f675c',
  mutedSoft: '#8e867b',
  border: '#efe8db',
  borderStrong: '#e3dac9',
  danger: '#a33524',
  dangerSoft: '#f9e8e3',
  // Neutral supporting tones for "why this matters" / practical-info blocks
  // and low-key caution callouts (guided cooking, cook-coach tips).
  info: '#46707c',
  infoSoft: '#e9f1f2',
  cautionSoft: '#f9efce',
  onCoral: '#fffdf8',
  // Glass chrome (tab bar, floating headers, sheets).
  glassFill: 'rgba(255, 253, 248, 0.72)',
  glassStroke: 'rgba(255, 255, 255, 0.78)',
  scrim: 'rgba(28, 24, 19, 0.35)',
};

// Decorative-only pastels for ambient art. Keep these behind readable
// surfaces and text; they are not semantic UI colors.
export const ambientColors = {
  pink: '#f5b7cf',
  peach: '#f8c7a8',
  yellow: '#f7e19d',
  mint: '#bee2cf',
  blue: '#bedcee',
  lavender: '#d7c7ec',
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  screen: 24,
  section: 36,
  card: 20,
};

export const radius = {
  hero: 32,
  card: 24,
  panel: 20,
  chip: 16,
  button: 999,
  pill: 999,
};

export const fontSizes = {
  display: 40,
  hero: 34,
  title: 28,
  body: 16,
  caption: 13,
};

export const fontFamilies = {
  display: 'Baloo2_800ExtraBold',
  body: 'Nunito_400Regular',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
} as const;

// Editorial type presets. Spread into StyleSheet entries:
//   title: { ...typography.title }
export const typography = {
  display: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 48,
  },
  hero: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 41,
  },
  title: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 35,
  },
  heading: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 26,
  },
  body: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  // Sentence-case supporting label. Replaces the old uppercase-tracked
  // eyebrow treatment — hierarchy comes from weight and color, not caps.
  label: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  caption: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
} as const;

export const shadows = {
  // Resting card on the ivory canvas.
  card: {
    shadowColor: '#4a3a28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  // Barely-there lift for dense lists (grocery rows, menu rows).
  soft: {
    shadowColor: '#4a3a28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  // Hero moments: scan results, big imagery, celebration cards.
  hero: {
    shadowColor: '#4a3a28',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  // Warm glow under the primary coral CTA.
  cta: {
    shadowColor: '#e9552f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
};

// The one card recipe: spread into any surface that should read as a card.
export const surfaces = {
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    ...shadows.card,
  },
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.panel,
    ...shadows.soft,
  },
  tint: {
    backgroundColor: colors.cream,
    borderRadius: radius.panel,
  },
  // Layered translucent surface for chips/badges sitting on top of imagery or
  // other cards — reads as soft glass without reaching for blur.
  glassChip: {
    backgroundColor: colors.glassFill,
    borderColor: colors.glassStroke,
    borderWidth: 1,
    borderRadius: radius.chip,
  },
} as const;

export const layout = {
  // Clearance under scroll content so the floating tab bar never covers it.
  scrollClearance: 140,
  screenGutter: spacing.screen,
};

// Ingredient-avatar category tints (recipe detail ingredient list). Produce
// and protein reuse the core green/coral soft tones; the rest are dedicated
// warm neutrals with no other equivalent in the core palette.
export const ingredientAvatar = {
  produce: colors.greenSoft,
  protein: colors.coralSoft,
  dairy: '#f8efd8',
  grain: '#f1e4cf',
  sauce: '#f7e7df',
  pantry: '#eee7dc',
  default: '#f5eee4',
};
