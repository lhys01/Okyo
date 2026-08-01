import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { NavArrowLeft, Sparks } from 'iconoir-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { MAX_MEAL_DESCRIPTION_LENGTH, validateMealDescription } from '../utils/mealDescription';
import { startScan } from '../utils/scanController';
import { getHomeResetState } from '../utils/scanControllerUtils';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'DescribeMealScreen'>;
type DescribeMealRoute = RouteProp<RootStackParamList, 'DescribeMealScreen'>;

export function DescribeMealScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<DescribeMealRoute>();
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const [description, setDescription] = useState(route.params?.initialDescription ?? '');
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const generate = async () => {
    const mealDescription = description.trim();
    const validationError = validateMealDescription(description);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      await startScan({
        mealDescription, mode: selectedMode,
        navigateToAnalysis: (scanSessionId) => navigation.navigate('AnalysisLoadingScreen', { scanSessionId }),
        reason: 'DescribeMealScreen.generate', source: 'description',
        onSettled: () => { submitting.current = false; },
      });
    } catch {
      submitting.current = false;
      setError('Okyo could not start that recipe. Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => navigation.reset(getHomeResetState())} style={styles.back}>
          <NavArrowLeft color={colors.charcoal} height={22} width={22} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.icon}><Sparks color={colors.coral} height={26} width={26} /></View>
        <Text style={styles.title}>Describe a meal</Text>
        <Text style={styles.subtitle}>Give Okyo a few details and it will build a homemade recipe.</Text>
        <TextInput
          accessibilityLabel="Meal description"
          multiline
          maxLength={MAX_MEAL_DESCRIPTION_LENGTH}
          onChangeText={setDescription}
          placeholder="A crispy chicken sandwich with spicy sauce"
          placeholderTextColor={colors.muted}
          style={styles.input}
          textAlignVertical="top"
          value={description}
        />
        <Text style={styles.counter}>{description.length}/{MAX_MEAL_DESCRIPTION_LENGTH}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => void generate()} style={styles.generate}>
          <Text style={styles.generateText}>Generate recipe</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: 24 },
  back: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 44 },
  backText: { color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 16 },
  icon: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 999, height: 52, justifyContent: 'center', width: 52 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 30, marginTop: 18 },
  subtitle: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginTop: 10 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20, borderWidth: 1, color: colors.charcoal, fontFamily: fontFamilies.body, fontSize: 17, height: 150, marginTop: 24, padding: 16 },
  counter: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, marginTop: 6, textAlign: 'right' },
  error: { color: colors.danger, fontFamily: fontFamilies.medium, fontSize: 14, marginTop: 12 },
  generate: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 999, minHeight: 56, justifyContent: 'center', marginTop: 22 },
  generateText: { color: '#fffdf8', fontFamily: fontFamilies.bold, fontSize: 16 },
});
