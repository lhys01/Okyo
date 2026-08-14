import { CheckCircle, NavArrowLeft } from 'iconoir-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { EntitlementState } from '../../services/revenueCat';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { getRevenueCatPaywallPlans, hasUsableRevenueCatOffering } from '../../utils/revenueCatPaywall';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { personalizedGoalContent, type PrimaryGoal } from '../state/personalizedOnboarding';
import type { OnboardingV4PremiumActionType } from '../state/onboardingV4PremiumAction';

export function V4PaywallScreen({ action, entitlement, error, goal, isBusy, onDismiss, onPurchase, onRestore }: {
  action: OnboardingV4PremiumActionType;
  entitlement: EntitlementState;
  error: string | null;
  goal: PrimaryGoal;
  isBusy: boolean;
  onDismiss: () => void;
  onPurchase: (pkg: PurchasesPackage) => void;
  onRestore: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const plans = useMemo(() => getRevenueCatPaywallPlans(entitlement.status === 'ready' ? entitlement.offering : null), [entitlement]);
  const selected = plans.find((plan) => plan.package.identifier === selectedId) ?? plans[0] ?? null;
  const unavailable = entitlement.status === 'unavailable' || entitlement.status === 'error' || (entitlement.status === 'ready' && !hasUsableRevenueCatOffering(entitlement.offering));
  const content = personalizedGoalContent[goal];
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}><Pressable accessibilityLabel="Back to free recipe" accessibilityRole="button" disabled={isBusy} onPress={onDismiss} style={styles.back}><NavArrowLeft color={colors.charcoal} height={24} width={24} /></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Okyo Pro</Text>
        <Text style={styles.title}>{content.paywallHeadline}</Text>
        <Text style={styles.body}>Unlock {action === 'cook' ? 'guided Cook Mode' : 'personalized recipe customization'} while keeping this free recipe available.</Text>
        <View style={styles.benefits}>{content.planBenefits.slice(0, 3).map((benefit) => <View key={benefit} style={styles.benefit}><CheckCircle color={colors.green} height={21} width={21} /><Text style={styles.benefitText}>{benefit}</Text></View>)}</View>
        {entitlement.status === 'loading' ? <View style={styles.status}><ActivityIndicator color={colors.coral} /><Text style={styles.statusText}>Checking available plans…</Text></View> : null}
        {plans.map((plan) => { const active = selected?.package.identifier === plan.package.identifier; return <Pressable accessibilityLabel={`${plan.title}, ${plan.pricing.primary}, ${plan.pricing.secondary}`} accessibilityRole="radio" accessibilityState={{ checked: active }} disabled={isBusy} key={plan.package.identifier} onPress={() => setSelectedId(plan.package.identifier)} style={[styles.plan, active && styles.planSelected]}><View style={styles.planHeader}><Text style={styles.planTitle}>{plan.title}</Text><Text style={styles.badge}>{plan.badge}</Text></View><Text style={styles.price}>{plan.pricing.primary}</Text><Text style={styles.secondary}>{plan.pricing.secondary}</Text></Pressable>; })}
        {unavailable ? <View style={styles.status}><Text style={styles.statusTitle}>Subscriptions are unavailable right now</Text><Text style={styles.statusText}>Okyo couldn’t verify access or load plans. Your free recipe is safe—go back or try again later.</Text></View> : null}
        {error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      </ScrollView>
      <View style={styles.footer}>{selected ? <OnboardingCTA disabled={isBusy} label={isBusy ? 'Working…' : `Choose ${selected.title}`} onPress={() => onPurchase(selected.package as PurchasesPackage)} /> : null}<Pressable accessibilityLabel="Restore purchases" accessibilityRole="button" disabled={isBusy} onPress={onRestore} style={styles.restore}><Text style={styles.restoreText}>Restore Purchases</Text></Pressable></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { backgroundColor: colors.background, flex: 1 }, header: { minHeight: 52, paddingHorizontal: 18 }, back: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 }, content: { paddingBottom: 24, paddingHorizontal: 24 }, eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }, title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 34, lineHeight: 41, marginTop: 8 }, body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginTop: 10 }, benefits: { gap: 10, marginTop: 20 }, benefit: { alignItems: 'center', flexDirection: 'row', gap: 9 }, benefitText: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 14 }, plan: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 2, marginTop: 13, padding: 17 }, planSelected: { borderColor: colors.coral }, planHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, planTitle: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 19 }, badge: { backgroundColor: colors.coralSoft, borderRadius: 999, color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 }, price: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 24, marginTop: 10 }, secondary: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 13, marginTop: 3 }, status: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, gap: 8, marginTop: 16, padding: 17 }, statusTitle: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 16, textAlign: 'center' }, statusText: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20, textAlign: 'center' }, error: { backgroundColor: '#FFF0EE', borderRadius: 16, marginTop: 13, padding: 13 }, errorText: { color: colors.danger, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' }, footer: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingHorizontal: 24, paddingTop: 10 }, restore: { alignItems: 'center', justifyContent: 'center', minHeight: 46 }, restoreText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14 } });
