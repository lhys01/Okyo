// Okyo design tokens — Kiko pastel companion pass. This is the ONLY source of design
// tokens (colors, spacing, radius, typography, shadows, surfaces, layout).
// OkyoUI.tsx must not re-export these — import tokens from here directly.
//
// Material language (three layers, applied consistently):
//   canvas — warm ivory background
//   card   — soft white surface + hairline warm border + soft warm shadow
//   glass  — translucent fill + blur, reserved for floating chrome only
//     (tab bar, floating headers, sheets). Scrolling content never blurs.

export const colors = {
  background: '#F6F2EB',
  card: '#FFFDF8',
  cardWarm: '#FFF9F1',
  cream: '#F6F2EB',
  creamDeep: '#E9DEC9',
  coral: '#F36F7D',
  coralDark: '#B84A54',
  coralSoft: '#FFE8E8',
  green: '#2F7D54',
  greenSoft: '#E5F7ED',
  charcoal: '#242631',
  body: '#55505B',
  // AA at caption sizes on the ivory canvas (≥4.5:1). Use mutedSoft only for
  // decorative/disabled elements, never for text that must be read.
  muted: '#706B75',
  mutedSoft: '#918A95',
  border: '#ECE3D8',
  borderStrong: '#DED1C1',
  danger: '#A84242',
  dangerSoft: '#F9E4E4',
  // Neutral supporting tones for "why this matters" / practical-info blocks
  // and low-key caution callouts (guided cooking, cook-coach tips).
  info: '#39708A',
  infoSoft: '#E7F4FB',
  cautionSoft: '#FFF3CF',
  onCoral: '#FFFDF8',
  // Glass chrome (tab bar, floating headers, sheets).
  glassFill: 'rgba(255, 253, 248, 0.78)',
  glassStroke: 'rgba(255, 255, 255, 0.78)',
  scrim: 'rgba(36, 38, 49, 0.35)',
};

// Decorative-only pastels for ambient art. Keep these behind readable
// surfaces and text; they are not semantic UI colors.
export const ambientColors = {
  pink: '#FFB6C1',
  peach: '#FFC9A6',
  yellow: '#FFE59A',
  mint: '#C8F0D6',
  blue: '#B8E6FF',
  lavender: '#D9C8FF',
} as const;

export const gradients = {
  primary: ['#FF9AAE', '#FFD166', '#9ADBC0', '#9FD0FF'] as const,
  soft: ['#FFE8E8', '#FFF3CF', '#E5F7ED', '#E7F4FB'] as const,
  celebration: ['#FFB6C1', '#FFE59A', '#C8F0D6', '#B8E6FF', '#D9C8FF'] as const,
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
  hero: 8,
  card: 8,
  panel: 8,
  chip: 8,
  button: 12,
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
  display: 'Sora_800ExtraBold',
  body: 'Sora_400Regular',
  bold: 'Sora_700Bold',
  semiBold: 'Sora_600SemiBold',
  extraBold: 'Sora_800ExtraBold',
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
    shadowColor: '#514334',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  // Barely-there lift for dense lists (grocery rows, menu rows).
  soft: {
    shadowColor: '#514334',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  // Hero moments: scan results, big imagery, celebration cards.
  hero: {
    shadowColor: '#514334',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  // Warm glow under the primary coral CTA.
  cta: {
    shadowColor: '#F36F7D',
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
