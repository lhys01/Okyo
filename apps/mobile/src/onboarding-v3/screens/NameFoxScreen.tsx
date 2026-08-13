import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import {
  advanceNameTypewriter,
  createNameTypewriterState,
  getNameTypewriterDelay,
  pickRandomMascotName,
  shouldAnimateNamePlaceholder,
} from '../state/mascotNameSuggestions';

export function NameFoxScreen({
  initialName,
  onBack,
  onSubmit,
}: {
  initialName: string;
  onBack: () => void;
  onSubmit: (name: string) => void;
}) {
  const initialDisplayName = initialName.trim() === 'Kiko' ? '' : initialName;
  const [value, setValue] = useState(initialDisplayName);
  const [focused, setFocused] = useState(false);
  const [typewriter, setTypewriter] = useState(createNameTypewriterState);
  const [cursorVisible, setCursorVisible] = useState(true);
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
  const submit = () => onSubmit(sanitizeMascotName(value || typewriter.text || 'Kiko'));
  const randomize = () => {
    const name = pickRandomMascotName(previousRandomName.current);
    previousRandomName.current = name;
    setValue(name);
    inputRef.current?.focus();
  };
  const placeholder = reduceMotion || focused ? 'Kiko' : `${typewriter.text}${cursorVisible ? '|' : ''}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
        <Animated.View style={[styles.kikoWrap, kikoStyle]}>
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.nameFoxKikoPeek} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.content}>
          <Text style={styles.label}>Name your fox</Text>
          <TextInput
            accessibilityLabel="Name your fox"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MASCOT_NAME_MAX_LENGTH}
            onBlur={() => setFocused(false)}
            onChangeText={setValue}
            onFocus={() => setFocused(true)}
            onSubmitEditing={submit}
            placeholder={placeholder}
            placeholderTextColor="#B7A99F"
            ref={inputRef}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.input}
            value={value}
          />
          <Pressable accessibilityLabel="Get a random name" accessibilityRole="button" onPress={randomize} style={({ pressed }) => [styles.randomText, pressed && styles.randomPressed]}>
            <Text style={styles.randomLabel}>Get a random name</Text>
          </Pressable>
        </View>
        <View style={styles.footer}><OnboardingCTA label="Next" onPress={submit} /></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  keyboardView: { flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  kikoWrap: { height: '37%', maxHeight: 310, position: 'absolute', right: '-7%', top: '4%', width: '56%' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  label: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 16, fontWeight: '700', marginBottom: 7 },
  input: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 48, fontWeight: '900', letterSpacing: -1.4, minHeight: 72, paddingVertical: 4 },
  randomText: { alignSelf: 'flex-start', marginTop: 15, paddingVertical: 8 },
  randomPressed: { opacity: 0.65 },
  randomLabel: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 14, fontWeight: '700' },
  footer: { paddingBottom: 10, paddingHorizontal: 24, paddingTop: 12 },
});
