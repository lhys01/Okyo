import { Check, PiggyBank, Spark, StatsUpSquare } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { EMPTY_FOOD_PREFERENCES, type FoodPreferences } from '../../state/foodPreferences';
import { getKikoOnboardingAssignment, type KikoOnboardingBranch } from '../assets/kikoOnboardingRegistry';
import { HoldToReveal } from '../components/HoldToReveal';
import { KikoOnboardingArtwork } from '../components/KikoOnboardingArtwork';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { OnboardingV3State } from '../controller/onboardingV3Machine';
import {
  PRIMARY_GOALS,
  annualTakeoutSpend,
  conservativeAnnualProjection,
  estimatedHomeMealCost,
  personalizedGoalContent,
  primaryGoalLabels,
  type PersonalizedAnswer,
  type PersonalizedQuestion,
  type PrimaryGoal,
} from '../state/personalizedOnboarding';

type Props = {
  state: OnboardingV3State;
  onAnswer: (key: string, value: PersonalizedAnswer) => void;
  onBack: () => void;
  onContinue: () => void;
  onDietary: (preferences: FoodPreferences) => void;
  onGoal: (goal: PrimaryGoal) => void;
  onHoldComplete: () => void;
  onName: (name: string) => void;
};

const questionSteps = ['question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7', 'question8', 'question9'] as const;
const dietaryGroups = {
  allergies: ['Peanuts', 'Tree nuts', 'Dairy / milk', 'Eggs', 'Wheat', 'Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'],
  restrictions: ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Pescatarian', 'Halal', 'Kosher'],
  avoidances: ['Pork', 'Beef', 'Alcohol in recipes', 'Spicy food', 'Added sugar'],
} as const;
const food = {
  savings: require('../../../assets/food/recipes/creamy-tomato-rigatoni.png'),
  health: require('../../../assets/food/recipes/avocado-toast-poached-egg.png'),
  macros: require('../../../assets/food/recipes/garlic-chicken-rice-bowl.png'),
};

export function PersonalizedOnboardingScreen(props: Props) {
  const { state } = props;
  if (state.step === 'name') return <NameStep initialName={state.profile.name} onBack={props.onBack} onSubmit={props.onName} />;
  if (state.step === 'primaryGoal') return <PrimaryGoalStep selected={state.profile.primaryGoal} onBack={props.onBack} onSelect={props.onGoal} />;
  if (questionSteps.includes(state.step as (typeof questionSteps)[number])) return <QuestionStep {...props} step={state.step as (typeof questionSteps)[number]} />;
  if (state.step === 'holdReveal') {
    const goal = requireGoal(state);
    return <BranchShell goal={goal} onBack={props.onBack}><HoldToReveal onComplete={props.onHoldComplete} prompt={personalizedGoalContent[goal].holdPrompt} /></BranchShell>;
  }
  if (state.step === 'branchReveal' || state.step === 'branchInsight' || state.step === 'nutritionTargets' || state.step === 'branchDemo') {
    return <StoryStep onBack={props.onBack} onContinue={props.onContinue} state={state} step={state.step} />;
  }
  if (state.step === 'dietaryPreferences') return <DietaryPreferencesStep profile={state.profile} onBack={props.onBack} onSubmit={props.onDietary} />;
  if (state.step === 'planReady') return <PlanReadyStep onBack={props.onBack} onContinue={props.onContinue} state={state} />;
  return null;
}

function NameStep({ initialName, onBack, onSubmit }: { initialName: string; onBack: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <Header onBack={onBack} />
        <View style={styles.centerContent}>
          <Text style={styles.displayTitle}>What should we call you?</Text>
          <TextInput accessibilityLabel="Your name" autoCapitalize="words" autoCorrect={false} maxLength={40} onChangeText={setName} onSubmitEditing={() => trimmed && onSubmit(trimmed)} placeholder="Your name" placeholderTextColor={colors.muted} returnKeyType="done" style={styles.nameInput} value={name} />
          <Text style={styles.microcopy}>No account or email needed.</Text>
        </View>
        <Footer><OnboardingCTA disabled={!trimmed} label="Continue" onPress={() => onSubmit(trimmed)} variant="questionnaire" /></Footer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryGoalStep({ selected, onBack, onSelect }: { selected: PrimaryGoal | null; onBack: () => void; onSelect: (goal: PrimaryGoal) => void }) {
  return (
    <SimpleShell onBack={onBack} scroll>
      <Text style={styles.displayTitle}>What would you like Okyo to make easier?</Text>
      <View style={styles.goalList}>
        {PRIMARY_GOALS.map((goal) => <GoalCard key={goal} goal={goal} selected={selected === goal} onPress={() => onSelect(goal)} />)}
      </View>
    </SimpleShell>
  );
}

function QuestionStep(props: Props & { step: (typeof questionSteps)[number] }) {
  const goal = requireGoal(props.state);
  const index = questionSteps.indexOf(props.step);
  const question = personalizedGoalContent[goal].questions[index];
  const answer = props.state.profile.answers[question.id];
  const valid = question.optional || (Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer !== null && answer !== '');
  return (
    <BranchShell footer={<OnboardingCTA disabled={!valid} label="Continue" onPress={props.onContinue} variant="questionnaire" />} goal={goal} onBack={props.onBack} scroll>
      <Text style={styles.questionTitle}>{question.title}</Text>
      <QuestionControl answer={answer} goal={goal} onChange={(value) => props.onAnswer(question.id, value)} question={question} />
    </BranchShell>
  );
}

function QuestionControl({ question, answer, onChange, goal }: { question: PersonalizedQuestion; answer: PersonalizedAnswer | undefined; onChange: (value: PersonalizedAnswer) => void; goal: PrimaryGoal }) {
  if (question.kind === 'money') {
    const value = typeof answer === 'number' ? answer : 25;
    return <View style={styles.numberStage}><Text style={styles.giantNumber}>{value >= 50 ? '$50+' : `$${value}`}</Text><View style={styles.numberActions}><RoundButton label="−" onPress={() => onChange(Math.max(10, value - 5))} /><View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${((value - 10) / 40) * 100}%` }]} /></View><RoundButton label="+" onPress={() => onChange(Math.min(50, value + 5))} /></View><Text style={styles.microcopy}>Per meal</Text></View>;
  }
  if (question.kind === 'protein') {
    const value = typeof answer === 'number' ? answer : 150;
    return <View><OptionCard label="Use Okyo's starting estimate" selected={answer === null || answer === undefined} onPress={() => onChange(null)} /><OptionCard label="I know my target" selected={typeof answer === 'number'} onPress={() => onChange(value)} />{typeof answer === 'number' ? <View style={styles.targetPanel}><Text style={styles.targetLabel}>DAILY PROTEIN</Text><Text style={styles.giantNumber}>{value}g</Text><View style={styles.numberActions}><RoundButton label="−" onPress={() => onChange(Math.max(40, value - 5))} /><RoundButton label="+" onPress={() => onChange(Math.min(350, value + 5))} /></View></View> : null}</View>;
  }
  if (question.kind === 'number' || question.kind === 'stepper') {
    const fallback = question.id === 'ageYears' ? 28 : question.id === 'heightCm' ? 170 : question.id === 'weightKg' ? 70 : 3;
    const min = question.id === 'ageYears' ? 13 : question.id === 'heightCm' ? 120 : question.id === 'weightKg' ? 35 : 0;
    const max = question.id === 'ageYears' ? 100 : question.id === 'heightCm' ? 230 : question.id === 'weightKg' ? 300 : 7;
    const increment = question.id === 'heightCm' || question.id === 'weightKg' ? 1 : 1;
    const value = typeof answer === 'number' ? answer : fallback;
    const suffix = question.id === 'heightCm' ? ' cm' : question.id === 'weightKg' ? ' kg' : question.id === 'trainingDays' ? ' days' : '';
    return <View style={styles.numberStage}><Text style={styles.giantNumber}>{value}{suffix}</Text><View style={styles.numberActions}><RoundButton label="−" onPress={() => onChange(Math.max(min, value - increment))} /><RoundButton label="+" onPress={() => onChange(Math.min(max, value + increment))} /></View>{question.helper ? <Text style={styles.microcopy}>{question.helper}</Text> : null}</View>;
  }
  const selected = Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : [];
  return <View style={styles.optionList}>{question.options?.map((option) => <OptionCard key={option} label={option} selected={selected.includes(option)} onPress={() => question.kind === 'multi' ? onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]) : onChange(option)} tone={goal} />)}</View>;
}

function StoryStep({ state, step, onBack, onContinue }: { state: OnboardingV3State; step: 'branchReveal' | 'branchInsight' | 'nutritionTargets' | 'branchDemo'; onBack: () => void; onContinue: () => void }) {
  const goal = requireGoal(state);
  if (step === 'nutritionTargets') return <NutritionTargetsStep state={state} onBack={onBack} onContinue={onContinue} />;
  return (
    <BranchShell background={goal === 'save_money' ? '#EAF8E8' : undefined} footer={<OnboardingCTA label="Continue" onPress={onContinue} />} goal={goal} onBack={onBack} scroll>
      {goal === 'save_money' ? <SavingsStory state={state} step={step} /> : goal === 'eat_healthier' ? <HealthStory step={step} /> : <MacroStory state={state} step={step} />}
    </BranchShell>
  );
}

function SavingsStory({ state, step }: { state: OnboardingV3State; step: Exclude<Parameters<typeof StoryStep>[0]['step'], 'nutritionTargets'> }) {
  if (step === 'branchReveal') {
    const annual = annualTakeoutSpend(state.profile);
    return <><AssignedKiko goal="save_money" step={step} /><Text style={styles.heroTitle}>That’s roughly what takeout adds up to in a year.</Text><View style={[styles.moneyResult, styles.moneyResultTall]}><Text style={styles.moneyCaption}>ESTIMATED YEARLY SPEND</Text><Text style={styles.moneyValue}>${annual.toLocaleString()}</Text><Text style={styles.disclosure}>Based on your takeout frequency and typical meal price.</Text></View></>;
  }
  if (step === 'branchInsight') return <><AssignedKiko goal="save_money" step="branchDemo" /><Text style={styles.heroTitle}>{savingsEncouragement(state.profile.savings.orderingFriction, state.profile.savings.realisticCookingFrequency)}</Text><Text style={styles.storyBody}>Your plan will prioritize recipes that fit your real routine.</Text></>;
  if (step === 'branchDemo') { const orderCost = state.profile.savings.spendPerMeal ?? 0; const homeCost = estimatedHomeMealCost(state.profile); return <><AssignedKiko goal="save_money" step={step} /><Text style={styles.heroTitle}>What if ${orderCost} became about ${Math.round(homeCost)}?</Text><FoodHero source={food.savings} /><ComparisonStrip left={`$${orderCost} order`} right={`~$${Math.round(homeCost)} at home`} /><Text style={styles.disclosure}>Cautious homemade ingredient estimate.</Text></>; }
  return <><Text style={styles.heroTitle}>One home meal a week can change the picture.</Text><SavingsGraph amount={conservativeAnnualProjection(state.profile)} /></>;
}

function HealthStory({ step }: { step: Exclude<Parameters<typeof StoryStep>[0]['step'], 'nutritionTargets'> }) {
  if (step === 'branchReveal') return <><Text style={styles.heroTitle}>KEEP THE CRAVING.</Text><View style={styles.foodFrame}><Image source={food.health} style={styles.foodImage} /><View style={styles.foodKiko}><AssignedKiko goal="eat_healthier" step={step} /></View></View><ComparisonStrip left="Before 420 cal" right="After 270 cal" /></>;
  if (step === 'branchInsight') return <><Text style={styles.heroTitle}>NUTRITION WITHOUT THE HOMEWORK.</Text><Text style={styles.storyBody}>Okyo will show the amount of detail you asked for, while keeping food satisfying.</Text><FoodHero source={food.health} /></>;
  if (step === 'branchDemo') return <><Text style={styles.heroTitle}>CHANGE WHAT NEEDS CHANGING.</Text><NutritionPanel /><Text style={styles.disclosure}>Example nutrition only.</Text></>;
  return <><Text style={styles.heroTitle}>FOOD YOU LOVE. BETTER FIT.</Text><FoodHero source={food.health} /><View style={styles.healthPromise}><Text style={styles.promiseStrong}>MORE PROTEIN</Text><Text style={styles.promiseStrong}>BETTER PORTIONS</Text><Text style={styles.promiseStrong}>SAME CRAVING</Text></View></>;
}

function MacroStory({ state, step }: { state: OnboardingV3State; step: Exclude<Parameters<typeof StoryStep>[0]['step'], 'nutritionTargets'> }) {
  const target = state.profile.nutritionTargets?.proteinGrams ?? 150;
  if (step === 'branchReveal') return <><AssignedKiko goal="hit_macros" step={step} /><Text style={styles.heroTitle}>NEXT, WE’LL ESTIMATE YOUR STARTING TARGETS.</Text><Text style={styles.storyBody}>Your activity and training routine help us estimate your typical daily energy needs.</Text></>;
  if (step === 'branchInsight') return <><Text style={styles.heroTitle}>YOUR STARTING TARGET IS READY.</Text><TargetRows targets={state.profile.nutritionTargets} target={target} /></>;
  if (step === 'branchDemo') { const percent = Math.round((42 / target) * 100); return <><Text style={styles.heroTitle}>GREAT FOOD. YOUR NUMBERS.</Text><FoodHero source={food.macros} /><NutritionPanel macros targets={state.profile.nutritionTargets} /><Text style={styles.storyBody}>42g protein is {percent}% of your daily target.</Text></>; }
  return <><Text style={styles.heroTitle}>SEE THE TARGET. EAT THE FOOD.</Text><MacroDashboard /></>;
}

function NutritionTargetsStep({ state, onBack, onContinue }: { state: OnboardingV3State; onBack: () => void; onContinue: () => void }) {
  const targets = state.profile.nutritionTargets;
  return <BranchShell footer={<OnboardingCTA label="Looks good" onPress={onContinue} />} goal="hit_macros" onBack={onBack} scroll><Text style={styles.heroTitle}>Your starting targets</Text><TargetRows targets={targets} target={targets?.proteinGrams ?? 150} /><Text style={styles.disclosure}>These are starting estimates, not a prescription. You can edit them anytime.</Text></BranchShell>;
}

function DietaryPreferencesStep({ profile, onBack, onSubmit }: { profile: OnboardingV3State['profile']; onBack: () => void; onSubmit: (preferences: FoodPreferences) => void }) {
  const [preferences, setPreferences] = useState<FoodPreferences>(profile.dietaryPreferences ?? EMPTY_FOOD_PREFERENCES);
  const [dislike, setDislike] = useState('');
  const toggle = (group: keyof FoodPreferences, option: string) => setPreferences((current) => ({ ...current, [group]: current[group].includes(option) ? current[group].filter((item) => item !== option) : [...current[group], option] }));
  const addDislike = () => { const value = dislike.trim(); if (!value) return; setPreferences((current) => ({ ...current, dislikes: current.dislikes.includes(value) ? current.dislikes : [...current.dislikes, value] })); setDislike(''); };
  return <SimpleShell footer={<OnboardingCTA label="Continue" onPress={() => onSubmit(preferences)} />} onBack={onBack} scroll><Text style={styles.displayTitle}>What should we remember?</Text><Text style={styles.dietaryIntro}>We’ll treat allergies as hard limits. Always check labels when allergies are involved.</Text>{(Object.keys(dietaryGroups) as Array<keyof typeof dietaryGroups>).map((group) => <View key={group}><Text style={styles.groupTitle}>{group === 'restrictions' ? 'Dietary restrictions' : group}</Text><View style={styles.chipWrap}>{dietaryGroups[group].map((option) => <OptionChip key={option} label={option} selected={preferences[group].includes(option)} onPress={() => toggle(group, option)} />)}</View></View>)}<Text style={styles.groupTitle}>Foods to avoid / dislikes</Text><View style={styles.chipWrap}>{preferences.dislikes.map((item) => <OptionChip key={item} label={item} selected onPress={() => toggle('dislikes', item)} />)}</View><View style={styles.dislikeRow}><TextInput accessibilityLabel="Food dislike" maxLength={80} onChangeText={setDislike} onSubmitEditing={addDislike} placeholder="Add a food dislike" placeholderTextColor={colors.muted} style={styles.dislikeInput} value={dislike} /><Pressable accessibilityLabel="Add dislike" accessibilityRole="button" onPress={addDislike} style={styles.addDislike}><Text style={styles.addDislikeText}>Add</Text></Pressable></View></SimpleShell>;
}

function PlanReadyStep({ state, onBack, onContinue }: { state: OnboardingV3State; onBack: () => void; onContinue: () => void }) {
  const goal = requireGoal(state);
  const assignment = getKikoOnboardingAssignment('shared', 'personalized-plan-ready');
  const details = goal === 'save_money' ? [`Takeout: ${state.profile.savings.takeoutFrequency ?? '—'}`, `Hands-on cooking: ${state.profile.savings.handsOnTimeMinutes ?? '—'} min`, `Cooking for: ${state.profile.savings.householdSize ?? '—'}`] : goal === 'eat_healthier' ? [`Focus: ${state.profile.health.healthGoals.join(', ') || 'Balanced meals'}`, `Hardest meals: ${state.profile.health.difficultMeals.join(', ') || '—'}`, `Nutrition: ${state.profile.health.trackingPreference ?? 'As you like'}`] : [`${state.profile.nutritionTargets?.calories ?? '—'} cal/day`, `${state.profile.nutritionTargets?.proteinGrams ?? '—'}g protein`, `Training: ${state.profile.nutritionProfile.trainingDaysPerWeek ?? '—'} days/week`];
  return <BranchShell background={goal === 'save_money' ? '#EAF8E8' : undefined} footer={<OnboardingCTA label="Continue" onPress={onContinue} />} goal={goal} onBack={onBack} scroll>{assignment?.assetId && assignment.size !== 'none' ? <KikoOnboardingArtwork assetId={assignment.assetId} sizeRole={assignment.size} style={styles.planKiko} /> : null}<Text style={styles.heroTitle}>Your Okyo plan{state.profile.name ? `, ${state.profile.name}` : ''}</Text><View style={styles.planDetails}>{details.map((detail) => <Text key={detail} style={styles.planDetail}>{detail}</Text>)}</View><View style={styles.benefitCard}>{personalizedGoalContent[goal].planBenefits.map((benefit) => <View key={benefit} style={styles.benefitRow}><Check color={colors.green} height={19} strokeWidth={3} width={19} /><Text style={styles.benefitText}>{benefit}</Text></View>)}</View></BranchShell>;
}

function SavingsIntroVisual() { return <View style={styles.coinStage}><View style={styles.coinBack}><Text style={styles.coinText}>$</Text></View><View style={styles.receipt}><Text style={styles.receiptSmall}>THIS WEEK</Text><Text style={styles.receiptValue}>$94</Text><View style={styles.receiptLine} /><View style={styles.receiptLine} /><View style={[styles.receiptLine, { width: '52%' }]} /></View></View>; }
function FoodHero({ source }: { source: number }) { return <View style={styles.foodFrame}><Image resizeMode="cover" source={source} style={styles.foodImage} /></View>; }
function ComparisonStrip({ left, right }: { left: string; right: string }) { return <View style={styles.comparison}><Text style={styles.comparisonMuted}>{left}</Text><Text style={styles.comparisonArrow}>→</Text><Text style={styles.comparisonStrong}>{right}</Text></View>; }
function SavingsGraph({ amount }: { amount: number }) { return <View style={styles.graphCard}><Text style={styles.graphLead}>SAVE ABOUT</Text><Text style={styles.graphAmount}>${amount.toLocaleString()}</Text><View style={styles.graphBars}>{[28, 45, 65, 88, 116, 148].map((height, index) => <View key={height} style={[styles.graphBar, { height, opacity: 0.42 + index * 0.1 }]} />)}</View><Text style={styles.disclosure}>One replaced order weekly. Estimate only.</Text></View>; }
function NutritionPanel({ macros = false, targets }: { macros?: boolean; targets?: OnboardingV3State['profile']['nutritionTargets'] }) { const values = macros ? [['570', 'CAL'], ['42g', 'PROTEIN'], [`${Math.round((targets?.carbsGrams ?? 210) * 0.23)}g`, 'CARBS'], [`${Math.round((targets?.fatGrams ?? 70) * 0.25)}g`, 'FAT']] : [['270', 'CAL'], ['24g', 'PROTEIN'], ['31g', 'CARBS'], ['8g', 'FAT']]; return <View style={styles.nutritionPanel}>{values.map(([value, label]) => <View key={label} style={styles.nutritionCell}><Text style={styles.nutritionValue}>{value}</Text><Text style={styles.nutritionLabel}>{label}</Text></View>)}</View>; }
function TargetRows({ target, targets }: { target: number; targets?: OnboardingV3State['profile']['nutritionTargets'] }) { return <View style={styles.targetRows}>{[['CALORIES', `${targets?.calories ?? '—'}`, 0.72], ['PROTEIN', `${target}g`, 0.86], ['CARBS', `${targets?.carbsGrams ?? '—'}g`, 0.58], ['FAT', `${targets?.fatGrams ?? '—'}g`, 0.66]].map(([label, value, progress]) => <View key={String(label)} style={styles.targetRow}><View style={styles.ring}><View style={[styles.ringFill, { transform: [{ rotate: `${Number(progress) * 250}deg` }] }]} /></View><View><Text style={styles.targetRowLabel}>{label}</Text><Text style={styles.targetRowValue}>{value}</Text></View></View>)}</View>; }
function MacroDashboard({ compact = false }: { compact?: boolean }) { return <View style={[styles.dashboard, compact ? styles.dashboardCompact : styles.dashboardHero]}><Text style={styles.dashboardToday}>TODAY</Text><View style={styles.dashboardRow}>{[['2,100', 'CAL'], ['150g', 'PROTEIN'], ['210g', 'CARBS'], ['70g', 'FAT']].map(([value, label]) => <View key={label} style={styles.dashboardCell}><View style={styles.dashboardRing} /><Text style={styles.dashboardValue}>{value}</Text><Text style={styles.dashboardLabel}>{label}</Text></View>)}</View></View>; }

function AssignedKiko({ goal, step }: { goal: PrimaryGoal; step: 'branchReveal' | 'branchDemo' }) {
  const lookup: Partial<Record<PrimaryGoal, Partial<Record<typeof step, string>>>> = { save_money: { branchReveal: 'annual-spending-reveal', branchDemo: 'savings-demonstration' }, eat_healthier: { branchReveal: 'favorite-foods-reveal', branchDemo: 'nutrition-data' }, hit_macros: { branchReveal: 'macro-transformation', branchDemo: 'macro-result' } };
  const moment = lookup[goal]?.[step];
  if (!moment) return null;
  const assignment = getKikoOnboardingAssignment(goalToRegistryBranch(goal), moment);
  if (!assignment?.assetId || assignment.size === 'none') return null;
  return <KikoOnboardingArtwork assetId={assignment.assetId} sizeRole={assignment.size} style={styles.storyKiko} />;
}

function savingsEncouragement(friction: string[], frequency: string | null): string { if (friction.includes("I'm missing ingredients")) return 'We’ll start with more of what you already have.'; if (friction.includes("I don't have much time")) return 'We’ll prioritize meals that fit your available time.'; if (friction.includes("I don't know what to make")) return 'We’ll make choosing a cheaper meal feel easier.'; return frequency ? `We’ll make ${frequency.toLowerCase()} feel realistic.` : 'We’ll make the cheaper choice easier.'; }
function BranchShell({ children, footer, goal, onBack, scroll = false, background }: { children: ReactNode; footer?: ReactNode; goal: PrimaryGoal; onBack: () => void; scroll?: boolean; background?: string }) { return <SimpleShell background={background ?? colors.background} footer={footer} onBack={onBack} scroll={scroll}>{children}</SimpleShell>; }
function SimpleShell({ children, footer, onBack, scroll = false, background = colors.background }: { children: ReactNode; footer?: ReactNode; onBack: () => void; scroll?: boolean; background?: string }) { const content = scroll ? <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={styles.centerContent}>{children}</View>; return <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: background }]}><Header onBack={onBack} />{content}{footer ? <Footer>{footer}</Footer> : null}</SafeAreaView>; }
function Header({ onBack }: { onBack: () => void }) { return <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>; }
function Footer({ children }: { children: ReactNode }) { return <View style={styles.footer}>{children}</View>; }
function GoalCard({ goal, selected, onPress }: { goal: PrimaryGoal; selected: boolean; onPress: () => void }) { const Icon = goal === 'save_money' ? PiggyBank : goal === 'eat_healthier' ? Spark : StatsUpSquare; return <Pressable accessibilityLabel={primaryGoalLabels[goal]} accessibilityRole="button" onPress={onPress} style={[styles.goalCard, selected && styles.goalCardSelected]}><View style={styles.goalIcon}><Icon color={selected ? '#FFFFFF' : colors.charcoal} height={30} width={30} /></View><Text style={[styles.goalText, selected && styles.goalTextSelected]}>{primaryGoalLabels[goal]}</Text><Text style={[styles.goalArrow, selected && styles.goalTextSelected]}>→</Text></Pressable>; }
function OptionCard({ label, selected, onPress, badge, tone }: { label: string; selected: boolean; onPress: () => void; badge?: string; tone?: PrimaryGoal }) { return <Pressable accessibilityLabel={badge ? `${label}, ${badge}` : label} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, tone === 'hit_macros' && styles.optionMacro, pressed && styles.pressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>{badge ? <Text style={styles.badge}>{badge}</Text> : null}{selected ? <Check color="#FFFFFF" height={21} strokeWidth={3} width={21} /> : null}</Pressable>; }
function OptionChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function RoundButton({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'} accessibilityRole="button" onPress={onPress} style={styles.roundButton}><Text style={styles.roundButtonText}>{label}</Text></Pressable>; }
function requireGoal(state: OnboardingV3State): PrimaryGoal { return state.profile.primaryGoal ?? 'save_money'; }
function sectionForQuestion(goal: PrimaryGoal, index: number) { if (goal === 'hit_macros') return index < 4 ? 'ABOUT' : index < 8 ? 'GOALS' : 'PLAN'; return index < 2 ? 'GOALS' : index < 5 ? 'FOOD' : 'PLAN'; }
function goalToRegistryBranch(goal: PrimaryGoal): KikoOnboardingBranch { return goal === 'save_money' ? 'saveMoney' : goal === 'eat_healthier' ? 'eatHealthier' : 'hitMacros'; }

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, flex: { flex: 1 }, header: { alignItems: 'flex-start', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP }, centerContent: { flex: 1, justifyContent: 'center', paddingBottom: 22, paddingHorizontal: 24 }, scrollContent: { flexGrow: 1, paddingBottom: 136, paddingHorizontal: 24, paddingTop: 12 }, footer: { paddingBottom: 8, paddingHorizontal: 24, paddingTop: 10 },
  displayTitle: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 36, letterSpacing: -0.6, lineHeight: 42 }, heroTitle: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 34, letterSpacing: -0.7, lineHeight: 39, marginBottom: 18, textAlign: 'center' }, macroHero: { color: '#20212A' }, questionTitle: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 34, letterSpacing: -0.4, lineHeight: 40 }, microcopy: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 12, marginTop: 10, textAlign: 'center' }, storyBody: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 17, lineHeight: 24, marginBottom: 24, textAlign: 'center' },
  nameInput: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 24, borderWidth: 1, color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 28, marginTop: 30, minHeight: 76, paddingHorizontal: 20 }, goalList: { gap: 14, marginTop: 34 }, goalCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 26, borderWidth: 1, flexDirection: 'row', minHeight: 92, padding: 18 }, goalCardSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal }, goalIcon: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }, goalText: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.bold, fontSize: 18, marginLeft: 10 }, goalTextSelected: { color: '#FFFFFF' }, goalArrow: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 25 },
  introContent: { alignItems: 'center', flex: 1, justifyContent: 'space-around' }, introLine: { color: colors.body, fontFamily: fontFamilies.bold, fontSize: 17, textAlign: 'center' }, coinStage: { alignItems: 'center', height: 300, justifyContent: 'center', width: '100%' }, coinBack: { alignItems: 'center', backgroundColor: '#67C978', borderRadius: 110, height: 220, justifyContent: 'center', left: 10, position: 'absolute', transform: [{ rotate: '-10deg' }], width: 220 }, coinText: { color: '#DFF7DC', fontFamily: fontFamilies.personalizedDisplay, fontSize: 150 }, receipt: { backgroundColor: '#FFFFFF', borderRadius: 20, elevation: 5, padding: 22, position: 'absolute', right: 12, shadowColor: '#193E20', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.16, shadowRadius: 18, transform: [{ rotate: '7deg' }], width: 160 }, receiptSmall: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 10 }, receiptValue: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 48 }, receiptLine: { backgroundColor: '#D9DED8', height: 5, marginTop: 9, width: '100%' },
  optionList: { gap: 10, marginTop: 24 }, option: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.84)', borderColor: 'rgba(34,34,38,0.06)', borderRadius: 20, borderWidth: 1, flexDirection: 'row', minHeight: 64, paddingHorizontal: 18, paddingVertical: 13 }, optionMacro: { borderRadius: 14 }, optionSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal }, optionText: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 }, optionTextSelected: { color: '#FFFFFF' }, pressed: { opacity: 0.76 }, badge: { backgroundColor: '#DDF1E0', borderRadius: 99, color: colors.green, fontFamily: fontFamilies.bold, fontSize: 11, marginRight: 8, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  numberStage: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 440 }, giantNumber: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 100, letterSpacing: -2, lineHeight: 106 }, numberActions: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 28 }, roundButton: { alignItems: 'center', backgroundColor: colors.charcoal, borderRadius: 30, height: 56, justifyContent: 'center', width: 56 }, roundButtonText: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 29, lineHeight: 32 }, sliderTrack: { backgroundColor: 'rgba(34,34,38,0.12)', borderRadius: 99, height: 12, overflow: 'hidden', width: 180 }, sliderFill: { backgroundColor: colors.charcoal, borderRadius: 99, height: 12 }, targetPanel: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 28, marginTop: 28, minHeight: 320, padding: 28 }, targetLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 13 },
  storyKiko: { alignSelf: 'center', marginBottom: 0, maxHeight: 210 }, planKiko: { alignSelf: 'center', maxHeight: 210 }, foodFrame: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 36, height: 330, marginBottom: 18, overflow: 'hidden', width: '100%' }, foodImage: { height: '100%', width: '100%' }, moneyResult: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 32, marginTop: 4, paddingHorizontal: 20, paddingVertical: 28 }, moneyResultTall: { justifyContent: 'center', minHeight: 300 }, moneyCaption: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12 }, moneyValue: { color: '#39A94C', fontFamily: fontFamilies.personalizedDisplay, fontSize: 88, letterSpacing: -2, lineHeight: 94 }, disclosure: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 11, lineHeight: 15, marginTop: 9, textAlign: 'center' }, comparison: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, flexDirection: 'row', justifyContent: 'center', padding: 17 }, comparisonMuted: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 14 }, comparisonArrow: { color: colors.charcoal, fontSize: 18, marginHorizontal: 12 }, comparisonStrong: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 16 },
  graphCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 30, padding: 22, transform: [{ rotate: '-1deg' }] }, graphLead: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11 }, graphAmount: { color: '#39A94C', fontFamily: fontFamilies.personalizedDisplay, fontSize: 70, lineHeight: 76 }, graphBars: { alignItems: 'flex-end', flexDirection: 'row', gap: 9, height: 160, marginTop: 8, width: '100%' }, graphBar: { backgroundColor: '#45BA58', borderRadius: 8, flex: 1 }, healthPromise: { backgroundColor: '#FFFFFF', borderRadius: 24, gap: 11, padding: 20 }, promiseStrong: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 25, textAlign: 'center' },
  nutritionPanel: { backgroundColor: '#FFFFFF', borderRadius: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 2, overflow: 'hidden', padding: 8 }, nutritionCell: { alignItems: 'center', backgroundColor: '#F8F8F8', justifyContent: 'center', minHeight: 120, width: '49.8%' }, nutritionValue: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 44 }, nutritionLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 10 }, targetRows: { gap: 10 }, targetRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, flexDirection: 'row', gap: 16, minHeight: 82, padding: 14 }, ring: { borderColor: '#E6E7EC', borderRadius: 27, borderWidth: 7, height: 54, overflow: 'hidden', width: 54 }, ringFill: { backgroundColor: '#F17C69', height: 27, width: 27 }, targetRowLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 10 }, targetRowValue: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 23 },
  dashboard: { backgroundColor: '#17181D', borderRadius: 32, marginTop: 6, padding: 22 }, dashboardCompact: { marginVertical: 28, paddingVertical: 30 }, dashboardHero: { justifyContent: 'center', minHeight: 360 }, dashboardToday: { color: '#A8AAB2', fontFamily: fontFamilies.bold, fontSize: 12 }, dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }, dashboardCell: { alignItems: 'center', width: '24%' }, dashboardRing: { borderColor: '#62646C', borderRadius: 24, borderTopColor: '#FFFFFF', borderWidth: 6, height: 48, marginBottom: 10, width: 48 }, dashboardValue: { color: '#FFFFFF', fontFamily: fontFamilies.personalizedDisplay, fontSize: 23 }, dashboardLabel: { color: '#A8AAB2', fontFamily: fontFamilies.bold, fontSize: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }, chip: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 99, borderWidth: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 17 }, chipSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal }, chipText: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 14 }, chipTextSelected: { color: '#FFFFFF' }, dietaryIntro: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 14, lineHeight: 20, marginTop: 14 }, groupTitle: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.7, marginTop: 24, textTransform: 'uppercase' }, dislikeRow: { flexDirection: 'row', gap: 10, marginTop: 14 }, dislikeInput: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 18, borderWidth: 1, color: colors.charcoal, flex: 1, fontFamily: fontFamilies.body, fontSize: 15, minHeight: 54, paddingHorizontal: 14 }, addDislike: { alignItems: 'center', backgroundColor: colors.charcoal, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 16 }, addDislikeText: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 14 }, planDetails: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 22, gap: 8, padding: 18 }, planDetail: { color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 15 }, benefitCard: { backgroundColor: '#FFFFFF', borderRadius: 26, gap: 15, marginTop: 16, padding: 20 }, benefitRow: { alignItems: 'center', flexDirection: 'row', gap: 10 }, benefitText: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 19 }, foodKiko: { bottom: -26, left: -18, position: 'absolute', transform: [{ scale: 0.62 }] },
});
