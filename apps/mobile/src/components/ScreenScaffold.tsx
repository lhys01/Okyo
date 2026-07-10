import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, ScreenContainer, SecondaryButton, sharedStyles } from './OkyoUI';
import { colors, radius } from '../theme/okyoTheme';

type ScreenScaffoldProps = {
  title: string;
  body: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: ReactNode;
};

export function ScreenScaffold({
  title,
  body,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: ScreenScaffoldProps) {
  return (
    <ScreenContainer scroll={false} centered>
      <Text style={styles.kicker}>Okyo</Text>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {children}
      </View>
      <View style={styles.actions}>
        {primaryActionLabel && onPrimaryAction ? (
          <PrimaryButton onPress={onPrimaryAction}>{primaryActionLabel}</PrimaryButton>
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <SecondaryButton onPress={onSecondaryAction}>{secondaryActionLabel}</SecondaryButton>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.coralDark,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  heroCard: {
    ...sharedStyles.card,
    borderRadius: radius.hero,
    padding: 20,
  },
  title: {
    color: colors.charcoal,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    marginBottom: 12,
  },
  body: {
    color: colors.body,
    fontSize: 17,
    lineHeight: 25,
  },
  actions: {
    gap: 12,
    marginTop: 18,
  },
});
