import * as ImagePicker from 'expo-image-picker';
import { ArrowRight, BookStack, Camera, MagicWand } from 'iconoir-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScanImageMetadata } from '../../api/types';
import { ScanEntryOptions } from '../../components/ScanEntryOptions';
import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../theme/okyoTheme';
import { MAX_MEAL_DESCRIPTION_LENGTH, validateMealDescription } from '../../utils/mealDescription';
import { requestPermissionWithNotice } from '../../privacy/requestPermissionWithNotice';
import { getScanImageProcessingErrorMessage, preparePickedImage } from '../../utils/scanImageProcessing';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { getKikoOnboardingAssignment } from '../assets/kikoOnboardingRegistry';
import { KikoOnboardingArtwork } from '../components/KikoOnboardingArtwork';

export function ScanInputScreen({
  userName,
  errorMessage,
  onBack,
  onPermissionDenied,
  onPhotoSelected,
  onDescriptionSubmitted,
}: {
  userName: string;
  errorMessage: string | null;
  onBack: () => void;
  onPermissionDenied: (message: string) => void;
  onPhotoSelected: (image: ScanImageMetadata) => Promise<void>;
  onDescriptionSubmitted: (description: string) => void;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choosePhoto = async (source: 'camera' | 'photos') => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      // Okyo's own explanation always runs before the OS prompt — see
      // privacy/permissionNotices.ts.
      const outcome = source === 'camera'
        ? await requestPermissionWithNotice('camera', ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync)
        : await requestPermissionWithNotice('photos', ImagePicker.getMediaLibraryPermissionsAsync, ImagePicker.requestMediaLibraryPermissionsAsync);
      if (outcome !== 'granted') {
        if (outcome === 'denied') {
          onPermissionDenied(`Photo access is needed to use ${source === 'camera' ? 'the camera' : 'your library'}. You can enable it in Settings, or describe the dish instead.`);
        }
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const image = await preparePickedImage(asset, source);
      await onPhotoSelected(image);
    } catch (error) {
      setLocalError(getScanImageProcessingErrorMessage(error, 'Okyo could not open that photo. Try again, or describe the dish instead.'));
    } finally {
      setBusy(false);
    }
  };

  const submitDescription = () => {
    const validationError = validateMealDescription(description);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    onDescriptionSubmitted(description.trim());
  };

  const visibleError = localError ?? errorMessage;
  const postPurchaseKiko = getKikoOnboardingAssignment('shared', 'post-purchase-first-scan');
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.heroRow}>
            {postPurchaseKiko?.assetId && postPurchaseKiko.size === 'hero' ? (
              <KikoOnboardingArtwork assetId={postPurchaseKiko.assetId} sizeRole="hero" style={styles.postPurchaseKiko} />
            ) : null}
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Okyo Pro unlocked</Text>
              <Text style={styles.title}>Let's try it with your food{userName ? `, ${userName}` : ''}.</Text>
            </View>
          </View>
          <Text style={styles.body}>Choose a prepared dish you'd like to recreate. This is your first real Okyo scan.</Text>

          <ScanEntryOptions
            appearance="onboarding"
            compact
            describeLabel="Describe a dish"
            labelFontFamily={fontFamilies.bold}
            onTakePhoto={() => void choosePhoto('camera')}
            onUpload={() => void choosePhoto('photos')}
            onDescribeMeal={() => setDescriptionOpen((open) => !open)}
          />

          {!descriptionOpen ? (
            <View accessibilityLabel="A prepared dish becomes a personalized recipe" accessibilityRole="image" style={styles.visualGuide}>
              <View style={styles.visualCopy}>
                <Text style={styles.visualEyebrow}>Your dish, decoded</Text>
                <View style={styles.visualFlow}>
                  <View style={styles.visualIcon}><Camera color={colors.coralDark} height={22} strokeWidth={2.3} width={22} /></View>
                  <ArrowRight color={colors.muted} height={18} width={18} />
                  <View style={[styles.visualIcon, styles.recipeIcon]}><BookStack color={colors.green} height={22} strokeWidth={2.3} width={22} /></View>
                </View>
                <Text style={styles.visualText}>Prepared dish to editable recipe</Text>
              </View>
              <MagicWand color="#E8A653" height={25} style={styles.wand} width={25} />
            </View>
          ) : null}

          {descriptionOpen ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>Describe the dish</Text>
              <TextInput
                accessibilityLabel="Dish description"
                maxLength={MAX_MEAL_DESCRIPTION_LENGTH}
                multiline
                onChangeText={setDescription}
                placeholder="A crispy chicken sandwich with spicy sauce"
                placeholderTextColor={colors.muted}
                style={styles.input}
                textAlignVertical="top"
                value={description}
              />
              <Text style={styles.counter}>{description.length}/{MAX_MEAL_DESCRIPTION_LENGTH}</Text>
              <OnboardingCTA label="Analyze dish" onPress={submitDescription} />
            </View>
          ) : null}

          {visibleError ? (
            <View accessibilityLiveRegion="polite" style={styles.errorCard}>
              <Text style={styles.errorTitle}>Let's try that again</Text>
              <Text style={styles.errorText}>{visibleError}</Text>
              {/permission|access|settings/i.test(visibleError) ? (
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
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  heroCopy: { flex: 1 },
  postPurchaseKiko: { marginLeft: -18, marginRight: -18 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { ...onboardingTitleFont, color: colors.charcoal, fontSize: 35, letterSpacing: -1, lineHeight: 41, marginTop: 9 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, fontWeight: '500', lineHeight: 22, marginTop: 10 },
  visualGuide: { backgroundColor: '#F7E8DC', borderColor: '#EAD7C7', borderRadius: 26, borderWidth: 1, height: 136, marginTop: 16, overflow: 'hidden', padding: 17, position: 'relative' },
  visualCopy: { width: '67%' },
  visualEyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 10, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase' },
  visualFlow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 9 },
  visualIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, height: 40, justifyContent: 'center', width: 40 },
  recipeIcon: { backgroundColor: '#EDF7E8' },
  visualText: { color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 11.5, fontWeight: '600', marginTop: 8 },
  wand: { position: 'absolute', right: 96, top: 12 },
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
