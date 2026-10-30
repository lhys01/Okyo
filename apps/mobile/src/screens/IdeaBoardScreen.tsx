import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft } from 'iconoir-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitIdea } from '../api/client';
import type { MainTabParamList } from '../navigation/types';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Category = 'idea' | 'improvement' | 'bug';
const categories: ReadonlyArray<{ id: Category; label: string }> = [
  { id: 'idea', label: 'New idea' },
  { id: 'improvement', label: 'Improvement' },
  { id: 'bug', label: 'Something broken' },
];

export function IdeaBoardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainTabParamList>>();
  const [category, setCategory] = useState<Category>('idea');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSend = message.trim().length >= 8 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await submitIdea(category, message.trim());
      setMessage('');
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t send your idea. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to Settings" accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <NavArrowLeft color={colors.ink} height={24} width={24} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Idea board</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sent ? <View style={styles.success} accessibilityRole="alert"><Text style={styles.successTitle}>Thanks for helping shape Okyo!</Text><Text style={styles.helper}>Your note was sent to the team.</Text><Pressable onPress={() => setSent(false)} style={styles.another}><Text style={styles.anotherText}>Send another idea</Text></Pressable></View> : <>
          <Text style={styles.intro}>What would make cooking with Okyo better? Tell us what you’d love to see.</Text>
          <Text style={styles.label}>WHAT’S ON YOUR MIND?</Text>
          <View accessibilityRole="radiogroup" style={styles.categories}>
            {categories.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={[styles.category, category === item.id && styles.categorySelected]}><Text style={[styles.categoryText, category === item.id && styles.categoryTextSelected]}>{item.label}</Text></Pressable>)}
          </View>
          <TextInput accessibilityLabel="Your idea" maxLength={1000} multiline onChangeText={setMessage} placeholder="I wish Okyo could…" placeholderTextColor={colors.muted} style={styles.input} textAlignVertical="top" value={message} />
          <Text style={styles.helper}>Please leave out personal details. {message.length}/1000</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => void send()} style={[styles.send, !canSend && styles.sendDisabled]}>{sending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.sendText}>Send idea</Text>}</Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 }, flex: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 },
  content: { paddingBottom: 150, paddingHorizontal: spacing.gutter, paddingTop: spacing.md },
  intro: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginBottom: spacing.xl },
  label: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.8, marginBottom: spacing.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  category: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.chip, borderWidth: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: 14 },
  categorySelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  categoryText: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 13 },
  categoryTextSelected: { color: colors.coralDark },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, color: colors.ink, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, minHeight: 170, padding: spacing.lg },
  helper: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  error: { color: colors.danger, fontFamily: fontFamilies.medium, fontSize: 13, marginTop: spacing.md },
  send: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: radius.button, justifyContent: 'center', marginTop: spacing.xl, minHeight: 52 },
  sendDisabled: { opacity: 0.45 }, sendText: { color: colors.surface, fontFamily: fontFamilies.bold, fontSize: 16 },
  success: { backgroundColor: colors.coralSoft, borderRadius: radius.panel, padding: spacing.xl },
  successTitle: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 20 },
  another: { alignSelf: 'flex-start', marginTop: spacing.xl }, anotherText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 15 },
});
