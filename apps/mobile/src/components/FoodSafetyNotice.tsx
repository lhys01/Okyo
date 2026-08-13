import { WarningTriangle } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FoodPreferenceConflict } from '../state/foodPreferences';
import { colors, fontFamilies, radius } from '../theme/okyoTheme';

export function FoodSafetyNotice({ conflicts, onAdapt }: { conflicts: FoodPreferenceConflict[]; onAdapt?: () => void }) {
  const serious = conflicts.filter((item) => item.category === 'allergy' || item.category === 'restriction');
  const soft = conflicts.filter((item) => item.category === 'avoidance' || item.category === 'dislike');
  if (!serious.length && !soft.length) return null;
  const allergy = serious.find((item) => item.category === 'allergy');
  const displayed = allergy ?? serious[0] ?? soft[0];
  const title = allergy ? 'ALLERGY WARNING' : serious.length ? 'Dietary conflict' : 'Preference notice';
  const body = allergy
    ? `This recipe appears to contain ${displayed.ingredient}, which matches your ${displayed.preference} allergy. Review every ingredient and label.`
    : serious.length
      ? `This recipe still includes ${displayed.ingredient}, which may conflict with your ${displayed.preference} restriction.`
      : `This recipe contains ${displayed.ingredient}, which you usually avoid.`;
  return <View accessibilityRole="alert" style={[styles.card, allergy && styles.allergyCard]}><View style={styles.heading}><WarningTriangle color={allergy ? colors.danger : colors.coralDark} height={21} width={21} /><Text style={[styles.title, allergy && styles.allergyTitle]}>{title}</Text></View><Text style={styles.body}>{body}</Text>{onAdapt && serious.length ? <Pressable accessibilityRole="button" onPress={onAdapt} style={styles.action}><Text style={styles.actionText}>Make this work for me</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderRadius: radius.panel, borderWidth: 1, marginBottom: 14, padding: 14 }, allergyCard: { backgroundColor: '#fff0ee', borderColor: colors.danger, borderWidth: 1.5 }, heading: { alignItems: 'center', flexDirection: 'row', gap: 8 }, title: { color: colors.coralDark, fontFamily: fontFamilies.extraBold, fontSize: 13 }, allergyTitle: { color: colors.danger, letterSpacing: 0.4 }, body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: 7 }, action: { alignSelf: 'flex-start', borderColor: colors.ink, borderRadius: 13, borderWidth: 1, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8 }, actionText: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 12.5 } });
