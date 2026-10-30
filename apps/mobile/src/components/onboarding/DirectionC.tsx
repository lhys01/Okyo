// Direction C primitives. Native RN only — the reference PNGs are visual guides,
// never displayed as screens.

import type { ReactNode } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, View,
  type ImageStyle, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { kikoSource, type KikoPose } from '../../../assets/kiko-transparent';
import { colors, fontFamilies } from '../../theme/okyoTheme';

const HAIRLINE = '#E9E1D5';
const RULE = '#EAE1D4';

// ─── Shell ────────────────────────────────────────────────────────────────────

type ShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
};

export function DirectionCShell({ children, footer, scroll = true }: ShellProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.shell}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────

type ProgressProps = {
  onBack?: () => void;
  onSkip?: () => void;
  percent: number;
  showBack: boolean;
};

export function DirectionCProgress({ onBack, onSkip, percent, showBack }: ProgressProps) {
  return (
    <View style={styles.progressRow}>
      {showBack ? (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={styles.backHit}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.backHit} />
      )}
      <View
        accessibilityLabel={`Setup ${percent} percent complete`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 100, min: 0, now: percent }}
        style={styles.track}
      >
        <View style={[styles.trackFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.percent}>{percent}%</Text>
      {onSkip ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onSkip} style={styles.skipHit}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Type ─────────────────────────────────────────────────────────────────────

export function DisplayHeadline({ children }: { children: ReactNode }) {
  return <Text style={styles.display}>{children}</Text>;
}

export function QuestionHeadline({ children }: { children: ReactNode }) {
  return <Text style={styles.question}>{children}</Text>;
}

export function BodyText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.bodyText, style]}>{children}</Text>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={styles.caption}>{children}</Text>;
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.groupLabel}>{children}</Text>;
}

// ─── Answer row ───────────────────────────────────────────────────────────────

type AnswerRowProps = {
  detail?: string;
  index?: number;
  label: string;
  onPress: () => void;
  selected: boolean;
  trailing?: ReactNode;
};

/**
 * Selection is signalled three ways — inverted fill, a check glyph and the
 * accessibility selected state — so it never depends on colour alone.
 */
export function AnswerRow({ detail, index, label, onPress, selected, trailing }: AnswerRowProps) {
  return (
    <Pressable
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.answerRow, selected ? styles.answerRowSelected : null]}
    >
      {typeof index === 'number' ? (
        <Text style={[styles.answerIndex, selected ? styles.answerIndexSelected : null]}>
          {index}
        </Text>
      ) : null}
      <View style={styles.answerCopy}>
        <Text style={[styles.answerLabel, selected ? styles.answerLabelSelected : null]}>
          {label}
        </Text>
        {detail ? (
          <Text style={[styles.answerDetail, selected ? styles.answerDetailSelected : null]}>
            {detail}
          </Text>
        ) : null}
        {trailing}
      </View>
      <View style={[styles.indicator, selected ? styles.indicatorSelected : null]}>
        {selected ? <Text style={styles.indicatorGlyph}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

/** Density bars for the guidance question — filled count carries the meaning. */
export function GuidanceBars({ filled, selected }: { filled: number; selected: boolean }) {
  return (
    <View style={styles.barsRow}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.bar,
            i < filled
              ? selected ? styles.barOnSelected : styles.barOn
              : selected ? styles.barOffSelected : styles.barOff,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.ghostButton}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Kiko ─────────────────────────────────────────────────────────────────────

type KikoNoteProps = { line: string; pose: KikoPose; size?: number };

export function KikoNote({ line, pose, size = 52 }: KikoNoteProps) {
  return (
    <View style={styles.kikoRow}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        source={kikoSource(pose)}
        style={{ height: size, width: size }}
      />
      <Text style={styles.kikoLine}>{line}</Text>
    </View>
  );
}

export function KikoImage({ pose, size, style }: { pose: KikoPose; size: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      source={kikoSource(pose)}
      style={[{ height: size, width: size }, style]}
    />
  );
}

// ─── Surfaces ─────────────────────────────────────────────────────────────────

export function Note({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'good' }) {
  return <View style={[styles.note, tone === 'good' ? styles.noteGood : null]}>{children}</View>;
}

export function Chip({ label, selected = false }: { label: string; selected?: boolean }) {
  return (
    <View style={[styles.chip, selected ? styles.chipSelected : null]}>
      {selected ? <Text style={styles.chipTick}>✓</Text> : null}
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{label}</Text>
    </View>
  );
}

export function Rule() {
  return <View style={styles.rule} />;
}

export function Spacer({ flex = 1 }: { flex?: number }) {
  return <View style={{ flex }} />;
}

const styles = StyleSheet.create({
  answerCopy: { flex: 1, gap: 3 },
  answerDetail: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18 },
  answerDetailSelected: { color: 'rgba(255,255,255,0.66)' },
  answerIndex: {
    color: colors.muted, fontFamily: fontFamilies.extraBold, fontSize: 15, width: 20,
  },
  answerIndexSelected: { color: 'rgba(255,255,255,0.55)' },
  answerLabel: {
    color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 18, letterSpacing: -0.36,
  },
  answerLabelSelected: { color: '#FFFFFF', fontFamily: fontFamilies.bold },
  answerRow: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: HAIRLINE, borderRadius: 18,
    borderWidth: 2, flexDirection: 'row', gap: 15, minHeight: 74, paddingHorizontal: 20,
    paddingVertical: 16,
  },
  answerRowSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  backGlyph: { color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 30 },
  backHit: { alignItems: 'flex-start', height: 44, justifyContent: 'center', width: 44 },
  bar: { borderRadius: 3, height: 9, width: 26 },
  barOff: { backgroundColor: '#E4DBCE' },
  barOffSelected: { backgroundColor: 'rgba(255,255,255,0.28)' },
  barOn: { backgroundColor: colors.charcoal },
  barOnSelected: { backgroundColor: '#FFFFFF' },
  barsRow: { flexDirection: 'row', gap: 5, marginTop: 11 },
  body: { flex: 1, paddingHorizontal: 26 },
  bodyText: {
    color: colors.body, fontFamily: fontFamilies.body, fontSize: 18, letterSpacing: -0.27,
    lineHeight: 26,
  },
  caption: {
    color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13.5, letterSpacing: -0.13,
    lineHeight: 20,
  },
  chip: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 999,
    borderWidth: 1.5, flexDirection: 'row', gap: 7, paddingHorizontal: 15, paddingVertical: 9,
  },
  chipLabel: { color: colors.charcoal, fontFamily: fontFamilies.semibold, fontSize: 14 },
  chipLabelSelected: { color: '#FFFFFF' },
  chipSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  chipTick: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 12 },
  display: {
    color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 41, letterSpacing: -1.64,
    lineHeight: 45,
  },
  footer: { paddingBottom: 24, paddingHorizontal: 26, paddingTop: 4 },
  ghostButton: { alignItems: 'center', height: 52, justifyContent: 'center' },
  ghostLabel: { color: colors.muted, fontFamily: fontFamilies.semibold, fontSize: 15 },
  groupLabel: {
    color: colors.muted, fontFamily: fontFamilies.extraBold, fontSize: 12, letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  indicator: {
    alignItems: 'center', borderColor: '#DFD6C8', borderRadius: 999, borderWidth: 2, height: 26,
    justifyContent: 'center', width: 26,
  },
  indicatorGlyph: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 13 },
  indicatorSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  kikoLine: {
    color: colors.muted, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 13.5,
    letterSpacing: -0.13, lineHeight: 19,
  },
  kikoRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  note: {
    backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 18, borderWidth: 1.5,
    padding: 20,
  },
  noteGood: { backgroundColor: colors.greenSoft, borderColor: '#BFE6D5' },
  percent: {
    color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 13, textAlign: 'right',
    width: 44,
  },
  primaryButton: {
    alignItems: 'center', backgroundColor: colors.charcoal, borderRadius: 18, height: 66,
    justifyContent: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 18, letterSpacing: -0.27,
  },
  progressRow: {
    alignItems: 'center', flexDirection: 'row', gap: 16, paddingHorizontal: 26, paddingTop: 6,
  },
  question: {
    color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 33, letterSpacing: -1.15,
    lineHeight: 37,
  },
  rule: { backgroundColor: RULE, height: 1.5 },
  scrollBody: { flexGrow: 1, paddingHorizontal: 26 },
  secondaryButton: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: HAIRLINE, borderRadius: 18,
    borderWidth: 2, height: 66, justifyContent: 'center',
  },
  secondaryLabel: {
    color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 18, letterSpacing: -0.27,
  },
  shell: { backgroundColor: colors.background, flex: 1 },
  skip: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 15 },
  skipHit: { alignItems: 'flex-end', height: 44, justifyContent: 'center', minWidth: 44 },
  track: { backgroundColor: 'rgba(43,43,48,0.1)', borderRadius: 2, flex: 1, height: 4 },
  trackFill: { backgroundColor: colors.charcoal, borderRadius: 2, height: 4 },
});
