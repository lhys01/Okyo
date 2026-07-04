import { ShieldCheck } from 'iconoir-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from './OkyoUI';

// Small, subtle trust/safety cue. Purely presentational — driven by data the
// app already has (recipe title/description). No AI calls, no backend logic.

type TrustBadgeProps = {
  note: string;
};

export function TrustBadge({ note }: TrustBadgeProps) {
  return (
    <View style={styles.badge}>
      <ShieldCheck color={colors.green} height={18} strokeWidth={2.2} width={18} />
      <Text style={styles.badgeText}>{note}</Text>
    </View>
  );
}

const rawSeafoodPattern = /\b(sushi|sashimi|poke|tartare|ceviche|crudo|raw\s+(fish|tuna|salmon|shrimp|oyster|scallop))\b/i;
const rawEggPattern = /\b(raw|runny)\s+egg/i;

// Returns a food-safety note when the dish text suggests raw or undercooked
// ingredients, otherwise null. Detection is keyword-based on text the recipe
// already contains — it never claims more than the text supports.
export function getFoodSafetyNote(text: string): string | null {
  if (rawSeafoodPattern.test(text)) {
    return 'Food safety note: use sushi-grade fish, or choose cooked shrimp or smoked salmon if unsure.';
  }

  if (rawEggPattern.test(text)) {
    return 'Food safety note: use pasteurized eggs if serving raw or runny.';
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  badgeText: {
    color: colors.green,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    minWidth: 0,
  },
});
