import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScanImageMetadata } from '../../api/types';
import { ScanEntryOptions } from '../../components/ScanEntryOptions';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { MAX_MEAL_DESCRIPTION_LENGTH, validateMealDescription } from '../../utils/mealDescription';
import { preparePickedImage } from '../../utils/scanImageProcessing';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { OnboardingV4ScanInputMethod } from '../state/onboardingV4Draft';

type Props = {
  priorityEcho: string;
  description: string;
  onDescriptionChange: (value: string) => void;
  onMethodSelected: (method: OnboardingV4ScanInputMethod) => void;
  onImageSelected: (method: 'camera' | 'library', image: ScanImageMetadata) => void;
  onDescriptionSubmitted: (description: string) => void;
  onBack: () => void;
  onCameraPermissionPrompted?: () => void;
  onCameraPermissionResult?: (granted: boolean) => void;
};

/**
 * Step 07's first-scan entry screen. Does NOT request camera permission on
 * mount — `ImagePicker.requestCameraPermissionsAsync()` is only ever called
 * from inside `handleTakePhoto`, after the user taps "Take a photo". The
 * library flow deliberately skips any explicit permission call: modern
 * `launchImageLibraryAsync` presents the OS's own limited-access picker
 * (PHPicker on iOS, the Android 13+ photo picker) without requiring a
 * broad photo-library grant, so requesting one here would ask for more
 * access than the platform picker itself needs.
 *
 * Stores only the selected method + normalized description text in V4
 * draft-visible state (via the callbacks below, wired to reducer dispatches
 * in OnboardingV4.tsx) — the picked image binary is held in OnboardingV4.tsx's
 * component state only, never persisted, and the analysis API is never
 * called from here (Step 08's job).
 */
export function FirstScanEntryScreen({ priorityEcho, description, onDescriptionChange, onMethodSelected, onImageSelected, onDescriptionSubmitted, onBack, onCameraPermissionPrompted, onCameraPermissionResult }: Props) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleTakePhoto = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onMethodSelected('camera');
      onCameraPermissionPrompted?.();
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      onCameraPermissionResult?.(permission.granted);
      if (!permission.granted) {
        setError('Camera access is needed to take a photo. You can enable it in Settings, or use Upload a photo or Describe a dish instead.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const image = await preparePickedImage(asset, 'camera');
      onImageSelected('camera', image);
    } catch {
      setError('Okyo could not open the camera. Try again, or use Upload a photo or Describe a dish instead.');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onMethodSelected('library');
      // No requestMediaLibraryPermissionsAsync() call — the system picker
      // itself handles access without a broad grant. Cancellation (below)
      // returns safely to this screen with no side effect.
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const image = await preparePickedImage(asset, 'photos');
      onImageSelected('library', image);
    } catch {
      setError('Okyo could not open your photos. Try again, or use Take a photo or Describe a dish instead.');
    } finally {
      setBusy(false);
    }
  };

  const handleDescribeDish = () => {
    onMethodSelected('description');
    setDescriptionOpen((open) => !open);
  };

  const submitDescription = () => {
    const validationError = validateMealDescription(description);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onDescriptionSubmitted(description.trim());
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Let's make your first recipe.</Text>
          <Text style={styles.body}>Okyo will aim for {priorityEcho}.</Text>

          <ScanEntryOptions
            appearance="onboarding"
            describeLabel="Describe a dish"
            labelFontFamily={fontFamilies.bold}
            onDescribeMeal={handleDescribeDish}
            onTakePhoto={() => void handleTakePhoto()}
            onUpload={() => void handleUploadPhoto()}
          />

          {descriptionOpen ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>Describe the dish</Text>
              <TextInput
                accessibilityLabel="Dish description"
                maxLength={MAX_MEAL_DESCRIPTION_LENGTH}
                multiline
                onChangeText={onDescriptionChange}
                placeholder="A crispy chicken sandwich with spicy sauce"
                placeholderTextColor={colors.muted}
                style={styles.input}
                testID="scan-entry-description-input"
                textAlignVertical="top"
                value={description}
              />
              <Text style={styles.counter}>{description.length}/{MAX_MEAL_DESCRIPTION_LENGTH}</Text>
              <OnboardingCTA label="Continue" onPress={submitDescription} testID="scan-entry-description-continue" />
            </View>
          ) : null}

          {error ? (
            <View accessibilityLiveRegion="polite" style={styles.errorCard}>
              <Text style={styles.errorTitle}>Let's try that again</Text>
              <Text style={styles.errorText}>{error}</Text>
              {/permission|access|settings/i.test(error) ? (
                <Pressable accessibilityLabel="Open device settings" accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.settingsLink}>
                  <Text style={styles.settingsText}>Open Settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {busy ? <Text accessibilityLiveRegion="polite" style={styles.busy}>Preparing photo…</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 24, paddingTop: 18 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 30, letterSpacing: -0.5, lineHeight: 36 },
  body: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 22, marginTop: 10 },
  descriptionCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 24, borderWidth: 1, marginTop: 18, padding: 18 },
  descriptionLabel: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 16, marginBottom: 10 },
  input: { backgroundColor: colors.background, borderRadius: 16, color: colors.charcoal, fontFamily: fontFamilies.body, fontSize: 16, minHeight: 116, padding: 14 },
  counter: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, marginBottom: 14, marginTop: 6, textAlign: 'right' },
  errorCard: { backgroundColor: '#FFF5F2', borderColor: '#F1C4B9', borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 16 },
  errorTitle: { color: colors.danger, fontFamily: fontFamilies.bold, fontSize: 15 },
  errorText: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, marginTop: 5 },
  settingsLink: { alignSelf: 'flex-start', marginTop: 10, minHeight: 44, justifyContent: 'center' },
  settingsText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 14, textDecorationLine: 'underline' },
  busy: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13, marginTop: 14, textAlign: 'center' },
});
