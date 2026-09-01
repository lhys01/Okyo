// Okyo Design System V2 tokens. Existing semantic aliases remain during the
// staged migration so untouched screens keep compiling.

export const colors = {
  canvas: '#fffdfe',
  canvasSunk: '#F4E5CF',
  surface: '#FFFFFF',
  surfaceMuted: '#FFFCF8',
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

export const fontFamilies = {
  display: 'Inter_900Black',
  body: 'Inter_500Medium',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_900Black',
  numeric: 'Inter_800ExtraBold',
  // Numeric display remains a distinct role, but uses the same approved
  // Inter family so metrics never introduce a second visual voice.
  expressiveNumeric: 'Inter_900Black',
} as const;

export const onboardingFontFamilies = {
  personalizedDisplay: fontFamilies.expressiveNumeric,
  display: fontFamilies.display,
  body: fontFamilies.body,
  medium: fontFamilies.medium,
  semibold: fontFamilies.semibold,
  bold: fontFamilies.bold,
  extraBold: fontFamilies.extraBold,
} as const;

// Onboarding title face. Every restored stage2 onboarding screen spreads this
// token then sets its own fontSize/lineHeight, so it must exist here for the
// restored onboarding to compile. Uses the shared Inter extraBold alias — no Sora.
export const onboardingTitleFont = {
  fontFamily: onboardingFontFamilies.extraBold,
  fontWeight: 'normal' as const,
} as const;

const tabularNums: ('tabular-nums')[] = ['tabular-nums'];

export const typography = {
  displayExpressive: { color: colors.ink, fontFamily: fontFamilies.expressiveNumeric, fontSize: 44, fontWeight: '900' as const, lineHeight: 46 },
  display: { color: colors.ink, fontFamily: fontFamilies.display, fontSize: 34, fontWeight: '900' as const, letterSpacing: -0.68, lineHeight: 38 },
  hero: { color: colors.ink, fontFamily: fontFamilies.display, fontSize: 34, fontWeight: '900' as const, letterSpacing: -0.68, lineHeight: 38 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.52, lineHeight: 32 },
  section: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.19, lineHeight: 25 },
  heading: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.19, lineHeight: 25 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySmall: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  label: { color: colors.muted, fontFamily: fontFamilies.semibold, fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.72, lineHeight: 16, textTransform: 'uppercase' as const },
  caption: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  button: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700' as const, lineHeight: 22 },
  numericHero: { color: colors.ink, fontFamily: fontFamilies.expressiveNumeric, fontSize: 76, fontWeight: '900' as const, lineHeight: 76 },
  numericHeroAlt: { color: colors.ink, fontFamily: fontFamilies.display, fontSize: 56, fontVariant: tabularNums, fontWeight: '900' as const, lineHeight: 60 },
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
