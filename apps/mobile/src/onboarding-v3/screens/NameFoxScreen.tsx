import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { MASCOT_NAME_MAX_LENGTH, sanitizeMascotName } from '../state/mascotName';
import { pickRandomMascotName } from '../state/mascotNameSuggestions';
import { getNameFoxLayout } from '../../utils/responsiveLayout';

const NAME_INPUT_MAX_FONT_SIZE = 22;
const NAME_INPUT_MIN_FONT_SIZE = 16;
const NAME_INPUT_HORIZONTAL_PADDING = 8;
const NAME_INPUT_AVERAGE_GLYPH_WIDTH = 0.66;

/**
 * Fits a name to the actual rendered field width instead of a particular
 * phone width, including names restored after a later app launch.
 */
export function getResponsiveNameInputFontSize(name: string, fieldWidth: number): number {
  if (fieldWidth <= 0) return NAME_INPUT_MAX_FONT_SIZE;
  const characterCount = Math.max(Array.from(name.trim() || 'Kiko').length, 4);
  const availableWidth = Math.max(fieldWidth - NAME_INPUT_HORIZONTAL_PADDING * 2, 1);
  const fittedSize = Math.floor(availableWidth / (characterCount * NAME_INPUT_AVERAGE_GLYPH_WIDTH));
  return Math.min(NAME_INPUT_MAX_FONT_SIZE, Math.max(NAME_INPUT_MIN_FONT_SIZE, fittedSize));
}

export function NameFoxScreen({
  initialName,
  onBack,
  onSkip,
  onSubmit,
}: {
  initialName: string;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: (name: string) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const nameLayout = getNameFoxLayout(windowHeight);
  const initialDisplayName = initialName.trim();
  const [value, setValue] = useState(initialDisplayName);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const nameEditedRef = useRef(false);
  const [inputWidth, setInputWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const previousRandomName = useRef(initialDisplayName || 'Kiko');

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!nameEditedRef.current) setValue(initialName.trim());
  }, [initialName]);
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? motionTokens.settle.reduceMotionMs : motionTokens.nameFox.entryMs,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, reduceMotion]);

  const kikoStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - progress.value) * motionTokens.nameFox.translateX }],
  }));
  const validName = value.trim().length > 0;
  const submit = () => {
    if (!validName) return;
    Keyboard.dismiss();
    onSubmit(sanitizeMascotName(value));
  };
  const randomize = () => {
    const name = pickRandomMascotName(previousRandomName.current);
    previousRandomName.current = name;
    nameEditedRef.current = true;
    setValue(name);
    inputRef.current?.focus();
  };
  const placeholder = 'Type a name';
  const inputFontSize = useMemo(
    () => getResponsiveNameInputFontSize(value || 'Kiko', inputWidth),
    [inputWidth, value],
  );
  const inputLineHeight = Math.ceil(inputFontSize * 1.18);
  const onInputLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setInputWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
        {!keyboardVisible ? (
          <Animated.View pointerEvents="none" style={[styles.referenceWrap, { height: nameLayout.artworkHeight }, kikoStyle]}>
            <Image accessible={false} contentFit="contain" source={onboardingV3Assets.nameFoxReference} style={StyleSheet.absoluteFill} />
          </Animated.View>
        ) : null}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.content, { paddingTop: nameLayout.contentTop }]}>
            <View style={styles.nameField}>
              <Text accessibilityRole="header" style={styles.label}>What should we call your fox?</Text>
              <View style={styles.nameInputWrap}>
                <TextInput
                  accessibilityLabel="Fox name"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={MASCOT_NAME_MAX_LENGTH}
                  onChangeText={(text) => { nameEditedRef.current = true; setValue(text); }}
                  onLayout={onInputLayout}
                  onSubmitEditing={submit}
                  placeholder={placeholder}
                  placeholderTextColor="#B7A99F"
                  ref={inputRef}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={[styles.input, { fontSize: inputFontSize, lineHeight: inputLineHeight }]}
                  value={value}
                />
              </View>
              <Pressable accessibilityLabel="Surprise me" accessibilityRole="button" onPress={randomize} style={({ pressed }) => [styles.randomText, pressed && styles.randomPressed]}>
                <Text style={styles.randomLabel}>Surprise me</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <OnboardingCTA disabled={!validName} label="Next" onPress={submit} tone="pastelPink" />
          <Pressable accessibilityLabel="Skip naming your fox for now" accessibilityRole="button" hitSlop={8} onPress={onSkip} style={({ pressed }) => [styles.skipAction, pressed && styles.skipPressed]}>
            <Text style={styles.skipLabel}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  keyboardView: { flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  referenceWrap: { maxHeight: 350, position: 'absolute', right: 16, top: '7%', width: '47%', zIndex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 12 },
  content: { justifyContent: 'center', paddingHorizontal: 32, zIndex: 2 },
  nameField: { alignSelf: 'stretch' },
  label: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 18, fontWeight: '700', marginBottom: 7 },
  nameInputWrap: { alignSelf: 'stretch', marginTop: 4 },
  input: {
    alignSelf: 'stretch', color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontWeight: '800',
    height: 44, letterSpacing: -0.2, minHeight: 44, paddingHorizontal: 0,
    paddingVertical: 0, textAlign: 'left', textAlignVertical: 'center', width: '100%',
  },
  randomText: { alignSelf: 'flex-start', marginTop: 15, minHeight: 44, paddingVertical: 8 },
  randomPressed: { opacity: 0.65 },
  randomLabel: { color: '#FFA8C2', fontFamily: fontFamilies.bold, fontSize: 18, fontWeight: '700' },
  footer: { paddingBottom: 10, paddingHorizontal: 24, paddingTop: 12 },
  skipAction: { alignSelf: 'center', minHeight: 40, paddingHorizontal: 12, paddingVertical: 8 },
  skipLabel: { color: '#8F7F78', fontFamily: fontFamilies.semibold, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  skipPressed: { opacity: 0.65 },
});
