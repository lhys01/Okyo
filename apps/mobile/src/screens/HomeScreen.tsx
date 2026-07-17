import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraSolid, NavArrowRight, PasteClipboard, Upload } from 'iconoir-react-native';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedGradientBackground } from '../components/AnimatedGradientBackground';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import type { Recipe } from '../mocks';
import { getSafeRecipeMode, isRecipeMode } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, layout, radius, spacing, surfaces, typography } from '../theme/okyoTheme';
import { getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const recentScanRecipes = useOkyoStore((state) => state.recentScanRecipes);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);

  const validSavedRecipes = useMemo(
    () => (Array.isArray(savedRecipes) ? savedRecipes.filter(isUsableRecipe).slice().reverse() : []),
    [savedRecipes],
  );
  const recommendation = isUsableRecipe(latestScanRecipe) ? latestScanRecipe : validSavedRecipes[0] ?? null;
  const additionalRecipes = validSavedRecipes
    .filter((recipe) => recipe.id !== recommendation?.id)
    .slice(0, 3);
  const recentScans = (Array.isArray(recentScanRecipes) ? recentScanRecipes : [])
    .filter(isUsableRecipe)
    .slice(0, 3);

  const openRecipe = (recipe: Recipe) => {
    const mode = getSafeRecipeMode(recipe.mode);
    writeSavedRecipeContext({ recipe, reason: 'open_home_recipe', source: 'HomeScreen' });
    if (isRecipeMode(recipe.mode)) setSelectedMode(recipe.mode);
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedGradientBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>OKYO</Text>
            <Text style={styles.title}>What should we cook?</Text>
            <Text style={styles.body}>Turn a food photo or idea into a recipe you can actually make.</Text>
          </View>
          <KikoMascot animated="idle" pose="wave" size={78} />
        </View>

        <View style={styles.scanCard}>
          <Text style={styles.sectionTitle}>Start with food</Text>
          <Text style={styles.sectionBody}>Choose one way to begin. Okyo will use the same honest recipe flow.</Text>
          <View style={styles.scanActions}>
            <ScanAction
              icon={<CameraSolid color={colors.onCoral} height={23} width={23} />}
              label="Take a photo"
              primary
              onPress={() => navigation.navigate('ScanScreen', { intent: 'camera' })}
            />
            <ScanAction
              icon={<Upload color={colors.coralDark} height={22} strokeWidth={2.2} width={22} />}
              label="Upload a photo"
              onPress={() => navigation.navigate('ScanScreen', { intent: 'photos' })}
            />
            <ScanAction
              icon={<PasteClipboard color={colors.coralDark} height={22} strokeWidth={2.2} width={22} />}
              label="Write a food idea"
              onPress={() => navigation.navigate('FoodIdeaScreen')}
            />
          </View>
        </View>

        <SectionHeading title="Recommended for you" />
        {recommendation ? (
          <RecipeCard featured recipe={recommendation} onPress={() => openRecipe(recommendation)} />
        ) : (
          <EmptyCard
            body="Scan a meal or save a recipe first. Okyo won’t invent a recommendation without real recipe data."
            title="No honest recommendation yet"
          />
        )}

        {additionalRecipes.length > 0 ? (
          <>
            <SectionHeading title="More from your kitchen" />
            <View style={styles.list}>
              {additionalRecipes.map((recipe) => (
                <RecipeRow key={recipe.id} recipe={recipe} onPress={() => openRecipe(recipe)} />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeading title="Recent scans" />
        {recentScans.length > 0 ? (
          <View style={styles.list}>
            {recentScans.map((recipe) => (
              <RecipeRow key={recipe.id} recipe={recipe} onPress={() => openRecipe(recipe)} />
            ))}
          </View>
        ) : (
          <EmptyCard
            body={latestScanStatus === 'failed' || latestScanStatus === 'rejected'
              ? 'Your last scan did not produce a recipe. Try again with a clear, well-lit food photo.'
              : 'Your latest successful scan will appear here.'}
            title="No recent scans"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScanAction({ icon, label, onPress, primary = false }: { icon: ReactNode; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.scanAction, primary ? styles.scanActionPrimary : null, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.scanActionText, primary ? styles.scanActionTextPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <Text style={styles.sectionHeading}>{title}</Text>;
}

function RecipeCard({ featured, onPress, recipe }: { featured?: boolean; onPress: () => void; recipe: Recipe }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.recipeCard, pressed ? styles.pressed : null]} onPress={onPress}>
      <FoodImage imageStatus={getRecipeImageStatus(recipe)} imageUrl={getRecipeImageUrl(recipe)} style={featured ? styles.featuredImage : styles.rowImage} />
      <View style={styles.recipeCopy}>
        <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
        <Text numberOfLines={2} style={styles.recipeMeta}>
          {recipe.difficulty} · {Math.max(0, recipe.prepTimeMinutes + recipe.cookTimeMinutes)} min
        </Text>
        {featured ? <Text numberOfLines={2} style={styles.recipeDescription}>{recipe.description}</Text> : null}
      </View>
      <NavArrowRight color={colors.muted} height={21} strokeWidth={2} width={21} />
    </Pressable>
  );
}

function RecipeRow(props: { onPress: () => void; recipe: Recipe }) {
  return <RecipeCard {...props} />;
}

function EmptyCard({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function isUsableRecipe(recipe: Recipe | null | undefined): recipe is Recipe {
  return Boolean(recipe?.id && recipe.title?.trim() && Array.isArray(recipe.ingredients) && Array.isArray(recipe.steps));
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.screen, paddingBottom: layout.scrollClearance },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingVertical: 10 },
  headerCopy: { flex: 1 },
  kicker: { ...typography.label, color: colors.coralDark },
  title: { ...typography.display, fontSize: 34, lineHeight: 39, marginTop: 6 },
  body: { ...typography.body, marginTop: 8 },
  scanCard: { ...surfaces.card, marginTop: 18, padding: 18 },
  sectionTitle: { ...typography.title, fontSize: 22 },
  sectionBody: { ...typography.body, marginTop: 6 },
  scanActions: { gap: 10, marginTop: 16 },
  scanAction: { alignItems: 'center', backgroundColor: colors.cream, borderColor: colors.border, borderRadius: radius.button, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  scanActionPrimary: { backgroundColor: colors.coral, borderColor: colors.coral },
  scanActionText: { color: colors.charcoal, fontSize: 16, fontWeight: '800' },
  scanActionTextPrimary: { color: colors.onCoral },
  sectionHeading: { color: colors.charcoal, fontSize: 21, fontWeight: '800', marginBottom: 11, marginTop: 26 },
  recipeCard: { ...surfaces.card, alignItems: 'center', flexDirection: 'row', gap: 13, overflow: 'hidden', padding: 13 },
  featuredImage: { borderRadius: 18, height: 108, width: 108 },
  rowImage: { borderRadius: 14, height: 70, width: 70 },
  recipeCopy: { flex: 1, minWidth: 0 },
  recipeTitle: { color: colors.charcoal, fontSize: 18, fontWeight: '800' },
  recipeMeta: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 5 },
  recipeDescription: { ...typography.caption, marginTop: 7 },
  list: { gap: 10 },
  emptyCard: { ...surfaces.panel, padding: 18 },
  emptyTitle: { color: colors.charcoal, fontSize: 17, fontWeight: '800' },
  emptyBody: { ...typography.body, marginTop: 6 },
  pressed: { opacity: 0.82 },
});
