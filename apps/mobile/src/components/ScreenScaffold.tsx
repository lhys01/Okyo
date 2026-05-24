import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.container}>
      <Text style={styles.kicker}>Okyo</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
      <View style={styles.actions}>
        {primaryActionLabel && onPrimaryAction ? (
          <Pressable style={styles.primaryButton} onPress={onPrimaryAction}>
            <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
          </Pressable>
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <Pressable style={styles.secondaryButton} onPress={onSecondaryAction}>
            <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  kicker: {
    color: '#8d5d23',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1d1b16',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: 12,
  },
  body: {
    color: '#5f5a51',
    fontSize: 17,
    lineHeight: 25,
  },
  actions: {
    gap: 12,
    marginTop: 28,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1d1b16',
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#fffaf3',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#d3c4ae',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '700',
  },
});
