import { CheckCircle, Spark } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { getSafeNumber, getSafeText, isRecipeMode } from '../mocks';
import type { Recipe, RecipeMode, RestaurantPack } from '../mocks';
import { colors, fontFamilies, layout, radius, shadows, spacing, surfaces, typography } from '../theme/okyoTheme';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
};

export function ScreenContainer({ children, scroll = true, centered = false }: ScreenContainerProps) {
  const contentStyle = [styles.screenContent, centered ? styles.centeredContent : null];

  if (!scroll) {
    return <View style={contentStyle}>{children}</View>;
  }

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  fullWidth?: boolean;
};

export function PrimaryButton({ children, onPress, fullWidth = true }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryButton,
        fullWidth ? styles.fullWidth : null,
        pressed ? styles.pressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ children, onPress, fullWidth = true }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondaryButton,
        fullWidth ? styles.fullWidth : null,
        pressed ? styles.pressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{children}</Text>
    </Pressable>
  );
}

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  disabled?: boolean;
  pulse?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  children,
  disabled = false,
  pulse = false,
  scaleTo = 0.975,
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    pulseValue.stopAnimation();
    pulseValue.setValue(0);

    if (!pulse || reduceMotion || disabled) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [disabled, pulse, pulseValue, reduceMotion]);

  const pressTo = (value: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }

    Animated.spring(scale, {
      damping: 18,
      mass: 0.55,
      stiffness: 300,
      toValue: value,
      useNativeDriver: true,
    }).start();
  };

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.012],
  });

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        pressTo(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressTo(1);
        onPressOut?.(event);
      }}
      {...props}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [
              { scale },
              ...(pulse && !reduceMotion && !disabled ? [{ scale: pulseScale }] : []),
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

type ProgressFillProps = {
  progress: number;
  height?: number;
  tone?: 'coral' | 'green';
  style?: StyleProp<ViewStyle>;
};

export function ProgressFill({ height = 8, progress, style, tone = 'coral' }: ProgressFillProps) {
  const reduceMotion = useReducedMotion();
  const animatedProgress = useRef(new Animated.Value(clampProgress(progress))).current;
  const fillColor = tone === 'green' ? colors.green : colors.coral;

  useEffect(() => {
    const nextProgress = clampProgress(progress);
    if (reduceMotion) {
      animatedProgress.setValue(nextProgress);
      return;
    }

    Animated.timing(animatedProgress, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      toValue: nextProgress,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progress, reduceMotion]);

  return (
    <View style={[styles.progressTrackShared, { height }, style]}>
      <Animated.View
        style={[
          styles.progressFillShared,
          {
            backgroundColor: fillColor,
            width: animatedProgress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

type RewardToastProps = {
  label: string;
  visible: boolean;
  tone?: 'xp' | 'save' | 'badge';
};

export function RewardToast({ label, tone = 'save', visible }: RewardToastProps) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const isXp = tone === 'xp';

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }

    Animated.timing(progress, {
      duration: visible ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.rewardToast,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      {isXp ? (
        <Spark color={colors.coral} height={19} strokeWidth={2.4} width={19} />
      ) : (
        <CheckCircle color={colors.green} height={19} strokeWidth={2.4} width={19} />
      )}
      <Text style={styles.rewardToastText}>{label}</Text>
    </Animated.View>
  );
}

type BadgePillProps = {
  children: ReactNode;
  tone?: 'dark' | 'green' | 'coral' | 'cream';
};

export function BadgePill({ children, tone = 'cream' }: BadgePillProps) {
  return (
    <View style={[styles.badgePill, styles[`badgePill_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{children}</Text>
    </View>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'default' | 'savings' | 'coral';
};

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <View style={[styles.statCard, tone === 'savings' ? styles.statCardSavings : null]}>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, tone === 'savings' ? styles.statValueSavings : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ eyebrow, title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <ScreenContainer scroll={false} centered>
      <View style={styles.emptyCard}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.bodyText}>{body}</Text>
        {actionLabel && onAction ? (
          <View style={styles.emptyAction}>
            <PrimaryButton onPress={onAction}>{actionLabel}</PrimaryButton>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  body?: string;
};

export function SectionHeader({ title, eyebrow, body }: SectionHeaderProps) {
  return (
    <View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.screenTitle}>{title}</Text>
      {body ? <Text style={styles.bodyText}>{body}</Text> : null}
    </View>
  );
}

type ModeTabsProps = {
  modes: RecipeMode[];
  selectedMode: RecipeMode;
  onSelectMode: (mode: RecipeMode) => void;
};

export function ModeTabs({ modes, selectedMode, onSelectMode }: ModeTabsProps) {
  const safeModes: RecipeMode[] = modes.length > 0 ? modes : ['Restaurant Copy'];

  return (
    <View style={styles.modeTabs}>
      {safeModes.map((mode) => {
        const selected = selectedMode === mode;

        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.modeTab,
              selected ? styles.modeTabSelected : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={() => onSelectMode(mode)}
          >
            <Text style={[styles.modeText, selected ? styles.modeTextSelected : null]}>{mode}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type RecipeCardProps = {
  recipe: Recipe;
  onPress?: () => void;
  onRemove?: () => void;
};

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export function RecipeCard({ recipe, onPress, onRemove }: RecipeCardProps) {
  const title = getSafeText(recipe?.title, 'Saved Okyo dupe');
  const mode = isRecipeMode(recipe?.mode) ? recipe.mode : 'Restaurant Copy';
  const estimatedHomemadeCost = getSafeNumber(recipe?.estimatedHomemadeCost);
  const difficulty = getSafeText(recipe?.difficulty, 'Easy');

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.cardPressable, pressed ? styles.cardPressedInner : null]}
        onPress={onPress}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          <BadgePill tone="dark">{mode}</BadgePill>
        </View>
        <View style={styles.cardMetaRow}>
          <View>
            <Text style={styles.statLabel}>Homemade estimate</Text>
            <Text style={styles.savingsText}>{formatCurrency(estimatedHomemadeCost)}</Text>
          </View>
          <View style={styles.cardMetaRight}>
            <Text style={styles.statLabel}>Difficulty</Text>
            <Text style={styles.cardMetaValue}>{difficulty}</Text>
          </View>
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable style={styles.removeAction} onPress={onRemove}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type PackCardProps = {
  pack: RestaurantPack;
  label: string;
  description: string;
  averageSavings: number;
  topDish?: string;
  onPress?: () => void;
};

export function PackCard({ pack, label, description, averageSavings, topDish, onPress }: PackCardProps) {
  const dishes = Array.isArray(pack?.dishes) ? pack.dishes : [];
  const name = getSafeText(pack?.name, 'Restaurant-inspired pack');

  return (
    <Pressable style={({ pressed }) => [styles.card, styles.cardPressable, pressed ? styles.pressed : null]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>
        <BadgePill tone={label === 'Free' ? 'green' : 'coral'}>{label}</BadgePill>
      </View>
      <Text style={styles.cardBody} numberOfLines={3}>{description}</Text>
      <View style={styles.cardMetaRow}>
        <View>
          <Text style={styles.statLabel}>Dupes</Text>
          <Text style={styles.cardMetaValue}>{dishes.length}</Text>
        </View>
        <View style={styles.cardMetaRight}>
          <Text style={styles.statLabel}>Avg. savings</Text>
          <Text style={styles.savingsText}>{formatCurrency(averageSavings)}</Text>
        </View>
      </View>
      <Text style={styles.topDish}>Top dish: {topDish ?? 'Coming soon'}</Text>
    </Pressable>
  );
}

export const sharedStyles = StyleSheet.create({
  card: {
    ...surfaces.card,
    padding: spacing.card,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);

    return () => subscription?.remove?.();
  }, []);

  return reduceMotion;
}

const styles = StyleSheet.create({
  screenContent: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: spacing.screen,
    // Generous enough to clear the floating tab bar where present, without the
    // large empty gap the old 220 left on pushed screens.
    paddingBottom: layout.scrollClearance,
  },
  centeredContent: {
    justifyContent: 'center',
  },
  progressTrackShared: {
    backgroundColor: colors.creamDeep,
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  progressFillShared: {
    borderRadius: 999,
    height: '100%',
    minWidth: 4,
  },
  rewardToast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    bottom: 28,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: '#4a3a28',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    zIndex: 20,
    elevation: 5,
  },
  rewardToastText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
  },
  eyebrow: {
    ...typography.label,
    marginBottom: 10,
  },
  screenTitle: {
    ...typography.hero,
  },
  emptyCard: {
    ...surfaces.card,
    alignItems: 'center',
    padding: spacing.xl,
    width: '100%',
  },
  emptyTitle: {
    ...typography.title,
    textAlign: 'center',
  },
  bodyText: {
    ...typography.body,
    marginTop: 10,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 24,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.button,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 26,
    ...shadows.cta,
  },
  primaryButtonText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: radius.button,
    borderWidth: 1.5,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 26,
    ...shadows.soft,
  },
  secondaryButtonText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  cardPressedInner: {
    backgroundColor: colors.cardWarm,
  },
  badgePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgePill_dark: {
    backgroundColor: colors.charcoal,
  },
  badgePill_green: {
    backgroundColor: colors.greenSoft,
  },
  badgePill_coral: {
    backgroundColor: colors.cream,
  },
  badgePill_cream: {
    backgroundColor: colors.cream,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeText_dark: {
    color: colors.onCoral,
  },
  badgeText_green: {
    color: colors.green,
  },
  badgeText_coral: {
    color: colors.coralDark,
  },
  badgeText_cream: {
    color: colors.charcoal,
  },
  statCard: {
    ...surfaces.tint,
    minHeight: 82,
    padding: 16,
    width: '48%',
  },
  statCardSavings: {
    backgroundColor: colors.greenSoft,
  },
  statLabel: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 16,
  },
  statValue: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 7,
  },
  statValueSavings: {
    color: colors.green,
  },
  modeTabs: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
    padding: 5,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeTabSelected: {
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  modeText: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeTextSelected: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
  },
  card: {
    ...sharedStyles.card,
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  cardPressable: {
    padding: spacing.card,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 26,
  },
  cardBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cardMetaRight: {
    alignItems: 'flex-end',
  },
  cardMetaValue: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  savingsText: {
    color: colors.green,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  topDish: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
  },
  removeAction: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  removeText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
