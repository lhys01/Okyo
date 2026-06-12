import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Book,
  Camera,
  Clock,
  MoneySquare,
  NavArrowRight,
  Spark,
} from 'iconoir-react-native';
import { useMemo, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KikoMascot } from '../components/KikoMascot';
import { colors, typography } from '../components/OkyoUI';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';
import { uiLog } from '../utils/uiDebug';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const latestScanSession = useOkyoStore((state) => state.latestScanSession);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const totalMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : [];
  const recentRecipes = useMemo(() => safeSavedRecipes.slice().reverse().slice(0, 3), [safeSavedRecipes]);
  const heroRecipe = latestScanRecipe ?? recentRecipes[0] ?? null;
  const heroImageUri = latestScanSession?.selectedScanImage?.uri ?? selectedScanImage?.uri ?? null;
  const estimatedSaved = safeSavedRecipes.reduce(
    (total, recipe) => total + getFiniteNumber(recipe.estimatedSavings),
    getFiniteNumber(totalMoneySaved),
  );
  const hasActivity = Boolean(heroRecipe || heroImageUri || safeSavedRecipes.length > 0 || weeklyScanCount > 0);

  const openScan = () => {
    uiLog('HomeScreen', 'scan_cta');
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const openPlan = () => {
    uiLog('HomeScreen', 'open_plan');
    navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
  };

  const openSavings = () => {
    uiLog('HomeScreen', 'open_savings');
    navigation.navigate('SavingsDashboardScreen');
  };

  const openRecipe = (recipe: Recipe) => {
    const mode = getSafeRecipeMode(recipe.mode);
    writeSavedRecipeContext({
      recipe,
      reason: 'open_home_recipe',
      source: 'HomeScreen.openRecipe',
    });
    if (isRecipeMode(recipe.mode)) {
      setSelectedMode(recipe.mode);
    }
    uiLog('HomeScreen', 'open_recent_recipe', { recipeId: recipe.id });
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{getGreeting()}</Text>
          <Text style={styles.title}>What should dinner become?</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.heroCard, pressed ? styles.pressed : null]}
          onPress={heroRecipe ? () => openRecipe(heroRecipe) : openScan}
        >
          {heroImageUri ? (
            <Image source={{ uri: heroImageUri }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <KikoMascot pose={hasActivity ? 'recipe' : 'wave'} size={118} />
            </View>
          )}
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{hasActivity ? 'Today in Okyo' : 'Fresh start'}</Text>
            <Text numberOfLines={2} style={styles.heroTitle}>
              {heroRecipe?.title ?? 'Scan something delicious'}
            </Text>
            <Text style={styles.heroBody}>
              {heroRecipe
                ? `${heroRecipe.difficulty} · about ${formatCurrency(heroRecipe.estimatedHomemadeCost)} at home`
                : 'Use a photo, get a clear homemade path, and keep the good parts of the craving.'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.statStrip}>
          <InlineStat icon={<MoneySquare color={colors.green} height={20} strokeWidth={2} width={20} />} label="Saved" value={formatCurrency(estimatedSaved)} />
          <View style={styles.statDivider} />
          <InlineStat icon={<Camera color={colors.coral} height={20} strokeWidth={2} width={20} />} label="Scans" value={weeklyScanCount.toString()} />
        </View>

        <View style={styles.actionRow}>
          <HomeAction
            icon={<Camera color="#fffdf8" height={20} strokeWidth={2.2} width={20} />}
            label="Scan"
            primary
            onPress={openScan}
          />
          <HomeAction
            icon={<Book color={colors.charcoal} height={20} strokeWidth={2} width={20} />}
            label="Plan"
            onPress={openPlan}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent meals</Text>
          <Pressable accessibilityRole="button" hitSlop={8} style={styles.sectionLink} onPress={openPlan}>
            <Text style={styles.sectionLinkText}>View all</Text>
            <NavArrowRight color={colors.charcoal} height={18} strokeWidth={2} width={18} />
          </Pressable>
        </View>

        {recentRecipes.length > 0 ? (
          <View style={styles.timeline}>
            {recentRecipes.map((recipe, index) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                style={({ pressed }) => [styles.timelineItem, pressed ? styles.pressed : null]}
                onPress={() => openRecipe(recipe)}
              >
                <View style={styles.timelineMarker}>
                  <Text style={styles.timelineNumber}>{index + 1}</Text>
                </View>
                <View style={styles.timelineCopy}>
                  <Text numberOfLines={2} style={styles.timelineTitle}>{recipe.title}</Text>
                  <Text style={styles.timelineMeta}>
                    {recipe.mode} · saved about {formatCurrency(recipe.estimatedSavings)}
                  </Text>
                </View>
                <NavArrowRight color={colors.muted} height={20} strokeWidth={2} width={20} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyRecent}>
            <Spark color={colors.coral} height={24} strokeWidth={2} width={24} />
            <Text style={styles.emptyRecentTitle}>Your first remake starts with a photo.</Text>
            <Text style={styles.emptyRecentBody}>Recent scans and saved swaps will appear here as a quiet cooking timeline.</Text>
          </View>
        )}

        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.savingsCard, pressed ? styles.pressed : null]} onPress={openSavings}>
          <View>
            <Text style={styles.savingsKicker}>Kitchen ledger</Text>
            <Text style={styles.savingsTitle}>{formatCurrency(estimatedSaved)}</Text>
            <Text style={styles.savingsBody}>Estimated savings tracked across saved meals and cooking wins.</Text>
          </View>
          <Clock color={colors.charcoal} height={28} strokeWidth={1.8} width={28} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InlineStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.inlineStat}>
      {icon}
      <View>
        <Text style={styles.inlineStatLabel}>{label}</Text>
        <Text style={styles.inlineStatValue}>{value}</Text>
      </View>
    </View>
  );
}

function HomeAction({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.homeAction,
        primary ? styles.homeActionPrimary : null,
        pressed ? styles.pressed : null,
      ]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.homeActionText, primary ? styles.homeActionTextPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    padding: spacing.screen,
    paddingBottom: 220,
  },
  header: {
    marginTop: 8,
  },
  kicker: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 8,
  },
  title: {
    ...typography.display,
    maxWidth: 330,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.hero,
    marginTop: 26,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroImage: {
    aspectRatio: 1.15,
    backgroundColor: colors.cream,
    width: '100%',
  },
  heroFallback: {
    alignItems: 'center',
    aspectRatio: 1.15,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    width: '100%',
  },
  heroCopy: {
    padding: 22,
  },
  heroEyebrow: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...typography.title,
  },
  heroBody: {
    ...typography.body,
    marginTop: 8,
  },
  statStrip: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 18,
    ...shadows.card,
  },
  inlineStat: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  inlineStatLabel: {
    ...typography.caption,
  },
  inlineStatValue: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 38,
    marginHorizontal: 12,
    width: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  homeAction: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.button,
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 56,
    ...shadows.card,
  },
  homeActionPrimary: {
    backgroundColor: colors.coral,
    shadowColor: colors.coralDark,
  },
  homeActionText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
  },
  homeActionTextPrimary: {
    color: '#fffdf8',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.section,
  },
  sectionTitle: {
    ...typography.heading,
  },
  sectionLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  sectionLinkText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },
  timeline: {
    gap: 12,
    marginTop: 14,
  },
  timelineItem: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    gap: 14,
    minHeight: 82,
    padding: 16,
    ...shadows.card,
  },
  timelineMarker: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  timelineNumber: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '800',
  },
  timelineCopy: {
    flex: 1,
    minWidth: 0,
  },
  timelineTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  timelineMeta: {
    ...typography.caption,
    marginTop: 4,
  },
  emptyRecent: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    gap: 8,
    marginTop: 14,
    padding: 20,
    ...shadows.card,
  },
  emptyRecentTitle: {
    ...typography.heading,
  },
  emptyRecentBody: {
    ...typography.body,
  },
  savingsCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.greenSoft,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    padding: 20,
  },
  savingsKicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  savingsTitle: {
    color: colors.green,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 39,
    marginTop: 8,
  },
  savingsBody: {
    ...typography.caption,
    marginTop: 5,
    maxWidth: 250,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
