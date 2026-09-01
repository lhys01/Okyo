import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
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
import { NameFoxValueScreen } from './NameFoxValueScreens';
import {
  advanceNameTypewriter,
  createNameTypewriterState,
  getNameTypewriterDelay,
  pickRandomMascotName,
  shouldAnimateNamePlaceholder,
} from '../state/mascotNameSuggestions';

const NAME_INPUT_MAX_FONT_SIZE = 56;
const NAME_INPUT_MIN_FONT_SIZE = 22;
const NAME_INPUT_HORIZONTAL_PADDING = 12;
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
  onSubmit,
}: {
  initialName: string;
  onBack: () => void;
  onSubmit: (name: string) => void;
}) {
  const initialDisplayName = initialName.trim() === 'Kiko' || initialName.trim().length === 0 ? '' : initialName;
  const [value, setValue] = useState(initialDisplayName);
  const [focused, setFocused] = useState(false);
  const [typewriter, setTypewriter] = useState(createNameTypewriterState);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [valueScreen, setValueScreen] = useState<0 | 1 | null>(null);
  const [inputWidth, setInputWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const previousRandomName = useRef(initialDisplayName || 'Kiko');
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? motionTokens.settle.reduceMotionMs : motionTokens.nameFox.entryMs,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, reduceMotion]);

  useEffect(() => {
    if (!shouldAnimateNamePlaceholder(value, focused, reduceMotion)) return;
    const timer = setTimeout(() => setTypewriter((current) => advanceNameTypewriter(current)), getNameTypewriterDelay(typewriter));
    return () => clearTimeout(timer);
  }, [focused, reduceMotion, typewriter, value]);

  useEffect(() => {
    const animateCursor = shouldAnimateNamePlaceholder(value, focused, reduceMotion);
    if (!animateCursor) {
      setCursorVisible(true);
      return;
    }
    const timer = setInterval(() => setCursorVisible((current) => !current), 500);
    return () => clearInterval(timer);
  }, [focused, reduceMotion, value]);

  const kikoStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - progress.value) * motionTokens.nameFox.translateX }],
  }));
  const validName = value.trim().length > 0;
  const submit = () => {
    if (!validName) return;
    Keyboard.dismiss();
    setValueScreen(0);
  };
  const valueScreenBack = () => {
    if (valueScreen === 0) setValueScreen(null);
    else setValueScreen(0);
  };
  const valueScreenNext = () => {
    if (valueScreen === 0) setValueScreen(1);
    else onSubmit(sanitizeMascotName(value));
  };
  const randomize = () => {
    const name = pickRandomMascotName(previousRandomName.current);
    previousRandomName.current = name;
    setValue(name);
    inputRef.current?.focus();
  };
  const placeholder = reduceMotion || focused ? 'Kiko' : `${typewriter.text}${cursorVisible ? '|' : ''}`;
  const inputFontSize = useMemo(
    () => getResponsiveNameInputFontSize(value || 'Kiko', inputWidth),
    [inputWidth, value],
  );
  const inputLineHeight = Math.ceil(inputFontSize * 1.18);
  const onInputLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setInputWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
  };

  if (valueScreen !== null) {
    return <NameFoxValueScreen onBack={valueScreenBack} onNext={valueScreenNext} page={valueScreen} />;
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
        <Animated.View pointerEvents="none" style={[styles.referenceWrap, kikoStyle]}>
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.nameFoxReference} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.nameField}>
              <Text style={styles.label}>Name your fox</Text>
              <TextInput
                accessibilityLabel="Fox name"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={MASCOT_NAME_MAX_LENGTH}
                onBlur={() => setFocused(false)}
                onChangeText={setValue}
                onFocus={() => setFocused(true)}
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
              <Pressable accessibilityLabel="Get a random name" accessibilityRole="button" onPress={randomize} style={({ pressed }) => [styles.randomText, pressed && styles.randomPressed]}>
                <Text style={styles.randomLabel}>Get a random name</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}><OnboardingCTA disabled={!validName} label="Next" onPress={submit} tone="pastelPink" /></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  keyboardView: { flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  referenceWrap: { height: '40%', maxHeight: 330, position: 'absolute', right: 18, top: '9%', width: '44%', zIndex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 12 },
  content: { justifyContent: 'center', paddingHorizontal: 32, paddingTop: 190, zIndex: 2 },
  nameField: { alignSelf: 'stretch' },
  label: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 18, fontWeight: '700', marginBottom: 7 },
  input: {
    alignSelf: 'stretch', color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontWeight: '900',
    height: 84, letterSpacing: -1.4, minHeight: 84, paddingHorizontal: NAME_INPUT_HORIZONTAL_PADDING,
    paddingVertical: 0, textAlign: 'center', textAlignVertical: 'center', width: '100%',
  },
  randomText: { alignSelf: 'flex-start', marginTop: 15, minHeight: 44, paddingVertical: 8 },
  randomPressed: { opacity: 0.65 },
  randomLabel: { color: '#FFA8C2', fontFamily: fontFamilies.bold, fontSize: 18, fontWeight: '700' },
  footer: { paddingBottom: 10, paddingHorizontal: 24, paddingTop: 12 },
});
