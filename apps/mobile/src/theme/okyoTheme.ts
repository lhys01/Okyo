// Okyo design tokens — editorial pass. Most screens consume these through the
// re-exports in components/OkyoUI.tsx, so importing from either place is fine.

export const colors = {
  background: '#faf7f0',
  card: '#ffffff',
  cream: '#f6efe2',
  creamDeep: '#eadfcb',
  coral: '#e9552f',
  coralDark: '#c2401f',
  coralSoft: '#fdeee7',
  green: '#1d7a4d',
  greenSoft: '#e9f5ee',
  charcoal: '#1c1813',
  body: '#575047',
  muted: '#8e867b',
  border: '#efe8db',
  danger: '#a33524',
};

export const spacing = {
  screen: 24,
  section: 36,
  card: 20,
};

export const layout = {
  // Clearance under scroll content so the floating tab bar never covers it.
  scrollClearance: 140,
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
    lineHeight: 50,
  },
  title: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 36,
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
  caption: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#4a3a28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  hero: {
    shadowColor: '#4a3a28',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
};
