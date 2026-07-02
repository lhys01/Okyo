import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Check, Mail, Xmark } from 'iconoir-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KikoMascot } from '../components/KikoMascot';
import { PrimaryButton, colors, typography } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { radius, shadows } from '../theme/okyoTheme';
import { uiLog } from '../utils/uiDebug';

type KitchenLetterNavigation = NativeStackNavigationProp<RootStackParamList, 'KitchenLetterScreen'>;

// The Kitchen Letter is Okyo's weekly meal-ideas newsletter. It is not wired to a
// backend yet, so this screen is an honest "coming soon / join the list" preview
// with a real, non-dead action (local opt-in confirmation). No external calls.
export function KitchenLetterScreen() {
  const navigation = useNavigation<KitchenLetterNavigation>();
  const [joined, setJoined] = useState(false);

  const close = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const join = () => {
    uiLog('KitchenLetterScreen', 'join_intent');
    setJoined(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={8}
            onPress={close}
            style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
          >
            <Xmark color={colors.charcoal} height={22} strokeWidth={2.2} width={22} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <KikoMascot pose="wave" size={132} />
        </View>

        <Text style={styles.kicker}>The Kitchen Letter</Text>
        <Text style={styles.title}>
          {joined ? 'You’re on the list!' : 'Weekly meal ideas from Kiko'}
        </Text>
        <Text style={styles.subtitle}>
          {joined
            ? 'Thanks for your interest. The Kitchen Letter is still being cooked up — we’ll have it ready soon.'
            : 'A short weekly note with seasonal recipes, smart homemade swaps, and grocery-saving tips. No spam, ever.'}
        </Text>

        {!joined ? (
          <View style={styles.perks}>
            <Perk icon={<Mail color={colors.coral} height={20} strokeWidth={2} width={20} />} label="One friendly email a week" />
            <Perk icon={<Bell color={colors.coral} height={20} strokeWidth={2} width={20} />} label="New recipe ideas by season" />
            <Perk icon={<Check color={colors.coral} height={20} strokeWidth={2} width={20} />} label="Easy unsubscribe anytime" />
          </View>
        ) : null}

        <View style={styles.action}>
          {joined ? (
            <PrimaryButton onPress={close}>Back to Okyo</PrimaryButton>
          ) : (
            <PrimaryButton onPress={join}>Join the Kitchen Letter</PrimaryButton>
          )}
        </View>
        {!joined ? (
          <Text style={styles.note}>Coming soon — joining saves your interest on this device.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Perk({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.perkRow}>
      <View style={styles.perkIcon}>{icon}</View>
      <Text style={styles.perkLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 44,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.hero,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 24,
  },
  kicker: {
    ...typography.caption,
    color: colors.coral,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.display,
    marginTop: 4,
  },
  subtitle: {
    ...typography.body,
    marginTop: 10,
  },
  perks: {
    gap: 14,
    marginTop: 24,
    padding: 20,
  },
  perkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  perkIcon: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  perkLabel: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '600',
  },
  action: {
    marginTop: 28,
  },
  note: {
    ...typography.caption,
    marginTop: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
