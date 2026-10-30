import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Apple, Coins, Cutlery, Leaf, MenuScale, ShoppingBag, Sparks, SunLight, Timer, Weight } from '../assets/onboardingStickerIcons';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { BranchHeading, ChoiceRows, type ChoiceOption } from '../branch-ui/BranchControls';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';
import { formatGoalDate, type OnboardingGoal } from '../state/onboardingGoal';
import { type HealthDraft, type HealthGoalId } from '../state/healthBranch';

export type GoalOption = ChoiceOption<string>;

export const savingsGoalOptions: readonly GoalOption[] = [
  { id: '100', label: '$100', icon: Coins }, { id: '250', label: '$250', icon: Coins },
  { id: '500', label: '$500', icon: Coins }, { id: '1000', label: '$1,000', icon: Coins },
  { id: 'custom', label: 'Custom', icon: Coins },
];

/** Keeps savings goals tied to the amount this person can realistically save by cooking more. */
export function savingsGoalOptionsFor(weeklySavingsCents: number | null): readonly GoalOption[] {
  if (!weeklySavingsCents || weeklySavingsCents < 1_000) return savingsGoalOptions;
  const roundTo25 = (cents: number) => Math.max(5_000, Math.min(100_000, Math.round(cents / 2_500) * 2_500));
  const amounts = [...new Set([4, 8, 12].map((weeks) => roundTo25(weeklySavingsCents * weeks)))];
  return [...amounts.map((cents) => ({ id: String(cents / 100), label: `$${Math.round(cents / 100).toLocaleString()}`, icon: Coins })), { id: 'custom', label: 'Custom', icon: Coins }];
}

export const healthGoalOptions: readonly GoalOption[] = [
  { id: 'one_daily', label: 'One healthier meal a day', icon: Leaf },
  { id: 'four_week', label: 'Four healthier meals a week', icon: Leaf },
  { id: 'two_takeout', label: 'Replace two takeout meals a week', icon: ShoppingBag },
  { id: 'cook_home_three', label: 'Cook at home three times a week', icon: Cutlery },
  { id: 'whole_foods_daily', label: 'Add whole foods to one meal a day', icon: Apple },
  { id: 'healthier_breakfast_four', label: 'Make breakfast healthier four days a week', icon: SunLight },
  { id: 'balanced_meals_five', label: 'Eat more balanced meals five days a week', icon: MenuScale },
  { id: 'small_change_daily', label: 'Start with one small change a day', icon: Sparks },
  { id: 'custom', label: 'Something else', icon: Sparks },
];

const healthGoalBaseOrder = healthGoalOptions.map((option) => option.id as HealthGoalId);

export function recommendedHealthGoal(draft: Pick<HealthDraft, 'healthProblem' | 'healthBarrier' | 'healthDefinition' | 'mealToImprove' | 'flexibleCommitment' | 'foodStyles'>): HealthGoalId {
  const scores = Object.fromEntries(healthGoalBaseOrder.map((id) => [id, 0])) as Record<HealthGoalId, number>;
  const add = (id: Exclude<HealthGoalId, 'custom'>, points: number) => { scores[id] += points; };
  if (draft.healthProblem === 'too_much_takeout' || draft.healthDefinition === 'less_takeout') { add('two_takeout', 8); add('cook_home_three', 5); }
  if (draft.healthProblem === 'not_enough_whole_foods' || draft.healthDefinition === 'more_whole_foods') { add('whole_foods_daily', 6); add('four_week', 3); }
  if (draft.healthProblem === 'meals_unbalanced' || draft.healthDefinition === 'more_balanced_meals') add('balanced_meals_five', 6);
  if (draft.mealToImprove === 'breakfast') add('healthier_breakfast_four', 6);
  if (draft.mealToImprove === 'dinner') add('cook_home_three', 5);
  if (draft.healthBarrier === 'not_enough_time') { add('one_daily', 4); add('four_week', 3); add('small_change_daily', 3); }
  if (draft.flexibleCommitment === 'one_meal_daily') add('one_daily', 5);
  if (draft.flexibleCommitment === 'few_meals_weekly') add('four_week', 6);
  if (draft.flexibleCommitment === 'small_changes_days' || draft.flexibleCommitment === 'one_change_at_a_time') add('small_change_daily', 6);
  if (draft.foodStyles.includes('quick_simple')) add('cook_home_three', 2);
  return healthGoalBaseOrder.filter((id) => id !== 'custom').reduce((best, id) => scores[id] > scores[best] ? id : best, 'one_daily' as HealthGoalId);
}

export function prioritizeHealthGoalOptions(draft: Pick<HealthDraft, 'healthProblem' | 'healthBarrier' | 'healthDefinition' | 'mealToImprove' | 'flexibleCommitment' | 'foodStyles'>, recommendedId = recommendedHealthGoal(draft)): readonly GoalOption[] {
  const scores = new Map<HealthGoalId, number>(healthGoalBaseOrder.map((id, index) => [id, -index]));
  scores.set(recommendedId, 100);
  if (draft.healthProblem === 'too_much_takeout' || draft.healthDefinition === 'less_takeout') { scores.set('two_takeout', 90); scores.set('cook_home_three', 80); }
  if (draft.healthProblem === 'not_enough_whole_foods' || draft.healthDefinition === 'more_whole_foods') scores.set('whole_foods_daily', 90);
  if (draft.healthProblem === 'meals_unbalanced' || draft.healthDefinition === 'more_balanced_meals') scores.set('balanced_meals_five', 90);
  if (draft.mealToImprove === 'breakfast') scores.set('healthier_breakfast_four', 90);
  return [...healthGoalOptions].sort((a, b) => (scores.get(b.id as HealthGoalId) ?? 0) - (scores.get(a.id as HealthGoalId) ?? 0));
}

export const macrosGoalOptions: readonly GoalOption[] = [
  { id: '3_4', label: '3 days/week for 4 weeks', icon: Weight },
  { id: '5_4', label: '5 days/week for 4 weeks', icon: Weight },
  { id: '6_4', label: '6 days/week for 4 weeks', icon: Weight },
];

export function GoalQuestion({ branch, title, subtitle, options, selected, onSelect, recommendedId, customValue, onCustomValueChange, customPrompt, customPlaceholder, customAccessibilityLabel = 'Custom goal' }: {
  branch: 'save_money' | 'eat_healthier' | 'hit_macros'; title: string; subtitle: string; options: readonly GoalOption[]; selected: string | null; onSelect: (id: string) => void; recommendedId?: string; customValue?: string; onCustomValueChange?: (value: string) => void; customPrompt?: string; customPlaceholder?: string; customAccessibilityLabel?: string;
}) {
  const displayOptions = options.map((option) => option.id === recommendedId ? { ...option, badge: 'Recommended' } : option);
  return <View style={styles.question}>
    <BranchHeading subtitle={subtitle} title={title} />
    <ChoiceRows branch={branch} onSelect={onSelect} options={displayOptions} selected={selected ? [selected] : []} />
    {selected === 'custom' && onCustomValueChange ? <View style={styles.customWrap}>
      {customPrompt ? <Text style={styles.customPrompt}>{customPrompt}</Text> : null}
      <TextInput accessibilityLabel={customAccessibilityLabel} autoCapitalize="sentences" keyboardType={branch === 'save_money' ? 'number-pad' : 'default'} maxLength={80} onChangeText={onCustomValueChange} placeholder={customPlaceholder ?? (branch === 'save_money' ? 'Enter an amount' : 'Enter your goal')} style={styles.customInput} value={customValue} />
    </View> : null}
  </View>;
}

export function GoalTimelineCard({ goal, emphasis = 'default', compact = false, detail }: { goal: OnboardingGoal | null; emphasis?: 'default' | 'hero'; compact?: boolean; detail?: string | null }) {
  if (!goal) return null;
  const isSavings = goal.goalBranch === 'save_money';
  const weekly = goal.estimatedWeeklySavingsCents ? `$${Math.round(goal.estimatedWeeklySavingsCents / 100)}/week` : null;
  const isHero = emphasis === 'hero';
  const duration = goal.durationDays && goal.durationDays % 7 === 0 ? `${goal.durationDays / 7} weeks` : `${goal.durationDays ?? 14} days`;
  const cadence = goal.weeklyTarget ? `${Number.isInteger(goal.weeklyTarget) ? goal.weeklyTarget : `~${goal.weeklyTarget.toFixed(1)}`} meals / week` : goal.targetUnit === 'meal_per_day' ? `${goal.targetValue} meal${goal.targetValue === 1 ? '' : 's'} / day` : goal.targetUnit === 'meals_per_week' ? `${goal.targetValue} meals / week` : goal.targetUnit === 'takeout_meals_per_week' ? `Replace ${goal.targetValue} takeout / week` : goal.targetUnit === 'change_per_day' ? `${goal.targetValue} change / day` : goal.targetUnit === 'protein_days_per_week' || goal.targetUnit === 'calorie_days_per_week' || goal.targetUnit === 'days_per_week' ? `${goal.targetValue} days / week` : goal.targetUnit === 'day_streak' ? `${goal.targetValue}-day streak` : null;
  const support = isHero && goal.goalBranch === 'eat_healthier'
    ? goal.targetUnit === 'takeout_meals_per_week' ? `${goal.displayTitle} over the next ${duration}.` : `${goal.displayTitle} for the next ${duration}.`
    : weekly ? `Estimated pace: ${weekly}, based on the meals you told us about.` : goal.goalBranch === 'hit_macros' ? `${goal.displayTitle} for the next ${duration}.` : `${goal.durationDays} days of a small change that fits your routine.`;
  return <View accessibilityLabel={`Goal: ${goal.displayTitle}. Starts ${formatGoalDate(goal.startDate)}. Target ${formatGoalDate(goal.targetDate)}.`} style={[styles.card, isHero && styles.heroCard, isHero && compact && styles.heroCardCompact, branchShadow]}>
    <Text style={[styles.title, isHero && styles.heroTitle, isHero && compact && styles.heroTitleCompact]}>{goal.displayTitle}</Text>
    {isHero && detail ? <Text style={[styles.heroDetail, compact && styles.heroMetaCompact]}>{detail}</Text> : null}
    {isHero && cadence ? <Text style={[styles.heroMeta, compact && styles.heroMetaCompact]}>{cadence} • {goal.goalBranch === 'hit_macros' ? duration : `${goal.durationDays ?? 14}-day checkpoint`}</Text> : null}
    <View style={styles.timelineLabels}><View><Text style={styles.label}>START</Text><Text style={styles.date}>{formatGoalDate(goal.startDate)}</Text></View><View style={styles.target}><Text style={styles.label}>{isSavings ? 'ESTIMATED TARGET' : 'CHECKPOINT'}</Text><Text style={styles.date}>{formatGoalDate(goal.targetDate)}</Text></View></View>
    <View style={[styles.line, isHero && styles.heroLine]}><View style={[styles.dot, isHero && styles.heroDot]} /><View style={[styles.track, isHero && styles.heroTrack]} /><View style={[styles.dot, styles.endDot, isHero && styles.heroDot]} /></View>
    <Text style={[styles.support, isHero && styles.heroSupport, isHero && compact && styles.heroSupportCompact]}>{support}</Text>
  </View>;
}

const styles = StyleSheet.create({
  question: { flexGrow: 1, gap: 8, width: '100%' },
  card: { backgroundColor: branchSurfaces.card, borderColor: colors.coral, borderRadius: 22, borderWidth: 1, gap: 10, paddingHorizontal: 18, paddingVertical: 16, width: '100%' },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 20, lineHeight: 26 },
  heroCard: { backgroundColor: '#FFF9FA', borderColor: '#F7C8D6', borderRadius: 26, gap: 13, paddingHorizontal: 22, paddingVertical: 21 },
  heroCardCompact: { borderRadius: 22, gap: 10, paddingHorizontal: 18, paddingVertical: 16 },
  heroEyebrow: { fontSize: 12, letterSpacing: 1.3 },
  heroEyebrowCompact: { fontSize: 11, letterSpacing: 1.1 },
  heroTitle: { fontSize: 26, lineHeight: 32 },
  heroTitleCompact: { fontSize: 23, lineHeight: 28 },
  heroMeta: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 20 },
  heroDetail: { alignSelf: 'flex-start', backgroundColor: '#FDEBF1', borderRadius: 99, color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13, lineHeight: 18, overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 6 },
  heroMetaCompact: { fontSize: 13, lineHeight: 18 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  target: { alignItems: 'flex-end' },
  label: { color: branchSurfaces.muted, fontFamily: fontFamilies.bold, fontSize: 9, letterSpacing: 0.7 },
  date: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 14, marginTop: 2 },
  line: { alignItems: 'center', flexDirection: 'row', height: 14 },
  dot: { backgroundColor: colors.coral, borderRadius: 99, height: 12, width: 12 },
  endDot: { backgroundColor: colors.surface, borderColor: colors.coral, borderWidth: 2 },
  track: { backgroundColor: colors.coralSoft, flex: 1, height: 4 },
  support: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18 },
  heroLine: { height: 18 },
  heroDot: { height: 15, width: 15 },
  heroTrack: { backgroundColor: '#F6B5C8', height: 5 },
  heroSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 21 },
  heroSupportCompact: { fontSize: 13, lineHeight: 19 },
  customInput: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: 16, borderWidth: 1, color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 18, paddingHorizontal: 16, paddingVertical: 13 },
  customWrap: { gap: 8 },
  customPrompt: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 14 },
});
