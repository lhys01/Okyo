import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fontFamilies } from './OkyoUI';
import { recipeColors } from '../theme/recipeTheme';
import { MAX_CORRECTION_NOTE_LENGTH } from '../utils/recipeCorrection';
import { RecipeUpdatingStatus } from './RecipeUpdatingStatus';

// One-tap starting points. Tapping appends to whatever is already typed so a
// user can stack a couple ("Make it vegetarian, halve the servings").
export const CUSTOMIZE_SUGGESTIONS = [
  { label: 'Vegetarian', instruction: 'Make it vegetarian' },
  { label: 'Half servings', instruction: 'Halve the servings' },
  { label: 'No nuts', instruction: 'No nuts' },
  { label: 'Less calories', instruction: 'Lower the calories' },
  { label: 'Dairy-free', instruction: 'Make it dairy-free' },
  { label: 'Veggies', instruction: 'Add more veggies' },
] as const;

// How close to the 300-char cap before the counter turns red.
const COUNTER_WARN_REMAINING = 40;

type RecipeEditCardProps = {
  canSubmit: boolean;
  correctionError: string | null;
  correctionText: string;
  isCorrecting: boolean;
  onCancel: () => void;
  onChangeCorrectionText: (value: string) => void;
  onSubmitCorrection: () => void;
};

export function RecipeEditCard({
  canSubmit,
  correctionError,
  correctionText,
  isCorrecting,
  onCancel,
  onChangeCorrectionText,
  onSubmitCorrection,
}: RecipeEditCardProps) {
  const nearLimit = MAX_CORRECTION_NOTE_LENGTH - correctionText.length <= COUNTER_WARN_REMAINING;

  const applySuggestion = (instruction: string) => {
    if (isCorrecting) {
      return;
    }
    const existing = correctionText.trim();
    const next = existing ? `${existing}, ${instruction.toLowerCase()}` : instruction;
    onChangeCorrectionText(next.slice(0, MAX_CORRECTION_NOTE_LENGTH));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Customize recipe</Text>
      <View style={styles.suggestionRow}>
        {CUSTOMIZE_SUGGESTIONS.map(({ instruction, label }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            disabled={isCorrecting}
            hitSlop={4}
            onPress={() => applySuggestion(instruction)}
            style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
          >
            <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        accessibilityLabel="Describe how to change this recipe"
        blurOnSubmit
        editable={!isCorrecting}
        maxLength={MAX_CORRECTION_NOTE_LENGTH}
        onChangeText={onChangeCorrectionText}
        onSubmitEditing={() => { if (canSubmit && !isCorrecting) onSubmitCorrection(); }}
        placeholder="e.g. swap the shrimp for tofu and keep it under 20 minutes"
        placeholderTextColor={recipeColors.muted}
        returnKeyType="send"
        style={styles.input}
        value={correctionText}
      />
      <Text style={[styles.counter, nearLimit ? styles.counterWarn : null]}>
        {correctionText.length}/{MAX_CORRECTION_NOTE_LENGTH}
      </Text>

      {correctionError ? <Text style={styles.errorText}>{correctionError}</Text> : null}

      {isCorrecting ? (
        <RecipeUpdatingStatus message="Updating recipe" cancelLabel="Cancel update" onCancel={onCancel} />
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={onSubmitCorrection}
            style={[styles.primary, !canSubmit ? styles.disabled : null]}
          >
            <Text style={styles.primaryText}>Update Recipe</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondary}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDFB',
    borderColor: '#E9DDD5',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#FFF0F4',
    borderRadius: 999,
    flexBasis: '48%',
    flexGrow: 0,
    flexShrink: 1,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 4,
    width: '48%',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFF7F3',
    borderColor: '#E9DDD5',
    borderRadius: 16,
    borderWidth: 1,
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    marginTop: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  counter: {
    alignSelf: 'flex-end',
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  counterWarn: {
    color: recipeColors.orange,
  },
  errorText: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  primaryText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondary: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFB8',
    borderColor: '#E9DDD5',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  secondaryText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
