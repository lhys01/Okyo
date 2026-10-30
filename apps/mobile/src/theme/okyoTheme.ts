// Okyo Design System V2 tokens. Existing semantic aliases remain during the
// staged migration so untouched screens keep compiling.

export const colors = {
  canvas: '#fffdfe',
  canvasSunk: '#F4E5CF',
  surface: '#FFFFFF',
  surfaceMuted: '#FFFCF8',
  savingsChartGrid: '#E9E5DF',
  savingsSliderTrack: '#F1EEEA',
  ink: '#2B2B30',
  body: '#57545E',
  muted: '#89858F',
  border: '#EEE4D6',
  danger: '#C94A5E',

  coral: '#FF8BAE',
  coralDark: '#E86F91',
  coralSoft: '#FFF0F4',
  sunny: '#FFD64A',

  savings: '#2F8F5B',
  savingsSoft: '#E8F6EE',
  health: '#E1746C',
  healthSoft: '#FDEDE9',
  mint: '#8FE3C6',
  macros: '#6B5BD2',
  macrosSoft: '#F0EDFC',
  macroProtein: '#E1746C',
  macroCarbs: '#E9A23B',
  macroFat: '#6B9ED2',

  // Compatibility aliases.
  sunsetPink: '#FF8BAE',
  sunnyYellow: '#FFD64A',
  mintGreen: '#8FE3C6',
  skyBlue: '#81C7FF',
  lavender: '#C7B3FF',
  stoneCream: '#fffdfe',
  softCharcoal: '#2B2B30',
  background: '#fffdfe',
  card: '#FFFFFF',
  cream: '#fffdfe',
  creamDeep: '#F4E5CF',
  green: '#2F8F5B',
  greenSoft: '#E8F6EE',
  charcoal: '#2B2B30',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 40,
  gutter: 20,
  scrollClearance: 96,
  // Compatibility aliases.
  screen: 24,
  card: 20,
} as const;

export const radius = {
  hero: 32,
  card: 24,
  panel: 20,
  chip: 999,
  glass: 34,
  button: 999,
  pill: 999,
} as const;

export const fontSizes = {
  display: 34,
  hero: 34,
  title: 26,
  body: 16,
  caption: 12,
} as const;

export const iconSizes = {
  small: 16,
  medium: 20,
  large: 24,
  feature: 32,
} as const;

// Manrope is the single typeface for the entire app. There is no static
// "black" weight, so ExtraBold (800) covers every role that previously used
// the heaviest weight available — weight tokens below are capped at '800' to
// match so the OS never synthesises an unavailable heavier face on top of the
// loaded file.
export const fontFamilies = {
  display: 'Manrope_800ExtraBold',
  body: 'Manrope_500Medium',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
  numeric: 'Manrope_800ExtraBold',
  // Numeric display remains a distinct role, but uses the same approved
  // Manrope family so metrics never introduce a second visual voice.
  expressiveNumeric: 'Manrope_800ExtraBold',
} as const;

/** Shared top-level tab heading, matched to the Settings screen. */
export const mainTabHeading = {
  color: colors.ink,
  fontFamily: fontFamilies.extraBold,
  fontSize: 28,
  letterSpacing: -0.4,
  lineHeight: 34,
} as const;

// Onboarding-only typography. The onboarding flow (src/onboarding-v3/**) renders
// entirely in Manrope, same as the rest of the app; every onboarding style
// reaches its face through this map or through onboardingTitleFont below, so
// flipping these values is the only change needed. Nothing outside onboarding
// imports this map — it exists to keep onboarding's font references decoupled
// from the global `fontFamilies` map, not to diverge from it.
export const onboardingFontFamilies = {
  personalizedDisplay: 'Manrope_800ExtraBold',
  display: 'Manrope_800ExtraBold',
  body: 'Manrope_500Medium',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;

// Onboarding title face. Every onboarding screen spreads this token then sets its
// own fontSize/lineHeight. It follows onboardingFontFamilies.extraBold (Manrope
// ExtraBold); fontWeight 'normal' stops the OS synthesising an unavailable
// heavier face from the already-ExtraBold file, keeping the rendered weight
// identical to before.
export const onboardingTitleFont = {
  fontFamily: onboardingFontFamilies.extraBold,
  fontWeight: 'normal' as const,
} as const;

const tabularNums: ('tabular-nums')[] = ['tabular-nums'];

export const typography = {
  displayExpressive: { color: colors.ink, fontFamily: fontFamilies.expressiveNumeric, fontSize: 44, fontWeight: '800' as const, lineHeight: 46 },
  display: { color: colors.ink, fontFamily: fontFamilies.display, fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.68, lineHeight: 38 },
  hero: { color: colors.ink, fontFamily: fontFamilies.display, fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.68, lineHeight: 38 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.52, lineHeight: 32 },
  section: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.19, lineHeight: 25 },
  heading: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.19, lineHeight: 25 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySmall: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodyEmphasis: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 15, fontWeight: '700' as const, lineHeight: 22 },
  cardTitle: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 16, fontWeight: '700' as const, lineHeight: 22 },
  label: { color: colors.muted, fontFamily: fontFamilies.semibold, fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.72, lineHeight: 16, textTransform: 'uppercase' as const },
  caption: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  captionSmall: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11, fontWeight: '500' as const, lineHeight: 15 },
  buttonSmall: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 14, fontWeight: '700' as const, lineHeight: 20 },
  button: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700' as const, lineHeight: 22 },
  numericHero: { color: colors.ink, fontFamily: fontFamilies.expressiveNumeric, fontSize: 76, fontWeight: '800' as const, lineHeight: 76 },
  numericHeroAlt: { color: colors.ink, fontFamily: fontFamilies.display, fontSize: 56, fontVariant: tabularNums, fontWeight: '800' as const, lineHeight: 60 },
  numericLarge: { color: colors.ink, fontFamily: fontFamilies.numeric, fontSize: 34, fontVariant: tabularNums, fontWeight: '800' as const, lineHeight: 40 },
  numericStat: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 20, fontVariant: tabularNums, fontWeight: '700' as const, lineHeight: 24 },
};

export const shadows = {
  card: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 13,
    elevation: 5,
  },
  float: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  // Compatibility alias.
  hero: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
  },
} as const;

// Light, grounded card lift. Required by the restored onboarding AttributionPage
// (reference screen "How did you hear about Okyo?") which imports this token —
// without it the restored onboarding will not compile.
export const homeRecipeCardShadow = {
  shadowColor: '#4A4850',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.2,
  shadowRadius: 0.85,
  elevation: 2,
} as const;
