export const MAX_MEAL_DESCRIPTION_LENGTH = 240;

export function validateMealDescription(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Tell Okyo a little about the meal first.';
  if (trimmed.length > MAX_MEAL_DESCRIPTION_LENGTH) return 'Keep the description under 240 characters.';
  return null;
}
