import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSafeNumber, getSafeText, isRecipeMode } from '../mocks';
import type { Recipe, RecipeMode, RestaurantPack } from '../mocks';
import { colors, fontFamilies, radius, shadows, spacing, typography } from '../theme/okyoTheme';

export { colors, fontFamilies, spacing, typography };

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
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === 'savings' ? styles.statValueSavings : null]}>{value}</Text>
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
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <PrimaryButton onPress={onAction}>{actionLabel}</PrimaryButton>
        </View>
      ) : null}
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
      <Pressable style={styles.cardPressable} onPress={onPress}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
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
        <Text style={styles.cardTitle}>{name}</Text>
        <BadgePill tone={label === 'Free' ? 'green' : 'coral'}>{label}</BadgePill>
      </View>
      <Text style={styles.cardBody}>{description}</Text>
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
    borderRadius: radius.card,
    padding: spacing.card,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

const styles = StyleSheet.create({
  screenContent: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: spacing.screen,
    // Generous enough to clear the floating tab bar where present, without the
    // large empty gap the old 220 left on pushed screens.
    paddingBottom: 132,
  },
  centeredContent: {
    justifyContent: 'center',
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  screenTitle: {
    color: colors.charcoal,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 40,
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 36,
    textAlign: 'center',
  },
  bodyText: {
    ...typography.body,
    marginTop: 10,
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
    shadowColor: colors.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.button,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 26,
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
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
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
    color: colors.card,
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
    borderRadius: radius.panel,
    minHeight: 82,
    padding: 16,
    width: '48%',
  },
  statCardSavings: {
    backgroundColor: colors.greenSoft,
    borderColor: '#c9e7d2',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    textTransform: 'uppercase',
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
    backgroundColor: colors.charcoal,
  },
  modeText: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeTextSelected: {
    color: '#fffdf8',
  },
  card: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  cardPressable: {
    padding: spacing.card,
  },
  cardHeader: {
    alignItems: 'flex-start',
    gap: 10,
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
