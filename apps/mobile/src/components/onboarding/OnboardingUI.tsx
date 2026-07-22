import { Check, NavArrowLeft, Spark, Upload } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodImage } from '../FoodImage';
import { KikoMascot, type KikoMascotPose } from '../KikoMascot';
import { colors, fontFamilies, shadows } from '../../theme/okyoTheme';

export const onboardingColors = {
  background: colors.stoneCream,
  card: colors.card,
  primary: colors.sunsetPink,
  primaryDark: colors.coralDark,
  primarySoft: colors.coralSoft,
  green: colors.green,
  greenDeep: colors.green,
  greenSoft: colors.greenSoft,
  charcoal: colors.softCharcoal,
  gray: colors.body,
  muted: colors.muted,
  border: colors.border,
  cream: colors.stoneCream,
  yellow: colors.sunnyYellow,
  mint: colors.mintGreen,
  sky: colors.skyBlue,
  lavender: colors.lavender,
};

export type OnboardingOption = {
  detail: string;
  id: string;
  title: string;
};

// ─── Loading steps with personality ──────────────────────────────────────────

const LOADING_STEPS: { message: string; pose: KikoMascotPose }[] = [
  { message: 'Identifying your dish...', pose: 'scanning' },
  { message: 'Found it! Building your recipe...', pose: 'happy' },
  { message: 'Adding groceries to your list...', pose: 'groceryList' },
  { message: 'Calculating your savings...', pose: 'recipe' },
  { message: 'Almost ready for you...', pose: 'celebrating' },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

type OnboardingScreenShellProps = {
  canGoBack?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  progress: number;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function OnboardingScreenShell({
  canGoBack = true,
  children,
  footer,
  onBack,
  progress,
  scroll = true,
  style,
}: OnboardingScreenShellProps) {
  const content = (
    <View style={[styles.shellContent, style]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.shell}>
      <OnboardingProgressHeader canGoBack={canGoBack} onBack={onBack} progress={progress} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : content}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

// ─── Progress header ──────────────────────────────────────────────────────────

type OnboardingProgressHeaderProps = {
  canGoBack?: boolean;
  onBack?: () => void;
  progress: number;
};

export function OnboardingProgressHeader({ canGoBack = true, onBack, progress }: OnboardingProgressHeaderProps) {
  const clampedProgress = Math.max(0.04, Math.min(progress, 1));
  const fillAnim = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
      toValue: clampedProgress,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, fillAnim]);

  return (
    <View style={styles.progressHeader}>
      <Pressable
        accessibilityRole="button"
        disabled={!canGoBack}
        hitSlop={12}
        onPress={onBack}
        style={[styles.backButton, !canGoBack ? styles.backButtonHidden : null]}
      >
        <NavArrowLeft color={onboardingColors.gray} height={25} strokeWidth={2.35} width={25} />
      </Pressable>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: fillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ─── Typed text ───────────────────────────────────────────────────────────────

type OnboardingTypedTextProps = {
  style?: StyleProp<TextStyle>;
  text: string;
};

export function OnboardingTypedText({ style, text }: OnboardingTypedTextProps) {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    let index = 0;
    setVisibleText('');
    const interval = setInterval(() => {
      index += 2;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, 14);

    return () => clearInterval(interval);
  }, [text]);

  return <Text style={style}>{visibleText || ' '}</Text>;
}

// ─── Kiko speech bubble ───────────────────────────────────────────────────────

type KikoSpeechBubbleProps = {
  pose?: KikoMascotPose;
  text: string;
  typed?: boolean;
};

export function KikoSpeechBubble({ pose = 'wave', text, typed = true }: KikoSpeechBubbleProps) {
  return (
    <View style={styles.speechRow}>
      <View style={styles.kikoStage}>
        <KikoMascot pose={pose} size={92} />
      </View>
      <View style={styles.bubble}>
        <View style={styles.bubbleTail} />
        {typed ? (
          <OnboardingTypedText style={styles.bubbleText} text={text} />
        ) : (
          <Text style={styles.bubbleText}>{text}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Option list ──────────────────────────────────────────────────────────────

type OnboardingOptionListProps = {
  options: OnboardingOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function OnboardingOptionList({ onSelect, options, selectedId }: OnboardingOptionListProps) {
  return (
    <View style={styles.optionList}>
      {options.map((option, index) => (
        <OnboardingOptionCard
          key={option.id}
          delay={index * 85}
          option={option}
          selected={selectedId === option.id}
          onPress={() => onSelect(option.id)}
        />
      ))}
    </View>
  );
}

type OnboardingOptionCardProps = {
  delay?: number;
  option: OnboardingOption;
  selected: boolean;
  onPress: () => void;
};

export function OnboardingOptionCard({ delay = 0, onPress, option, selected }: OnboardingOptionCardProps) {
  const intro = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    intro.setValue(0);
    Animated.timing(intro, {
      delay,
      duration: 330,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [delay, intro, option.id]);

  const animatedStyle = {
    opacity: intro,
    transform: [
      {
        translateY: intro.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: Animated.multiply(
          scale,
          intro.interpolate({
            inputRange: [0, 1],
            outputRange: [0.98, 1],
          }),
        ),
      },
    ],
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={() => animateScale(scale, 0.975)}
        onPressOut={() => animateScale(scale, 1)}
        style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
      >
        <View style={styles.optionCopy}>
          <Text style={[styles.optionTitle, selected ? styles.optionTitleSelected : null]}>
            {option.title}
          </Text>
          <Text style={styles.optionDetail}>{option.detail}</Text>
        </View>
        <View style={[styles.optionCheck, selected ? styles.optionCheckSelected : null]}>
          {selected ? <Check color={onboardingColors.card} height={17} strokeWidth={2.8} width={17} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Stateful button ──────────────────────────────────────────────────────────

type OnboardingStatefulButtonProps = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  state?: 'idle' | 'loading' | 'success';
  stateLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function OnboardingStatefulButton({
  disabled = false,
  label,
  loading = false,
  onPress,
  state = 'idle',
  stateLabel,
  variant = 'primary',
}: OnboardingStatefulButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const resolvedState = loading ? 'loading' : state;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || resolvedState === 'loading'}
      onPress={onPress}
      onPressIn={() => animateScale(scale, 0.97)}
      onPressOut={() => animateScale(scale, 1)}
    >
      <Animated.View
        style={[
          styles.button,
          isPrimary ? styles.buttonPrimary : isGhost ? styles.buttonGhost : styles.buttonSecondary,
          disabled ? styles.buttonDisabled : null,
          { transform: [{ scale }] },
        ]}
      >
        {resolvedState === 'loading' ? (
          <ActivityIndicator color={isPrimary ? onboardingColors.card : onboardingColors.primary} />
        ) : resolvedState === 'success' ? (
          <View style={styles.buttonSuccessContent}>
            <Check color={isPrimary ? onboardingColors.card : onboardingColors.primary} height={18} strokeWidth={2.8} width={18} />
            <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
              {stateLabel ?? 'DONE'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
            {stateLabel ?? label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Scan card ────────────────────────────────────────────────────────────────

type OnboardingScanCardProps = {
  errorMessage?: string | null;
  onTakePhoto: () => void;
  onUpload: () => void;
};

export function OnboardingScanCard({ errorMessage, onTakePhoto, onUpload }: OnboardingScanCardProps) {
  return (
    <View style={styles.scanCard}>
      <View style={styles.scanFrame}>
        <View style={styles.scanPastelPanel}>
          <View style={styles.scanHintPill}>
            <Text style={styles.scanHintText}>Scan a meal</Text>
          </View>
        </View>
        <View style={styles.scanKikoWrapper}>
          <KikoMascot pose="scanning" size={110} style={styles.scanKiko} />
        </View>
        <View style={styles.scanTarget}>
          <Spark color={onboardingColors.primary} height={30} strokeWidth={2.1} width={30} />
        </View>
      </View>
      <View style={styles.scanButtons}>
        <OnboardingStatefulButton label="Take a Photo" onPress={onTakePhoto} />
        <ScanSecondaryAction
          icon={<Upload color={onboardingColors.primary} height={20} strokeWidth={2.3} width={20} />}
          label="Upload from Photos"
          onPress={onUpload}
        />
      </View>
      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Let's try that again.</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Hero screen ──────────────────────────────────────────────────────────────

type OnboardingHeroScreenProps = {
  onContinue: () => void;
  progress: number;
};

export function OnboardingHeroScreen({ onContinue, progress }: OnboardingHeroScreenProps) {
  const introAnim = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introAnim, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(imageScale, {
        damping: 22,
        mass: 0.8,
        stiffness: 190,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [imageScale, introAnim]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.shell}>
      <OnboardingProgressHeader canGoBack={false} onBack={noop} progress={progress} />
      <ScrollView contentContainerStyle={heroStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[heroStyles.imageCard, { transform: [{ scale: imageScale }] }]}>
          <View style={heroStyles.heroPastelTop} />
          <View style={heroStyles.heroMascotStage}>
            <KikoMascot pose="happy" size={156} />
          </View>
          <View style={heroStyles.heroBrandStrip}>
            <View style={[heroStyles.heroBrandChip, heroStyles.heroBrandChipPink]}>
              <Text style={heroStyles.heroBrandChipText}>recipe</Text>
            </View>
            <View style={[heroStyles.heroBrandChip, heroStyles.heroBrandChipMint]}>
              <Text style={heroStyles.heroBrandChipText}>groceries</Text>
            </View>
            <View style={[heroStyles.heroBrandChip, heroStyles.heroBrandChipSky]}>
              <Text style={heroStyles.heroBrandChipText}>savings</Text>
            </View>
          </View>
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            heroStyles.content,
            {
              opacity: introAnim,
              transform: [
                {
                  translateY: introAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [28, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={heroStyles.headline}>Turn any meal into{'\n'}a recipe. Instantly.</Text>
          <Text style={heroStyles.sub}>
            Snap any restaurant dish — Okyo builds you the recipe, grocery list, and step-by-step cooking guide.
          </Text>

          {/* Proof row */}
          <View style={heroStyles.proofRow}>
            <ProofPill emoji="📸" label="Snap it" />
            <ProofArrow />
            <ProofPill emoji="📋" label="Get recipe" />
            <ProofArrow />
            <ProofPill emoji="💰" label="Save money" />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingStatefulButton label="Let's go  →" onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

function ProofPill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={heroStyles.proofPill}>
      <Text style={heroStyles.proofEmoji}>{emoji}</Text>
      <Text style={heroStyles.proofLabel}>{label}</Text>
    </View>
  );
}

function ProofArrow() {
  return <Text style={heroStyles.proofArrow}>›</Text>;
}

// ─── Loading screen ───────────────────────────────────────────────────────────

type OnboardingLoadingScreenProps = {
  progress: number;
  userImageUri?: string | null;
};

export function OnboardingLoadingScreen({ progress, userImageUri }: OnboardingLoadingScreenProps) {
  if (userImageUri) {
    return <OnboardingScanLoadingScreen progress={progress} userImageUri={userImageUri} />;
  }
  return <OnboardingBuildingPlanScreen progress={progress} />;
}

function OnboardingBuildingPlanScreen({ progress }: { progress: number }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makePulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(760),
        ]),
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 253);
    const a3 = makePulse(dot3, 506);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <OnboardingScreenShell canGoBack={false} progress={progress} scroll={false}>
      <View style={styles.loadingPlanContent}>
        <KikoMascot pose="recipeCard" size={200} />
        <Text style={styles.loadingPlanLabel}>BUILDING YOUR PLAN...</Text>
        <Text style={styles.loadingPlanBody}>
          Get ready to find smarter homemade swaps, easy recipes, and better meal savings with Okyo!
        </Text>
        <View style={styles.loadingDotRow}>
          <Animated.View style={[styles.loadingDot, { opacity: dot1 }]} />
          <Animated.View style={[styles.loadingDot, { opacity: dot2 }]} />
          <Animated.View style={[styles.loadingDot, { opacity: dot3 }]} />
        </View>
      </View>
    </OnboardingScreenShell>
  );
}

function OnboardingScanLoadingScreen({ progress, userImageUri }: { progress: number; userImageUri: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const stepAnim = useRef(new Animated.Value(1)).current;
  const barProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barProgress, {
      duration: 4500,
      easing: Easing.out(Easing.exp),
      toValue: 1,
      useNativeDriver: false,
    }).start();

    const cycleStep = () => {
      Animated.timing(stepAnim, { duration: 200, easing: Easing.in(Easing.quad), toValue: 0, useNativeDriver: true }).start(() => {
        setStepIndex((i) => (i + 1) % LOADING_STEPS.length);
        Animated.timing(stepAnim, { duration: 280, easing: Easing.out(Easing.quad), toValue: 1, useNativeDriver: true }).start();
      });
    };

    const interval = setInterval(cycleStep, 1300);
    return () => clearInterval(interval);
  }, [barProgress, stepAnim]);

  const currentStep = LOADING_STEPS[stepIndex];

  return (
    <OnboardingScreenShell canGoBack={false} progress={progress} scroll={false}>
      <View style={styles.loadingContent}>
        <View style={styles.loadingUserImageStage}>
          <Image source={{ uri: userImageUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={styles.loadingUserImageOverlay} />
          <Animated.View style={[styles.loadingKikoCorner, { opacity: stepAnim }]}>
            <KikoMascot pose={currentStep.pose} size={68} />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.loadingHeadline, { opacity: stepAnim }]}>
          {currentStep.message}
        </Animated.Text>
        <Text style={styles.loadingBody}>
          Building your homemade version with savings, groceries, and guided cooking steps.
        </Text>
        <View style={styles.loadingBar}>
          <Animated.View
            style={[
              styles.loadingBarFill,
              {
                width: barProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['4%', '92%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    </OnboardingScreenShell>
  );
}

// ─── First result screen ──────────────────────────────────────────────────────

type OnboardingFirstResultScreenProps = {
  confidence?: number;
  difficulty?: string;
  imageStatus?: string | null;
  imageUri?: string | null;
  imageUrl?: string | null;
  onContinue: () => void;
  recipeDescription?: string;
  recipeTitle: string;
  savingsText: string;
  timeText: string;
};

export function OnboardingFirstResultScreen({
  confidence,
  difficulty,
  imageStatus,
  imageUri,
  imageUrl,
  onContinue,
  recipeDescription,
  recipeTitle,
  savingsText,
  timeText,
}: OnboardingFirstResultScreenProps) {
  const introAnim = useRef(new Animated.Value(0)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(introAnim, {
        damping: 22,
        mass: 0.85,
        stiffness: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(celebrateAnim, {
        damping: 14,
        mass: 0.6,
        stiffness: 260,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebrateAnim, introAnim]);

  return (
    <OnboardingScreenShell
      canGoBack={false}
      footer={<OnboardingStatefulButton label="See My Recipe  →" onPress={onContinue} />}
      progress={0.87}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: introAnim,
          transform: [
            {
              translateY: introAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [32, 0],
              }),
            },
          ],
        }}
      >
        <View style={styles.resultIntro}>
          <Animated.View
            style={[
              styles.resultFoundBadge,
              {
                transform: [
                  {
                    scale: celebrateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.resultFoundDot} />
            <Text style={styles.resultFoundText}>Recipe found</Text>
          </Animated.View>
          <Text numberOfLines={3} style={styles.resultTitle}>{recipeTitle}</Text>
        </View>

        {/* Food image with savings badge */}
        <View style={styles.resultImageCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.resultImage} />
          ) : (
            <FoodImage
              fallbackLabel="Recipe image"
              imageStatus={imageStatus}
              imageUrl={imageUrl}
              style={styles.resultImage}
            />
          )}
          {/* Savings badge overlay */}
          <Animated.View
            style={[
              styles.savingsBadge,
              {
                transform: [
                  {
                    scale: celebrateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.savingsBadgeAmount}>{savingsText}</Text>
            <Text style={styles.savingsBadgeLabel}>home cost</Text>
          </Animated.View>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultPromise}>
            A restaurant-style version you can make at home.
          </Text>
          <Text style={styles.resultDescription} numberOfLines={3}>
            {recipeDescription ?? 'Okyo built a simple first recipe with groceries and guided steps.'}
          </Text>
          <View style={styles.metricGrid}>
            <MetricPill label="Time" value={timeText} />
            <MetricPill label="Difficulty" value={difficulty ?? 'Easy'} />
            <MetricPill label="Confidence" value={formatConfidence(confidence)} />
          </View>
        </View>
      </Animated.View>
    </OnboardingScreenShell>
  );
}

// ─── Paywall screen ───────────────────────────────────────────────────────────

type OnboardingPaywallScreenProps = {
  onContinue: () => void;
  onRestore: () => void;
};

export function OnboardingPaywallScreen({ onContinue, onRestore }: OnboardingPaywallScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'weekly'>('annual');
  const introAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(introAnim, {
      damping: 22,
      mass: 0.9,
      stiffness: 160,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [introAnim]);

  return (
    <OnboardingScreenShell
      canGoBack={false}
      footer={
        <View style={styles.paywallFooter}>
          <OnboardingStatefulButton label="Start 7-Day Free Trial  →" onPress={onContinue} />
          <Text style={styles.paywallTrialNote}>
            {selectedPlan === 'annual'
              ? 'Then $49.99/year ($4.17/mo) • Cancel anytime'
              : 'Then $4.99/week • Cancel anytime'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onRestore} style={styles.restoreButton}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
        </View>
      }
      progress={1}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: introAnim,
          transform: [
            {
              translateY: introAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        }}
      >
        {/* Hero */}
        <View style={styles.paywallHero}>
          <KikoMascot pose="celebrating" size={110} />
          <Text style={styles.paywallEyebrow}>✓ Step 1 complete</Text>
          <Text style={styles.paywallTitle}>You just got your first recipe free.</Text>
          <Text style={styles.paywallBody}>
            Keep scanning to recreate every meal you love — with grocery lists and savings tracking.
          </Text>
        </View>

        {/* Social proof */}
        <View style={styles.socialProof}>
          <Text style={styles.socialProofText}>♥  Loved by 12,000+ home cooks</Text>
        </View>

        {/* Price plans */}
        <View style={styles.priceRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedPlan === 'annual' }}
            onPress={() => setSelectedPlan('annual')}
            style={[styles.priceCard, selectedPlan === 'annual' ? styles.priceCardFeatured : null]}
          >
            <View style={styles.priceBestBadge}>
              <Text style={styles.priceBestText}>BEST VALUE</Text>
            </View>
            <Text style={styles.priceAmount}>$4.17</Text>
            <Text style={styles.pricePeriod}>/ month</Text>
            <Text style={styles.priceFineprint}>Billed as $49.99/year</Text>
            <View style={[styles.planCheck, selectedPlan === 'annual' ? styles.planCheckSelected : null]}>
              {selectedPlan === 'annual' ? (
                <Check color={onboardingColors.card} height={13} strokeWidth={3} width={13} />
              ) : null}
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedPlan === 'weekly' }}
            onPress={() => setSelectedPlan('weekly')}
            style={[styles.priceCard, selectedPlan === 'weekly' ? styles.priceCardWeeklySelected : null]}
          >
            <View style={styles.priceBestBadge}>
              <Text style={[styles.priceBestText, { color: onboardingColors.gray }]}>FLEXIBLE</Text>
            </View>
            <Text style={styles.priceAmount}>$4.99</Text>
            <Text style={styles.pricePeriod}>/ week</Text>
            <Text style={styles.priceFineprint}>No commitment</Text>
            <View style={[styles.planCheck, selectedPlan === 'weekly' ? styles.planCheckSelected : null]}>
              {selectedPlan === 'weekly' ? (
                <Check color={onboardingColors.card} height={13} strokeWidth={3} width={13} />
              ) : null}
            </View>
          </Pressable>
        </View>

        {/* Savings callout */}
        {selectedPlan === 'annual' ? (
          <View style={styles.savingsCallout}>
            <Text style={styles.savingsCalloutText}>💰  Annual plan saves 81% vs weekly</Text>
          </View>
        ) : null}

        {/* Perks */}
        <View style={styles.paywallPerks}>
          {PAYWALL_PERKS.map((perk) => (
            <View key={perk.label} style={styles.paywallPerk}>
              <View style={styles.paywallCheck}>
                <Check color={onboardingColors.card} height={13} strokeWidth={3} width={13} />
              </View>
              <View style={styles.paywallPerkCopy}>
                <Text style={styles.paywallPerkLabel}>{perk.label}</Text>
                <Text style={styles.paywallPerkDetail}>{perk.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.legalLinks}>
          <Text style={styles.legalText}>Terms</Text>
          <Text style={styles.legalDot}>•</Text>
          <Text style={styles.legalText}>Privacy</Text>
        </View>
      </Animated.View>
    </OnboardingScreenShell>
  );
}

const PAYWALL_PERKS: { detail: string; label: string }[] = [
  { label: 'Unlimited recipe scans', detail: 'Never wonder what to cook again' },
  { label: 'Step-by-step cooking guide', detail: 'Confidence in every step' },
  { label: 'Auto grocery lists', detail: 'Everything in one tap' },
  { label: 'Savings tracker', detail: 'Watch your money stay in your pocket' },
];

// ─── Metric pill ──────────────────────────────────────────────────────────────

type MetricPillProps = {
  label: string;
  value: string;
};

function MetricPill({ label, value }: MetricPillProps) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Scan secondary action ────────────────────────────────────────────────────

type ScanSecondaryActionProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
};

function ScanSecondaryAction({ icon, label, onPress }: ScanSecondaryActionProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.scanSecondaryAction}>
      {icon}
      <Text style={styles.scanSecondaryText}>{label}</Text>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function animateScale(value: Animated.Value, toValue: number) {
  Animated.spring(value, {
    damping: 18,
    mass: 0.6,
    stiffness: 280,
    toValue,
    useNativeDriver: true,
  }).start();
}

function formatConfidence(confidence: number | undefined) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return 'Good';
  }

  return `${Math.round(confidence * 100)}%`;
}

function noop() {}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Shell
  shell: {
    backgroundColor: onboardingColors.background,
    flex: 1,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  backButtonHidden: {
    opacity: 0,
  },
  progressTrack: {
    backgroundColor: 'rgba(199,179,255,0.24)',
    borderRadius: 999,
    flex: 1,
    height: 9,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: onboardingColors.primary,
    borderRadius: 999,
    height: '100%',
  },
  headerSpacer: {
    width: 42,
  },
  scrollContent: {
    flexGrow: 1,
  },
  shellContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  footer: {
    backgroundColor: onboardingColors.background,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // Speech bubble
  speechRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  kikoStage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 108,
    width: 96,
  },
  bubble: {
    backgroundColor: onboardingColors.card,
    borderColor: 'rgba(199,179,255,0.34)',
    borderRadius: 30,
    borderTopLeftRadius: 20,
    borderWidth: 1,
    flex: 1,
    minHeight: 104,
    paddingHorizontal: 22,
    paddingVertical: 20,
    ...shadows.card,
  },
  bubbleTail: {
    backgroundColor: onboardingColors.card,
    borderBottomColor: 'rgba(199,179,255,0.34)',
    borderLeftColor: 'rgba(199,179,255,0.34)',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderWidth: 1,
    height: 18,
    left: -8,
    position: 'absolute',
    top: 31,
    transform: [{ rotate: '45deg' }],
    width: 18,
  },
  bubbleText: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.54,
    lineHeight: 32,
  },

  // Option list
  optionList: {
    gap: 13,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 25,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 16,
    minHeight: 84,
    paddingHorizontal: 20,
    paddingVertical: 16,
    ...shadows.card,
  },
  optionCardSelected: {
    backgroundColor: onboardingColors.primarySoft,
    borderColor: onboardingColors.primary,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  optionTitleSelected: {
    color: onboardingColors.primaryDark,
  },
  optionDetail: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  optionCheck: {
    alignItems: 'center',
    borderColor: 'rgba(199,179,255,0.48)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  optionCheckSelected: {
    backgroundColor: onboardingColors.primary,
    borderColor: onboardingColors.primary,
  },

  // Button
  button: {
    alignItems: 'center',
    borderRadius: 25,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  buttonPrimary: {
    backgroundColor: onboardingColors.primary,
    shadowColor: onboardingColors.primaryDark,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderWidth: 1,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.44,
  },
  buttonText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  buttonTextPrimary: {
    color: onboardingColors.card,
  },
  buttonTextSecondary: {
    color: onboardingColors.primary,
  },
  buttonSuccessContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  // Scan card
  scanCard: {
    gap: 18,
  },
  scanFrame: {
    backgroundColor: onboardingColors.primarySoft,
    borderColor: onboardingColors.border,
    borderRadius: 34,
    borderWidth: 1,
    height: 300,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.hero,
  },
  scanPastelPanel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(255,139,174,0.12)',
    justifyContent: 'flex-start',
    paddingTop: 22,
  },
  scanHintPill: {
    backgroundColor: onboardingColors.card,
    borderColor: 'rgba(199,179,255,0.34)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scanHintText: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.13,
    textTransform: 'uppercase',
  },
  scanKikoWrapper: {
    alignItems: 'center',
    bottom: 56,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  scanKiko: {
    marginTop: 0,
  },
  scanTarget: {
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 22,
    borderWidth: 1,
    bottom: 20,
    height: 64,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    width: 64,
  },
  scanButtons: {
    gap: 12,
  },
  scanSecondaryAction: {
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: 8,
  },
  scanSecondaryText: {
    color: onboardingColors.primary,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  errorCard: {
    backgroundColor: 'rgba(255,139,174,0.16)',
    borderRadius: 22,
    padding: 16,
  },
  errorTitle: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  errorText: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },

  // Loading screen — "Building Your Plan" (no user image)
  loadingPlanContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingPlanLabel: {
    color: onboardingColors.primaryDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginTop: 28,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  loadingPlanBody: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 27,
    marginTop: 14,
    maxWidth: 300,
    textAlign: 'center',
  },
  loadingDotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  loadingDot: {
    backgroundColor: onboardingColors.primary,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  // Loading screen — scan in progress (has user image)
  loadingContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingUserImageStage: {
    borderRadius: 44,
    height: 230,
    overflow: 'hidden',
    width: 230,
    ...shadows.hero,
  },
  loadingUserImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  loadingKikoCorner: {
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 40,
    borderWidth: 1,
    bottom: -8,
    padding: 6,
    position: 'absolute',
    right: -8,
    ...shadows.card,
  },
  loadingHeadline: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: 32,
    textAlign: 'center',
  },
  loadingBody: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 12,
    maxWidth: 300,
    textAlign: 'center',
  },
  loadingBar: {
    backgroundColor: 'rgba(129,199,255,0.24)',
    borderRadius: 999,
    height: 10,
    marginTop: 32,
    overflow: 'hidden',
    width: '82%',
  },
  loadingBarFill: {
    backgroundColor: onboardingColors.primary,
    borderRadius: 999,
    height: '100%',
  },

  // First result
  resultIntro: {
    marginBottom: 16,
  },
  resultFoundBadge: {
    alignItems: 'center',
    backgroundColor: onboardingColors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  resultFoundDot: {
    backgroundColor: onboardingColors.green,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  resultFoundText: {
    color: onboardingColors.greenDeep,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultTitle: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  resultImageCard: {
    backgroundColor: onboardingColors.card,
    borderRadius: 34,
    height: 256,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.hero,
  },
  resultImage: {
    height: '100%',
    width: '100%',
  },
  savingsBadge: {
    alignItems: 'center',
    backgroundColor: onboardingColors.primary,
    borderRadius: 20,
    bottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
    right: 14,
    ...shadows.card,
  },
  savingsBadgeAmount: {
    color: onboardingColors.card,
    fontFamily: fontFamilies.display,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  savingsBadgeLabel: {
    color: 'rgba(255,255,255,0.84)',
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultCard: {
    backgroundColor: onboardingColors.card,
    borderColor: 'rgba(199,179,255,0.34)',
    borderRadius: 30,
    borderWidth: 1,
    padding: 20,
    ...shadows.card,
  },
  resultPromise: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  resultDescription: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  metricPill: {
    backgroundColor: 'rgba(143,227,198,0.22)',
    borderRadius: 18,
    flex: 1,
    minWidth: '30%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metricValue: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Paywall
  paywallHero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  paywallEyebrow: {
    color: onboardingColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  paywallTitle: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 39,
    marginTop: 8,
    textAlign: 'center',
  },
  paywallBody: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 10,
    textAlign: 'center',
  },
  socialProof: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,139,174,0.14)',
    borderRadius: 999,
    marginBottom: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  socialProofText: {
    color: onboardingColors.primary,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  priceCard: {
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 26,
    borderWidth: 1.5,
    flex: 1,
    padding: 16,
    position: 'relative',
    ...shadows.card,
  },
  priceCardFeatured: {
    backgroundColor: onboardingColors.primarySoft,
    borderColor: onboardingColors.primary,
    borderWidth: 2,
  },
  priceCardWeeklySelected: {
    borderColor: onboardingColors.primary,
    borderWidth: 2,
  },
  priceBestBadge: {
    marginBottom: 6,
  },
  priceBestText: {
    color: onboardingColors.primary,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  priceAmount: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  pricePeriod: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  priceFineprint: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  planCheck: {
    alignItems: 'center',
    borderColor: 'rgba(199,179,255,0.48)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 10,
    width: 22,
  },
  planCheckSelected: {
    backgroundColor: onboardingColors.primary,
    borderColor: onboardingColors.primary,
  },
  savingsCallout: {
    alignItems: 'center',
    backgroundColor: onboardingColors.greenSoft,
    borderRadius: 999,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  savingsCalloutText: {
    color: onboardingColors.greenDeep,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  paywallPerks: {
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    marginBottom: 18,
    padding: 20,
  },
  paywallPerk: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
  },
  paywallCheck: {
    alignItems: 'center',
    backgroundColor: onboardingColors.green,
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    marginTop: 1,
    width: 24,
  },
  paywallPerkCopy: {
    flex: 1,
  },
  paywallPerkLabel: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  paywallPerkDetail: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 1,
  },
  legalLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 2,
  },
  legalText: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  legalDot: {
    color: onboardingColors.gray,
  },
  paywallFooter: {
    gap: 6,
  },
  paywallTrialNote: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  restoreText: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
});

// ─── Hero screen styles ───────────────────────────────────────────────────────

const heroStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  imageCard: {
    backgroundColor: onboardingColors.primarySoft,
    borderColor: 'rgba(199,179,255,0.34)',
    borderWidth: 1,
    height: 280,
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 34,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.hero,
  },
  heroPastelTop: {
    backgroundColor: 'rgba(129,199,255,0.32)',
    height: 92,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroMascotStage: {
    alignItems: 'center',
    bottom: 72,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 34,
  },
  heroBrandStrip: {
    bottom: 18,
    flexDirection: 'row',
    gap: 8,
    left: 16,
    position: 'absolute',
    right: 16,
  },
  heroBrandChip: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  heroBrandChipPink: {
    backgroundColor: onboardingColors.primary,
  },
  heroBrandChipMint: {
    backgroundColor: onboardingColors.mint,
  },
  heroBrandChipSky: {
    backgroundColor: onboardingColors.sky,
  },
  heroBrandChipText: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.12,
    textTransform: 'uppercase',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  headline: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 46,
  },
  sub: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: 12,
  },
  proofRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  proofPill: {
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadows.card,
  },
  proofEmoji: {
    fontSize: 16,
  },
  proofLabel: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  proofArrow: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700',
  },
});
