import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  CheckCircle,
  NavArrowLeft,
} from 'iconoir-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { KikoMascot } from '../components/KikoMascot';
import { ProgressFill } from '../components/OkyoUI';
import { getPricingTrialNote, PricingCards, type PricingPlan } from '../components/PricingCards';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, radius, shadows, spacing, typography } from '../theme/okyoTheme';

type PaywallNavigation = NativeStackNavigationProp<RootStackParamList>;

const weeklyFreeScanLimit = 3;

export function PaywallScreen() {
  const navigation = useNavigation<PaywallNavigation>();
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const didTrackView = useRef(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>('annual');
  const scansLeft = Math.max(0, weeklyFreeScanLimit - weeklyScanCount);
  const scanProgress = Math.min(weeklyScanCount / weeklyFreeScanLimit, 1);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    didTrackView.current = true;
    track(analyticsEvents.PAYWALL_VIEWED, { screen: 'PaywallScreen' });
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);

    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      duration: reduceMotion ? 120 : 560,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, reveal]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" hitSlop={10} style={styles.backButton} onPress={() => navigation.goBack()}>
          <NavArrowLeft color={colors.charcoal} height={24} strokeWidth={2.2} width={24} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={styles.kikoBadge}>
            <KikoMascot animated="success" pose="happy" size={84} />
          </View>
          <Text style={styles.kicker}>Okyo Plus</Text>
          <Text style={styles.title}>Unlimited scans. Every dish, remade.</Text>
          <Text style={styles.body}>
            Keep scanning restaurant meals, saving swaps, and building grocery lists without the weekly scan cap.
          </Text>
        </View>

        <PricingCards onSelectPlan={setSelectedPlan} selectedPlan={selectedPlan} />

        <View style={styles.scanMeter}>
          <View style={styles.scanMeterCopy}>
            <Text style={styles.meterLabel}>This week</Text>
            <Text style={styles.meterValue}>{weeklyScanCount}/{weeklyFreeScanLimit} free scans used</Text>
            <ProgressFill progress={scanProgress} style={styles.scanMeterProgress} />
          </View>
          <View style={styles.scanBubble}>
            <Camera color={colors.coral} height={23} strokeWidth={2.1} width={23} />
            <Text style={styles.scanBubbleText}>{scansLeft} left</Text>
          </View>
        </View>

        <View style={styles.featureList}>
          <FeatureRow index={0} reduceMotion={reduceMotion} reveal={reveal}>Scan every craving, not just the first few.</FeatureRow>
          <FeatureRow index={1} reduceMotion={reduceMotion} reveal={reveal}>Save unlimited restaurant-style recipes and grocery lists.</FeatureRow>
          <FeatureRow index={2} reduceMotion={reduceMotion} reveal={reveal}>Keep savings and challenges moving all week.</FeatureRow>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={handleUpgradePress} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>Start 7-Day Free Trial</Text>
          </Pressable>
          <Text style={styles.disclaimer}>{getPricingTrialNote(selectedPlan)}</Text>
          <Text style={styles.disclaimer}>Purchases aren't available in this preview build yet.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function handleUpgradePress() {
    Alert.alert('Okyo Plus', "Purchases aren't available in this preview build yet — check back soon.");
  }
}

function FeatureRow({
  children,
  index,
  reduceMotion,
  reveal,
}: {
  children: ReactNode;
  index: number;
  reduceMotion: boolean;
  reveal: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.featureRow,
        {
          opacity: reveal.interpolate({
            inputRange: [0, 0.2 + index * 0.18, 1],
            outputRange: [0, 0, 1],
          }),
          transform: [
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [reduceMotion ? 0 : 8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <CheckCircle color={colors.green} height={22} strokeWidth={2} width={22} />
      <Text style={styles.featureText}>{children}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: 80,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 42,
  },
  backText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.hero,
    marginTop: 14,
    padding: 24,
    ...shadows.hero,
  },
  kikoBadge: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    height: 98,
    justifyContent: 'center',
    marginBottom: 22,
    width: 98,
  },
  kicker: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.display,
  },
  body: {
    ...typography.body,
    marginTop: 14,
  },
  scanMeter: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    padding: 18,
    ...shadows.card,
  },
  scanMeterCopy: {
    flex: 1,
    marginRight: 14,
  },
  meterLabel: {
    ...typography.caption,
  },
  meterValue: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  scanBubble: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  scanBubbleText: {
    color: colors.coralDark,
    fontSize: 13,
    fontWeight: '800',
  },
  scanMeterProgress: {
    marginTop: 12,
  },
  featureList: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    gap: 16,
    marginTop: 18,
    padding: 20,
    ...shadows.card,
  },
  featureRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  featureText: {
    ...typography.body,
    flex: 1,
    marginTop: -1,
  },
  actions: {
    gap: 10,
    marginTop: 22,
  },
  primaryCta: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.button,
    minHeight: 58,
    justifyContent: 'center',
    ...shadows.cta,
  },
  primaryCtaText: {
    color: colors.onCoral,
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
  },
});
