// Okyo design tokens — aligned with the May 2025 brand guidelines.
// The existing semantic names are preserved so current screens do not break.

export const colors = {
  // Core brand palette
  sunsetPink: '#FF8BAE',
  sunnyYellow: '#FFD64A',
  mintGreen: '#8FE3C6',
  skyBlue: '#81C7FF',
  lavender: '#C7B3FF',
  stoneCream: '#FFF4E6',
  softCharcoal: '#2B2B30',

  // Existing semantic aliases used throughout the app
  background: '#FFF4E6',
  card: '#FFFFFF',
  cream: '#FFF4E6',
  creamDeep: '#F4E5CF',

  coral: '#FF8BAE',
  coralDark: '#E86F91',
  coralSoft: '#FFF0F4',

  green: '#318F6B',
  greenSoft: '#E8F8F1',

  charcoal: '#2B2B30',
  body: '#57545E',
  muted: '#89858F',
  border: '#EEE4D6',
  danger: '#C94A5E',
};

export const spacing = {
  screen: 24,
  section: 36,
  card: 20,
};

export const radius = {
  hero: 32,
  card: 24,
  panel: 20,
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
  display: 'Sora_800ExtraBold',
  body: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
} as const;

// Sora is the official Okyo brand typeface.
// The brand guide calls for approximately -2% letter spacing.
export const typography = {
  display: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 40,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
    lineHeight: 48,
  },

  hero: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.68,
    lineHeight: 42,
  },

  title: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.56,
    lineHeight: 35,
  },

  heading: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
    lineHeight: 27,
  },

  body: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.16,
    lineHeight: 24,
  },

  caption: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: -0.13,
    lineHeight: 18,
  },

  button: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.16,
    lineHeight: 22,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: colors.softCharcoal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },

  hero: {
    shadowColor: colors.softCharcoal,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
};

