import { fontFamilies } from './okyoTheme';

// One visual language for every guided-cooking step. Layout may adapt to the
// amount of content, but the type scale never changes from step to step.
export const guidedCookingTypography = {
  nav: { fontFamily: fontFamilies.extraBold, fontSize: 15, fontWeight: '800' as const },
  progress: { fontFamily: fontFamilies.bold, fontSize: 12, fontWeight: '700' as const },
  title: { fontFamily: fontFamilies.display, fontSize: 27, fontWeight: '800' as const, lineHeight: 33 },
  instruction: { fontFamily: fontFamilies.body, fontSize: 17, fontWeight: '500' as const, lineHeight: 25 },
  sectionLabel: { fontFamily: fontFamilies.extraBold, fontSize: 10, fontWeight: '800' as const, letterSpacing: 1 },
  chip: { fontFamily: fontFamilies.bold, fontSize: 12, fontWeight: '700' as const },
  upNext: { fontFamily: fontFamilies.bold, fontSize: 13, fontWeight: '700' as const, lineHeight: 18 },
  button: { fontFamily: fontFamilies.extraBold, fontSize: 15, fontWeight: '800' as const },
  primaryButton: { fontFamily: fontFamilies.extraBold, fontSize: 16, fontWeight: '900' as const },
} as const;
