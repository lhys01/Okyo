import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies, radius, spacing } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { useReduceMotion } from '../motion/useReduceMotion';

type Props = { onContinue: () => void; onRestore: () => void; onTryRecipe: () => void; isRestoring?: boolean };
const dish = require('../../../assets/food/recipes/teriyaki-chicken-bowl.png');

/** Two beats, one composition: the same mounted food surface becomes the input. */
export function PromiseScreen({ onContinue, onRestore, onTryRecipe, isRestoring = false }: Props) {
  const [explaining, setExplaining] = useState(false);
  const { height, fontScale } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const mediaHeight = Math.max(260, Math.min(380, height * 0.43));
  const transition = LinearTransition.duration(reduceMotion ? 0 : 380);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        {explaining ? <Pressable accessibilityLabel="Back to the introduction" accessibilityRole="button" onPress={() => setExplaining(false)} style={styles.back}><Text style={styles.backLabel}>←</Text></Pressable> : <Text accessibilityLabel="Okyo" style={styles.brand}>okyo</Text>}
        <Pressable accessibilityLabel={isRestoring ? 'Restoring purchase' : 'Restore purchases'} accessibilityRole="button" accessibilityState={{ disabled: isRestoring }} disabled={isRestoring} onPress={onRestore} style={styles.restore}>
          <Text style={styles.quiet}>{isRestoring ? 'Restoring…' : 'Restore purchases'}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, explaining && styles.explainerTitle]}>
          {explaining ? 'The dish you love.\nThe how, handled.' : 'Your favorite food.\nMade cookable.'}
        </Text>
        <Text style={styles.description}>{explaining ? 'A photo is the starting point. A recipe is what you take home.' : 'Show Okyo a dish. Get ingredients and steps for making your own version.'}</Text>
        <View style={[styles.scene, { minHeight: mediaHeight }, explaining && styles.explainerScene, fontScale > 1.4 && explaining && styles.stackedScene]}>
          <Animated.View layout={transition} style={[styles.photoSurface, { height: mediaHeight }, explaining && styles.inputPhoto, fontScale > 1.4 && explaining && styles.stackedPhoto]}>
            <Image accessibilityLabel="Chicken and rice, an example dish to recreate" accessibilityRole="image" contentFit="cover" source={dish} style={StyleSheet.absoluteFill} />
            {explaining ? <Text style={styles.photoCaption}>Your dish</Text> : null}
          </Animated.View>
          {explaining ? <Animated.View layout={transition} style={styles.recipeSurface}>
            <Text style={styles.recipeArrow}>→</Text>
            <Text style={styles.recipeTitle}>Your recipe</Text>
            <Text style={styles.recipeLine}>Ingredients & amounts</Text>
            <Text style={styles.recipeLine}>Clear cooking steps</Text>
            <View style={styles.recipeDivider} />
            <Text style={styles.recipeDetail}>Time, nutrition & estimated cost</Text>
          </Animated.View> : null}
          <Animated.View layout={transition} pointerEvents="none" style={[styles.kiko, explaining && styles.kikoExplaining]}>
            <Image accessible={false} contentFit="contain" source={explaining ? onboardingV3Assets.saveMoneyReveal : onboardingV3Assets.saveMoneyIntro} style={styles.kikoImage} />
          </Animated.View>
        </View>
        {explaining ? <View style={styles.teaching}>
          <Text style={styles.inputMethods}>Scan, upload, or describe a dish.</Text>
          <Text style={styles.valueTitle}>Keep the craving. Change what you need.</Text>
          <Text style={styles.valueCopy}>With Pro, add protein, swap ingredients, or simplify the steps.</Text>
          <Text style={styles.disclaimer}>Inspired-by recipes, not official restaurant recipes. Nutrition and cost are estimates.</Text>
        </View> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityLabel={explaining ? 'Choose what matters to you' : 'See how Okyo works'} accessibilityRole="button" onPress={explaining ? onContinue : () => setExplaining(true)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} testID="promise-continue">
          <Text style={styles.primaryLabel}>{explaining ? 'What matters to you?' : 'See how Okyo works'}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Try my first recipe" accessibilityRole="button" onPress={onTryRecipe} style={styles.skip}><Text style={styles.skipLabel}>Try my first recipe</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { paddingHorizontal: spacing.xl, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 30, letterSpacing: -1.5 },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backLabel: { color: colors.ink, fontSize: 28 },
  restore: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  quiet: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 13 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 44, lineHeight: 49, letterSpacing: -1.5 },
  explainerTitle: { fontSize: 36, lineHeight: 41, letterSpacing: -1 },
  description: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 25, marginTop: spacing.md },
  scene: { marginTop: spacing.xl, marginBottom: spacing.xl, position: 'relative' },
  explainerScene: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xxl },
  stackedScene: { flexDirection: 'column', alignItems: 'stretch' },
  photoSurface: { overflow: 'hidden', borderRadius: radius.hero, width: '100%', backgroundColor: colors.creamDeep },
  inputPhoto: { width: '47%', height: 230, borderRadius: radius.panel, alignSelf: 'flex-start' },
  stackedPhoto: { width: '100%', height: 190 },
  photoCaption: { position: 'absolute', bottom: spacing.md, left: spacing.md, color: colors.ink, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontFamily: fontFamilies.semibold, fontSize: 13 },
  recipeSurface: { flex: 1, paddingVertical: spacing.xl, minWidth: 0 },
  recipeArrow: { color: colors.savings, fontSize: 28, marginBottom: spacing.sm },
  recipeTitle: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22, lineHeight: 28, marginBottom: spacing.lg },
  recipeLine: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  recipeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  recipeDetail: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  kiko: { position: 'absolute', height: 166, width: 138, right: -8, bottom: -24 },
  kikoExplaining: { height: 112, width: 100, left: 32, right: undefined, bottom: -4 },
  kikoImage: { height: '100%', width: '100%' },
  teaching: { gap: spacing.sm },
  inputMethods: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },
  valueTitle: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 20, lineHeight: 27 },
  valueCopy: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 23 },
  disclaimer: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  primary: { backgroundColor: colors.coral, borderRadius: radius.button, minHeight: 58, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  skip: { minHeight: 44, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  skipLabel: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 14 },
});
