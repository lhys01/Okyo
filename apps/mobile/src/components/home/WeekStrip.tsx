import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../theme/okyoTheme';

export function WeekStrip({ activityDates, installDateKey, now = new Date(), onDayPress, selectedDateKey }: { activityDates: readonly string[]; installDateKey?: string | null; now?: Date; onDayPress?: (dateKey: string) => void; selectedDateKey?: string }) {
  const days = getCurrentWeek(now);
  const todayKey = toDateKey(now);
  const activity = new Set(activityDates);

  return (
    <View accessibilityLabel="This week" style={styles.strip}>
      {days.map((day) => {
        const key = toDateKey(day);
        const isToday = key === todayKey;
        const beforeStart = Boolean(installDateKey && key < installDateKey);
        const selected = key === selectedDateKey || (!selectedDateKey && isToday);
        const label = `${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ', today' : ''}${activity.has(key) ? ', Okyo activity' : ''}${beforeStart ? ', before Okyo started' : ''}`;
        return (
          <Pressable disabled={beforeStart} key={key} accessibilityLabel={label} accessibilityRole="button" onPress={() => onDayPress?.(key)} style={({ pressed }) => [styles.day, beforeStart ? styles.dayDisabled : null, pressed ? styles.pressed : null]}>
            <Text style={[styles.dayLetter, beforeStart ? styles.disabledText : null]}>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
            <View style={[styles.dateCircle, selected ? styles.todayCircle : null]}>
              <Text style={[styles.date, selected ? styles.todayDate : null, beforeStart ? styles.disabledText : null]}>{day.getDate()}</Text>
            </View>
            <View style={[styles.dot, activity.has(key) ? styles.dotActive : null, beforeStart ? styles.disabledDot : null]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function getCurrentWeek(now: Date): Date[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const styles = StyleSheet.create({
  date: { ...typography.numericStat, fontSize: 18, lineHeight: 22 },
  dateCircle: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', marginTop: 2, width: 36 },
  day: { alignItems: 'center', flex: 1 },
  dayLetter: { ...typography.label, color: colors.body, textAlign: 'center' },
  dayDisabled: { opacity: 0.42 },
  dot: { borderRadius: 2, height: 4, marginTop: 3, width: 4 },
  dotActive: { backgroundColor: colors.coralDark },
  disabledDot: { backgroundColor: colors.muted },
  disabledText: { color: colors.muted },
  pressed: { opacity: 0.7 },
  strip: { alignItems: 'center', flexDirection: 'row', height: 64, width: '100%' },
  todayCircle: { backgroundColor: colors.ink },
  todayDate: { color: colors.surface },
});
