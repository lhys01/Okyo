import { StyleSheet } from 'react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../../theme/okyoTheme';

export const pageStyles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: {
    alignSelf: 'stretch',
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 35,
    marginTop: 12,
    textAlign: 'center',
  },
  body: {
    alignSelf: 'center',
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginTop: 9,
    maxWidth: 350,
    textAlign: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.charcoal,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
