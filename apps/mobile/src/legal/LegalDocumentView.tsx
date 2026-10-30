import { Fragment } from 'react';
import { Alert, Linking, PixelRatio, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';
import { type LegalDocument } from './legalDocuments';
import { openSupportEmail, SUPPORT_EMAIL } from '../support/supportContact';

/**
 * Renders one legal document as plain, scrollable, selectable text.
 *
 * Deliberately not a WebView and never an image of a document: real text so it
 * follows the system text size, can be read by VoiceOver, and can be copied.
 * `allowFontScaling` is left at its default (on) everywhere and no font size is
 * capped, so Dynamic Type works at every setting.
 *
 * Every `lineHeight` here is multiplied by the system font scale. React Native
 * scales `fontSize` with Dynamic Type but leaves a hardcoded `lineHeight`
 * untouched, so at accessibility text sizes a fixed line height is smaller than
 * the glyphs and consecutive lines overlap and clip. Found on an iPhone 17 Pro
 * at "accessibility extra large"; see docs/compliance/evidence/.
 *
 * Hosted by `screens/LegalScreen.tsx` (from the Legal & Privacy centre) and by
 * `legal/LegalDocumentModal.tsx` (from the onboarding paywall, which has to be
 * reachable before onboarding finishes).
 */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const fontScale = PixelRatio.getFontScale();
  const scaledLine = (base: number) => ({ lineHeight: base * fontScale });
  const emailSupport = () => {
    void openSupportEmail((url) => Linking.openURL(url)).catch(() => {
      Alert.alert('Email Okyo support', `Please email ${SUPPORT_EMAIL}.`);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
      <Text accessibilityRole="header" style={[styles.title, scaledLine(34)]}>{document.title}</Text>
      <Text style={[styles.meta, scaledLine(18)]}>
        Version {document.version} · {document.effectiveDate}
      </Text>


      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.heading, scaledLine(23)]}>{section.heading}</Text>
          <Text selectable style={[styles.body, scaledLine(23)]}>
            {section.body.split(SUPPORT_EMAIL).map((part, index, parts) => (
              <Fragment key={`${section.heading}-${index}`}>
                {part}
                {index < parts.length - 1 ? (
                  <Text accessibilityLabel="Email Okyo support." accessibilityRole="link" onPress={emailSupport} style={styles.supportEmail}>
                    {SUPPORT_EMAIL}
                  </Text>
                ) : null}
              </Fragment>
            ))}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 160, paddingHorizontal: spacing.gutter },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, marginTop: 6 },
  meta: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 13, marginTop: 6 },
  section: { marginTop: 26 },
  heading: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, marginTop: 8 },
  supportEmail: { color: colors.health, textDecorationLine: 'underline' },
});
