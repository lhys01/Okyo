import { Check } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, shadows } from '../theme/okyoTheme';

export type PricingPlan = 'annual' | 'weekly';

export const ANNUAL_PRICE = 49.99;
export const WEEKLY_PRICE = 4.99;
export const ANNUAL_MONTHLY_EQUIVALENT = ANNUAL_PRICE / 12;
// Derived, not hand-typed, so the "saves X%" claim can never drift from the two
// prices actually shown on the cards below.
export const ANNUAL_SAVINGS_PERCENT = Math.round((1 - (ANNUAL_PRICE / 52) / WEEKLY_PRICE) * 100);

export function getPricingTrialNote(plan: PricingPlan): string {
  return plan === 'annual'
    ? `Then $${ANNUAL_PRICE.toFixed(2)}/year ($${ANNUAL_MONTHLY_EQUIVALENT.toFixed(2)}/mo) • Cancel anytime`
    : `Then $${WEEKLY_PRICE.toFixed(2)}/week • Cancel anytime`;
}

type PricingCardsProps = {
  onSelectPlan: (plan: PricingPlan) => void;
  selectedPlan: PricingPlan;
  showSavingsCallout?: boolean;
};

export function PricingCards({ onSelectPlan, selectedPlan, showSavingsCallout = true }: PricingCardsProps) {
  return (
    <View>
      <View style={styles.priceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPlan === 'annual' }}
          onPress={() => onSelectPlan('annual')}
          style={[styles.priceCard, selectedPlan === 'annual' ? styles.priceCardFeatured : null]}
        >
          <View style={styles.priceBestBadge}>
            <Text style={styles.priceBestText}>BEST VALUE</Text>
          </View>
          <Text style={styles.priceAmount}>${ANNUAL_MONTHLY_EQUIVALENT.toFixed(2)}</Text>
          <Text style={styles.pricePeriod}>/ month</Text>
          <Text style={styles.priceFineprint}>Billed as ${ANNUAL_PRICE.toFixed(2)}/year</Text>
          <View style={[styles.planCheck, selectedPlan === 'annual' ? styles.planCheckSelected : null]}>
            {selectedPlan === 'annual' ? (
              <Check color={colors.onCoral} height={13} strokeWidth={3} width={13} />
            ) : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPlan === 'weekly' }}
          onPress={() => onSelectPlan('weekly')}
          style={[styles.priceCard, selectedPlan === 'weekly' ? styles.priceCardWeeklySelected : null]}
        >
          <View style={styles.priceBestBadge}>
            <Text style={[styles.priceBestText, styles.priceBestTextMuted]}>FLEXIBLE</Text>
          </View>
          <Text style={styles.priceAmount}>${WEEKLY_PRICE.toFixed(2)}</Text>
          <Text style={styles.pricePeriod}>/ week</Text>
          <Text style={styles.priceFineprint}>No commitment</Text>
          <View style={[styles.planCheck, selectedPlan === 'weekly' ? styles.planCheckSelected : null]}>
            {selectedPlan === 'weekly' ? (
              <Check color={colors.onCoral} height={13} strokeWidth={3} width={13} />
            ) : null}
          </View>
        </Pressable>
      </View>

      {showSavingsCallout && selectedPlan === 'annual' ? (
        <View style={styles.savingsCallout}>
          <Text style={styles.savingsCalloutText}>💰  Annual plan saves {ANNUAL_SAVINGS_PERCENT}% vs weekly</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  priceCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1.5,
    flex: 1,
    padding: 16,
    position: 'relative',
    ...shadows.card,
  },
  priceCardFeatured: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
    borderWidth: 2,
  },
  priceCardWeeklySelected: {
    borderColor: colors.coral,
    borderWidth: 2,
  },
  priceBestBadge: {
    marginBottom: 6,
  },
  priceBestText: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  priceBestTextMuted: {
    color: colors.muted,
  },
  priceAmount: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  pricePeriod: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  priceFineprint: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  planCheck: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 10,
    width: 22,
  },
  planCheckSelected: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  savingsCallout: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  savingsCalloutText: {
    color: colors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
});
