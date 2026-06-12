import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  CheckCircle,
  NavArrowLeft,
  Spark,
} from 'iconoir-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { colors, typography } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';

type PaywallNavigation = NativeStackNavigationProp<RootStackParamList, 'PaywallScreen'>;

const weeklyFreeScanLimit = 3;

export function PaywallScreen() {
  const navigation = useNavigation<PaywallNavigation>();
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const didTrackView = useRef(false);
  const scansLeft = Math.max(0, weeklyFreeScanLimit - weeklyScanCount);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    didTrackView.current = true;
    track(analyticsEvents.PAYWALL_VIEWED, { screen: 'PaywallScreen' });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" hitSlop={10} style={styles.backButton} onPress={() => navigation.goBack()}>
          <NavArrowLeft color={colors.charcoal} height={24} strokeWidth={2.2} width={24} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={styles.iconBadge}>
            <Spark color={colors.coral} height={32} strokeWidth={2.1} width={32} />
          </View>
          <Text style={styles.kicker}>Okyo Plus</Text>
          <Text style={styles.title}>Unlimited scans. Every dish, remade.</Text>
          <Text style={styles.body}>
            Keep scanning restaurant meals, saving swaps, and building grocery lists without the weekly scan cap.
          </Text>
        </View>

        <View style={styles.scanMeter}>
          <View>
            <Text style={styles.meterLabel}>This week</Text>
            <Text style={styles.meterValue}>{weeklyScanCount}/{weeklyFreeScanLimit} free scans used</Text>
          </View>
          <View style={styles.scanBubble}>
            <Camera color={colors.coral} height={23} strokeWidth={2.1} width={23} />
            <Text style={styles.scanBubbleText}>{scansLeft} left</Text>
          </View>
        </View>

        <View style={styles.featureList}>
          <FeatureRow>Scan every craving, not just the first few.</FeatureRow>
          <FeatureRow>Save unlimited restaurant-style recipes and grocery lists.</FeatureRow>
          <FeatureRow>Keep savings, XP, and challenges moving all week.</FeatureRow>
        </View>

        <View style={styles.actions}>
          <View style={styles.disabledCta}>
            <Text style={styles.disabledCtaText}>Payments coming soon</Text>
          </View>
          <Text style={styles.disclaimer}>No purchase is available in this preview build.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.featureRow}>
      <CheckCircle color={colors.green} height={22} strokeWidth={2} width={22} />
      <Text style={styles.featureText}>{children}</Text>
    </View>
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
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 24,
    height: 58,
    justifyContent: 'center',
    marginBottom: 22,
    width: 58,
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
  disabledCta: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radius.button,
    minHeight: 58,
    justifyContent: 'center',
    opacity: 0.52,
  },
  disabledCtaText: {
    color: '#fffdf8',
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
  },
});
