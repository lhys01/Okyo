import { useNavigation } from '@react-navigation/native';
import { NavArrowLeft, NavArrowRight } from 'iconoir-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalDocumentModal } from '../legal/LegalDocumentModal';
import { legalDocuments, type LegalDocumentId } from '../legal/legalDocuments';
import { colors, fontFamilies, spacing } from '../theme/okyoTheme';

/** Settings and onboarding render exactly the same versioned registry. */
export function LegalScreen() {
  const navigation = useNavigation();
  const [documentId, setDocumentId] = useState<LegalDocumentId | null>(null);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" style={styles.back}
          onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }}>
          <NavArrowLeft color={colors.ink} height={25} width={25} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Legal & privacy</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {legalDocuments.map((document) => (
          <Pressable key={document.id} accessibilityLabel={document.title} accessibilityRole="button"
            onPress={() => setDocumentId(document.id)} style={styles.row}>
            <Text style={styles.label}>{document.title}</Text>
            <NavArrowRight color={colors.muted} height={18} width={18} />
          </Pressable>
        ))}
      </ScrollView>
      <LegalDocumentModal documentId={documentId} onClose={() => setDocumentId(null)} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: spacing.gutter, paddingVertical: 10 },
  back: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22, flex: 1 },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 150 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingVertical: 16, gap: 12 },
  label: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 16, flex: 1 },
});
