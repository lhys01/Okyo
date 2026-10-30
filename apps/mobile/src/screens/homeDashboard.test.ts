import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { getMetricCarouselIndex } from '../components/home/metricCarouselState';

const home = readFileSync(resolve(process.cwd(), 'src/screens/HomeScreen.tsx'), 'utf8');
const carousel = readFileSync(resolve(process.cwd(), 'src/components/home/MetricCarousel.tsx'), 'utf8');
const metricCard = readFileSync(resolve(process.cwd(), 'src/components/home/MetricCard.tsx'), 'utf8');
const homeMetrics = readFileSync(resolve(process.cwd(), 'src/state/homeMetrics.ts'), 'utf8');
const tabs = readFileSync(resolve(process.cwd(), 'src/navigation/MainTabs.tsx'), 'utf8');

test('Home assembles the approved dashboard hierarchy without a scan wrapper', () => {
  const orderedMarkers = ['styles.header', '<WeekStrip', '<MetricCarousel', 'Recent dishes', 'Today’s ideas'];
  let cursor = -1;
  for (const marker of orderedMarkers) {
    const next = home.indexOf(marker);
    assert.ok(next > cursor, `${marker} should follow the prior dashboard section`);
    cursor = next;
  }
  assert.doesNotMatch(home, /HomeScanSection|ScanEntryOptions|discoverPromptCard/);
  assert.doesNotMatch(home, /Sora_/);
});

test('Home metric carousel is swipeable, paged, accessible, and goal ordered', () => {
  assert.match(home, /getHomeMetricOrder\(primaryGoal\)/);
  assert.match(carousel, /horizontal/);
  assert.match(carousel, /snapToInterval/);
  assert.match(carousel, /accessibilityRole="adjustable"/);
  assert.match(carousel, /Haptics\.selectionAsync/);
});

test('the active metric bubble follows the swipe position before momentum settles', () => {
  assert.equal(getMetricCarouselIndex(0, 100, 2), 0);
  assert.equal(getMetricCarouselIndex(49, 100, 2), 0);
  assert.equal(getMetricCarouselIndex(51, 100, 2), 1);
  assert.equal(getMetricCarouselIndex(1000, 100, 2), 1);
  assert.match(carousel, /onScroll=\{syncIndexToScroll\}/);
  assert.match(carousel, /scrollEventThrottle=\{16\}/);
  assert.match(carousel, /onMomentumScrollEnd=\{syncIndexToScroll\}/);
});

test('Home metric paging respects Reduce Motion and supports Dynamic Type without clipping stat labels', () => {
  assert.match(carousel, /useReduceMotion\(\)/);
  assert.match(carousel, /animated: !reduceMotion/);
  assert.match(home, /fontScale, height, width/);
  assert.match(home, /metricHeight = \(compact \? 162 : 176\) \+ Math\.round\(Math\.max\(0, fontScale - 1\) \* 72\)/);
  assert.doesNotMatch(metricCard, /maxFontSizeMultiplier|numberOfLines=\{[12]\}/);
});

test('tour transitions retain their Reduce Motion path and shared type roles', () => {
  const tour = readFileSync(resolve(process.cwd(), 'src/tour/TourOverlay.tsx'), 'utf8');
  const coach = readFileSync(resolve(process.cwd(), 'src/tour/CoachDock.tsx'), 'utf8');
  assert.match(tour, /const reduceMotion = useReduceMotion\(\)/);
  assert.match(tour, /if \(reduceMotion\) \{\s*spotlightOpacity\.setValue\(1\)/);
  assert.match(coach, /\.\.\.typography\.button/);
  assert.match(coach, /style=\{styles\.textArea\}/);
});

test('visual typography and icon roles use the shared Okyo design tokens', () => {
  const theme = readFileSync(resolve(process.cwd(), 'src/theme/okyoTheme.ts'), 'utf8');
  const grocery = readFileSync(resolve(process.cwd(), 'src/screens/GroceryListScreen.tsx'), 'utf8');
  const result = readFileSync(resolve(process.cwd(), 'src/screens/ResultSummaryScreen.tsx'), 'utf8');
  const ingredients = readFileSync(resolve(process.cwd(), 'src/components/RecipeIngredientsAssistant.tsx'), 'utf8');
  assert.match(theme, /display: 'Manrope_800ExtraBold'/);
  assert.match(theme, /cardTitle:/);
  assert.match(theme, /captionSmall:/);
  assert.match(theme, /export const iconSizes/);
  assert.match(grocery, /\.\.\.typography\.title/);
  assert.match(grocery, /\.\.\.typography\.bodyEmphasis/);
  assert.match(result, /\.\.\.typography\.hero/);
  assert.match(ingredients, /\.\.\.typography\.section/);
});

test('icon-only controls retain accessible names and illustration artwork stays decorative', () => {
  const grocery = readFileSync(resolve(process.cwd(), 'src/screens/GroceryListScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
  const ingredients = readFileSync(resolve(process.cwd(), 'src/components/RecipeIngredientsAssistant.tsx'), 'utf8');
  assert.match(carousel, /accessibilityLabel=\{`\$\{metrics\[data\[index\]\]\.label\} dashboard metric/);
  assert.match(metricCard, /accessibilityLabel=\{accessibilityLabel\}/);
  assert.match(grocery, /accessibilityLabel="Back"/);
  assert.match(detail, /accessibilityLabel="Back"/);
  assert.match(ingredients, /accessibilityLabel="Increase servings"/);
  assert.match(ingredients, /accessibilityLabel=\{isAdded \? `Remove/);
  assert.match(metricCard, /accessibilityElementsHidden/);
});

test('Home and Grocery retain scrollable small-screen layouts without fixed viewport sizing', () => {
  const grocery = readFileSync(resolve(process.cwd(), 'src/screens/GroceryListScreen.tsx'), 'utf8');
  assert.match(home, /const compact = width < 380 \|\| height < 700/);
  assert.match(home, /cardWidth = width - 40/);
  assert.match(grocery, /<ScrollView ref=\{scrollRef\}/);
  assert.doesNotMatch(grocery, /width:\s*(?:375|390|402)/);
});

test('Home uses a compact main metric with three separate supporting cards and honest visual progress', () => {
  assert.match(metricCard, /styles\.stats/);
  assert.match(metricCard, /metric\.stats\.map/);
  assert.match(metricCard, /progress !== null/);
  assert.match(metricCard, /PiggyBank/);
  assert.match(metricCard, /StatsUpSquare/);
  assert.doesNotMatch(metricCard, /nutrition known/);
  assert.match(home, /readPersonalizedHomeProfile/);
});

test('Home carousel excludes the Health section', () => {
  assert.match(home, /<MetricCarousel/);
  assert.match(home, /getHomeMetricOrder\(primaryGoal\)/);
  assert.match(homeMetrics, /return \['savings', 'macros'\]/);
  assert.match(homeMetrics, /return \['macros', 'savings'\]/);
});

test('Home week strip is clickable and has concise day empty states', () => {
  const weekStrip = readFileSync(resolve(process.cwd(), 'src/components/home/WeekStrip.tsx'), 'utf8');
  assert.match(home, /<WeekStrip[\s\S]*onDayPress/);
  assert.match(weekStrip, /Pressable/);
  assert.match(weekStrip, /const isPast = key < todayKey/);
  assert.match(weekStrip, /isToday \? styles\.todayDate/);
  assert.doesNotMatch(weekStrip, /todayCircle/);
  assert.match(weekStrip, /before Okyo started/);
  assert.doesNotMatch(home, /No dish captured yet\./);
  assert.match(home, /Your Okyo week starts here\./);
  assert.doesNotMatch(home, /Nothing here yet\. Scan a dish that day\./);
});

test('Home shows a real first-use CTA only until there is activity', () => {
  // The approved three-Kiko row plus its line, with a real coral CTA beside it.
  assert.match(home, /activityDates\.length === 0/);
  assert.match(home, /kiko-static\/approved\/kiko-soup-sticker\.png/);
  assert.match(home, /Scan your first dish to get started\./);
  assert.match(home, /Scan a dish/);

  // Returning users get Recent dishes instead, gated on real recent recipes.
  assert.match(home, /recentRecipes\.length > 0 \?/);
  const ctaIndex = home.indexOf('Scan your first dish to get started.');
  const recentIndex = home.indexOf('Recent dishes');
  assert.ok(recentIndex >= 0 && recentIndex < ctaIndex, 'Recent dishes must take priority over the CTA');
});

test('first-use CTA opens the same scan chooser as the global FAB', () => {
  assert.match(home, /useOpenScanActionSheet/);
  assert.match(home, /openSharedScanSheet\(\)/);
  assert.doesNotMatch(home, /<ScanActionSheet|useStartPickedScan|scanOptionsVisible/);
});

test('Home renders the approved three-Kiko artwork as a prominent, uncropped illustration', () => {
  // One asset containing three Kikos — not three separate images.
  const kikoAssets = home.match(/require\([^)]*kiko[^)]*\)/gi) ?? [];
  assert.equal(kikoAssets.length, 1, 'exactly one Kiko artwork source');
  // An explicit responsive cap makes the approved row prominent without
  // allowing it to exceed the CTA card. Height preserves the 3:1 ratio.
  assert.match(home, /const firstUseKikoWidth = Math\.min\(300, Math\.round\(width \* 0\.72\)\)/);
  assert.match(home, /height: Math\.round\(firstUseKikoWidth \/ 3\), width: firstUseKikoWidth/);
});

test("Today's ideas shows exactly two recipes", () => {
  assert.match(home, /HOME_IDEA_COUNT = 2/);
  assert.match(home, /getHomeIdeaIdsForLocalHour\(ideaHour\)/);
  assert.match(home, /setIdeaHour\(new Date\(\)\.getHours\(\)\)/);
  assert.doesNotMatch(home, /mealIdeas\.slice\(2, 4\)/);
  assert.match(home, /actionLabel="Explore"/);
});

test("Today's ideas registers its complete section, including Explore, as a tour anchor", () => {
  assert.match(home, /useTourAnchor\('home-recommended-section'\)/);
  assert.match(home, /ref=\{recommendedSectionAnchorRef\}/);
});

test('Home only offers ideas that have a real bundled photo', () => {
  assert.match(home, /recommendedRecipes\.find\(\(recipe\) => recipe\.id === id\)/);
  assert.doesNotMatch(home, /chocolate-mug-cake/);
});

test('metric visuals never fabricate history', () => {
  // A hardcoded arc chart previously rendered "$127 / $89 / $45" as if it were
  // the user's own trend.
  assert.doesNotMatch(metricCard, /\$127|\$89|\$45/);
  assert.doesNotMatch(metricCard, /StyledDonutChart|describeArc/);
});

test('future days replace Savings only; Macros retain their honest selected-day zeros', () => {
  assert.match(home, /futureSelectedDay/);
  assert.match(carousel, /futureDay/);
  assert.match(metricCard, /futureDay && metric\.kind === 'savings'/);
  assert.match(metricCard, /Cook a meal to see this/);
  assert.match(metricCard, /!futureMessage/);
});

test('Macros uses daily completed totals with calories primary and neutral nutrition styling', () => {
  assert.match(home, /selectedDayKey: selectedDateKey/);
  assert.match(carousel, /extraData=\{metrics\}/);
  assert.match(homeMetrics, /selectCompletedMacrosForDay/);
  assert.match(homeMetrics, /completedMeals/);
  assert.match(homeMetrics, /meal\.completedAt/);
  assert.match(homeMetrics, /caption: `calories · \$\{dayLabel\}`/);
  assert.match(homeMetrics, /label: 'Protein'/);
  assert.match(homeMetrics, /label: 'Fat'/);
  assert.match(homeMetrics, /label: 'Carbs'/);
  assert.doesNotMatch(homeMetrics, /average macros|meals averaged|avg calories|avg carbs|avg fat/);
  assert.match(metricCard, /macroArtwork/);
  assert.match(metricCard, /protein-dumbbell\.png/);
  assert.match(metricCard, /fat-droplet\.png/);
  assert.match(metricCard, /carbs-bread\.png/);
  assert.match(metricCard, /calories-kcal-new\.png/);
  assert.match(metricCard, /macros: colors\.ink/);
  assert.doesNotMatch(metricCard, /macros: colors\.macros/);
});

test('MainTabs mounts one coral scan FAB without changing tab order', () => {
  assert.match(tabs, /<ScanFab/);
  assert.equal((tabs.match(/<ScanFab/g) ?? []).length, 1, 'exactly one FAB');
  assert.match(tabs, /HomeScreen'[\s\S]*GroceryListScreen'[\s\S]*LibraryScreen'[\s\S]*SettingsScreen'/);
  assert.match(tabs, /DescribeMealScreen/);
  assert.match(tabs, /paddingRight: 68/);
  // The picker/scan wiring now lives in a hook shared with the Home CTA.
  const scanHook = readFileSync(resolve(process.cwd(), 'src/hooks/useStartPickedScan.ts'), 'utf8');
  assert.match(scanHook, /HOME_UPLOAD_TARGET_SCREEN/);
  assert.match(tabs, /useStartPickedScan/);
});

test('the scan FAB is anchored to the nav pill: mostly above it, not nested inside it', () => {
  assert.match(tabs, /useSafeAreaInsets/);
  assert.match(tabs, /bottom: bottomInset/);
  assert.match(tabs, /bottom=\{bottomInset \+ 48\}/);
});

test('Home shows the completed Health goal count and duration for the active goal', () => {
  assert.match(home, /healthBranchPersistence\.read\(\)\.then\(\(draft\) => \{[\s\S]*getHealthGoalSummary\(draft\)/);
  assert.match(home, /primaryGoal === 'eat_healthier' && healthGoalSummary/);
  assert.match(home, /healthGoalSummary\.detail/);
});
