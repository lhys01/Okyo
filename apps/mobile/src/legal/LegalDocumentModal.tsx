import { NavArrowLeft } from 'iconoir-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies, spacing } from '../theme/okyoTheme';
import { LegalDocumentView } from './LegalDocumentView';
import { getLegalDocument, type LegalDocumentId } from './legalDocuments';

/**
 * Presents a legal document from anywhere that has no navigator — specifically
 * the onboarding paywall, where App Store Review Guideline 3.1.2 requires the
 * Terms and Privacy Policy to be reachable *before* a purchase, and onboarding
 * has not yet handed control to the tab navigator.
 *
 * Nothing about onboarding routing changes: this is a modal layered over the
 * current screen, dismissed back to exactly where it was opened from.
 */
export function LegalDocumentModal({
  documentId,
  onClose,
}: {
  documentId: LegalDocumentId | null;
  onClose: () => void;
}) {
  const document = documentId ? getLegalDocument(documentId) : undefined;
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(document)}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.back}
          >
            <NavArrowLeft color={colors.ink} height={25} width={25} />
          </Pressable>
          {/* Runtime finding: at accessibility text sizes an unconstrained header
              title wrapped up into the status bar. The body text below scales
              freely — only this fixed-height chrome row is capped. */}
          <Text numberOfLines={1} style={styles.headerTitle}>{document?.title ?? ''}</Text>
        </View>
        {document ? <LegalDocumentView document={document} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 10,
  },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 },
  headerTitle: { color: colors.ink, flex: 1, fontFamily: fontFamilies.extraBold, fontSize: 20 },
});
