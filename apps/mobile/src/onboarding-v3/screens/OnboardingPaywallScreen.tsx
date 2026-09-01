import { CheckCircle } from 'iconoir-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEV_BYPASS_PAYWALL } from '../../config/devFlags';
import { LegalDocumentModal } from '../../legal/LegalDocumentModal';
import type { LegalDocumentId } from '../../legal/legalDocuments';
import { useEntitlement } from '../../services/revenueCat';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { getRevenueCatPaywallPlans, hasUsableRevenueCatOffering } from '../../utils/revenueCatPaywall';
import type { OnboardingV3Error } from '../controller/onboardingV3Machine';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { KikoOnboardingArtwork } from '../components/KikoOnboardingArtwork';
import { getKikoOnboardingAssignment } from '../assets/kikoOnboardingRegistry';
import { personalizedGoalContent, type PersonalizedOnboardingProfile } from '../state/personalizedOnboarding';

export function OnboardingPaywallScreen({ allowDevelopmentPaywallBypass = true, developmentPreview, isBusy, error, profile, onPurchase, onRestore, onAlreadyEntitled, onDevSkipToHome, onDismissError }: {
  allowDevelopmentPaywallBypass?: boolean;
  developmentPreview?: { notice: string | null; onExit: () => void };
  isBusy: boolean;
  error: OnboardingV3Error | null;
  profile: PersonalizedOnboardingProfile;
  onPurchase: (pkg: PurchasesPackage) => void;
  onRestore: () => void;
  onAlreadyEntitled: () => void;
  onDevSkipToHome: () => void;
  onDismissError: () => void;
}) {
  const entitlement = useEntitlement();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // App Store Review Guideline 3.1.2 requires the Terms and Privacy Policy to
  // be reachable from the purchase screen. Onboarding has no navigator yet, so
  // the documents are presented as a modal over this screen — onboarding
  // routing itself is untouched.
  const [legalDocumentId, setLegalDocumentId] = useState<LegalDocumentId | null>(null);
  const acceptedEntitlement = useRef(false);
  const plans = useMemo(
    () => getRevenueCatPaywallPlans(entitlement.status === 'ready' ? entitlement.offering : null),
    [entitlement],
  );
  const providerUnavailable = entitlement.status === 'unavailable' || entitlement.status === 'error' ||
    (entitlement.status === 'ready' && !hasUsableRevenueCatOffering(entitlement.offering));
  const selected = plans.find((plan) => plan.package.identifier === selectedId) ?? plans[0] ?? null;
  const goal = profile.primaryGoal ?? 'save_money';
  const content = personalizedGoalContent[goal];
  const kiko = getKikoOnboardingAssignment('shared', 'paywall');

  useEffect(() => {
    // TEMPORARY DEVELOPMENT PAYWALL BYPASS — see src/config/devFlags.ts.
    // Finishes onboarding straight into MainTabs/Home without a purchase and
    // without the real-purchase "Okyo Pro unlocked" handoff screen. Always
    // false in release builds; set DEV_BYPASS_PAYWALL_ENABLED to false to
    // restore the real paywall.
    if (DEV_BYPASS_PAYWALL && allowDevelopmentPaywallBypass && !acceptedEntitlement.current) {
      acceptedEntitlement.current = true;
      onDevSkipToHome();
      return;
    }
    if (entitlement.status === 'ready' && entitlement.isEntitled && !acceptedEntitlement.current) {
      acceptedEntitlement.current = true;
      onAlreadyEntitled();
    }
  }, [allowDevelopmentPaywallBypass, entitlement, onAlreadyEntitled, onDevSkipToHome]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {developmentPreview ? (
          <View style={styles.previewHeader}>
            <Text style={styles.previewLabel}>Development-only RevenueCat preview</Text>
            <Pressable
              accessibilityLabel="Exit RevenueCat paywall preview"
              accessibilityRole="button"
              onPress={developmentPreview.onExit}
              style={styles.previewExit}
              testID="revenuecat-preview-exit"
            >
              <Text style={styles.previewExitText}>Exit preview</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.paywallIntro}>
          <View style={styles.paywallCopy}>
            <Text style={styles.eyebrow}>Okyo Pro</Text>
            <Text style={styles.title}>{content.paywallHeadline}</Text>
          </View>
          {kiko?.assetId && kiko.size === 'small' ? <KikoOnboardingArtwork assetId={kiko.assetId} sizeRole="small" /> : null}
        </View>
        <Text style={styles.body}>Your personalized plan is ready. Choose a plan to unlock your first real Okyo scan.</Text>
        <View style={styles.benefits}>
          {content.planBenefits.slice(0, 3).map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <CheckCircle color={colors.green} height={21} width={21} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {entitlement.status === 'loading' ? (
          <View style={styles.statusCard}><ActivityIndicator color={colors.coral} /><Text style={styles.statusText}>Loading available plans…</Text></View>
        ) : null}

        {plans.map((plan) => {
          const active = selected?.package.identifier === plan.package.identifier;
          return (
            <Pressable
              accessibilityLabel={`${plan.title}, ${plan.pricing.primary}, ${plan.pricing.secondary}. ${plan.introOffer ? `${plan.introOffer} ` : ''}${plan.renewalDisclosure}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              key={plan.package.identifier}
              onPress={() => setSelectedId(plan.package.identifier)}
              style={[styles.plan, active && styles.planSelected]}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.badge}>{plan.badge}</Text>
              </View>
              <Text style={styles.primaryPrice}>{plan.pricing.primary}</Text>
              <Text style={styles.secondaryPrice}>{plan.pricing.secondary}</Text>
              {plan.introOffer ? <Text style={styles.introOffer}>{plan.introOffer}</Text> : null}
              <Text style={styles.renewalDisclosure}>{plan.renewalDisclosure}</Text>
            </Pressable>
          );
        })}

        {providerUnavailable ? (
          <View accessibilityLiveRegion="polite" style={styles.unavailableCard}>
            <Text style={styles.unavailableTitle}>Subscriptions are unavailable right now</Text>
            <Text style={styles.statusText}>Okyo couldn't load subscription options. Please try again in a moment.</Text>
          </View>
        ) : null}

        {error && error.kind !== 'purchase' ? (
          <View accessibilityLiveRegion="polite" style={styles.errorCard}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {developmentPreview?.notice ? <Text accessibilityLiveRegion="polite" style={styles.previewNotice}>{developmentPreview.notice}</Text> : null}
        {selected ? <OnboardingCTA disabled={isBusy} label={isBusy ? 'Working…' : `Choose ${selected.title}`} onPress={() => onPurchase(selected.package as PurchasesPackage)} /> : null}
        <Pressable accessibilityLabel="Restore purchases" accessibilityRole="button" disabled={isBusy} onPress={onRestore} style={styles.restore}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </Pressable>
        <View style={styles.legalRow}>
          <Pressable accessibilityHint="Opens Okyo's Terms of Service" accessibilityLabel="Terms of Service" accessibilityRole="button" onPress={() => setLegalDocumentId('terms-of-service')} style={styles.legalLink}>
            <Text style={styles.legalLinkText}>Terms</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>·</Text>
          <Pressable accessibilityHint="Opens Okyo's Privacy Policy" accessibilityLabel="Privacy Policy" accessibilityRole="button" onPress={() => setLegalDocumentId('privacy-policy')} style={styles.legalLink}>
            <Text style={styles.legalLinkText}>Privacy</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>·</Text>
          <Pressable accessibilityHint="Opens Okyo's Subscription Terms" accessibilityLabel="Subscription Terms" accessibilityRole="button" onPress={() => setLegalDocumentId('subscription-terms')} style={styles.legalLink}>
            <Text style={styles.legalLinkText}>Subscription terms</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>·</Text>
          <Pressable accessibilityHint="Opens your App Store subscription settings" accessibilityLabel="Manage subscription" accessibilityRole="button" onPress={() => { void Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => undefined); }} style={styles.legalLink}>
            <Text style={styles.legalLinkText}>Manage subscription</Text>
          </Pressable>
        </View>
      </View>
      <LegalDocumentModal documentId={legalDocumentId} onClose={() => setLegalDocumentId(null)} />
      <Modal animationType="fade" onRequestClose={onDismissError} transparent visible={error?.kind === 'purchase'}>
        <View style={styles.modalBackdrop}>
          <View accessibilityRole="alert" accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>Purchase didn't go through</Text>
            <Text style={styles.dialogBody}>{error?.message}</Text>
            <Pressable
              accessibilityLabel="Try purchase again"
              accessibilityRole="button"
              disabled={isBusy || !selected}
              onPress={() => selected && onPurchase(selected.package as PurchasesPackage)}
              style={[styles.dialogPrimary, (isBusy || !selected) && styles.dialogDisabled]}
            >
              <Text style={styles.dialogPrimaryText}>Try Again</Text>
            </Pressable>
            <Pressable accessibilityLabel="Not now" accessibilityRole="button" disabled={isBusy} onPress={onDismissError} style={styles.dialogSecondary}>
              <Text style={styles.dialogSecondaryText}>Not Now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  previewHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  previewLabel: { color: colors.coralDark, flex: 1, fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 17, paddingRight: 12 },
  previewExit: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  previewExitText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 12 },
  paywallIntro: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  paywallCopy: { flex: 1 },
  content: { paddingBottom: 22, paddingHorizontal: 24, paddingTop: 30 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 35, letterSpacing: -0.8, lineHeight: 42, marginTop: 8 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginTop: 11 },
  benefits: { gap: 10, marginBottom: 10, marginTop: 22 },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  benefitText: { color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 14 },
  plan: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 2, marginTop: 12, padding: 18 },
  planSelected: { borderColor: colors.coral },
  planHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  planTitle: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 20 },
  badge: { backgroundColor: colors.coralSoft, borderRadius: 999, color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  primaryPrice: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 25, marginTop: 13 },
  secondaryPrice: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 13, marginTop: 3 },
  statusCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, gap: 10, marginTop: 18, padding: 20 },
  statusText: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  unavailableCard: { backgroundColor: colors.card, borderRadius: 20, marginTop: 18, padding: 18 },
  unavailableTitle: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 17, marginBottom: 7, textAlign: 'center' },
  errorCard: { backgroundColor: '#FFF5F2', borderColor: '#F1C4B9', borderRadius: 16, borderWidth: 1, marginTop: 13, padding: 13 },
  errorText: { color: colors.danger, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  footer: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 7, paddingHorizontal: 24, paddingTop: 11 },
  previewNotice: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18, marginBottom: 8, textAlign: 'center' },
  restore: { alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  introOffer: { color: colors.green, fontFamily: fontFamilies.bold, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  renewalDisclosure: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11.5, lineHeight: 16, marginTop: 5 },
  legalRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingBottom: 4 },
  legalLink: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  legalLinkText: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12, textDecorationLine: 'underline' },
  legalSeparator: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12 },
  restoreText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(28,24,25,0.38)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.card, borderRadius: 24, maxWidth: 360, padding: 22, width: '100%' },
  dialogTitle: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 21, textAlign: 'center' },
  dialogBody: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  dialogPrimary: { alignItems: 'center', backgroundColor: colors.softCharcoal, borderRadius: 999, justifyContent: 'center', marginTop: 18, minHeight: 52 },
  dialogPrimaryText: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 15 },
  dialogSecondary: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  dialogSecondaryText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14 },
  dialogDisabled: { opacity: 0.45 },
});
