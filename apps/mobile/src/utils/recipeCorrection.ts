import type { CorrectRecipeRequest } from '../api/types';
import type { RecipeMode } from '../mocks';

export const MAX_CORRECTION_NOTE_LENGTH = 300;

// Validates a user's free-text correction ("These are lamb chops, not
// chicken."). Returns a user-friendly error, or null when the trimmed text is
// safe to submit. Mirrors the pattern used by validateMealDescription.
export function validateCorrectionNote(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Tell Kiko what's different first.";
  }
  if (trimmed.length > MAX_CORRECTION_NOTE_LENGTH) {
    return `Keep the correction under ${MAX_CORRECTION_NOTE_LENGTH} characters.`;
  }
  return null;
}

export function canSubmitCorrection(value: string): boolean {
  return validateCorrectionNote(value) === null;
}

// Builds the exact request payload sent to POST /v1/recipes/:recipeId/correct.
// Trims the note and the optional dish-name override so the API never
// receives leading/trailing whitespace.
export function buildCorrectionRequest(input: {
  correctionNote: string;
  dishNameOverride?: string | null;
  mode: RecipeMode;
}): CorrectRecipeRequest {
  const trimmedNote = input.correctionNote.trim();
  const trimmedOverride = input.dishNameOverride?.trim();

  return {
    correctionNote: trimmedNote,
    ...(trimmedOverride ? { dishNameOverride: trimmedOverride } : {}),
    mode: input.mode,
  };
}

// Race guard: a correction request is only allowed to apply its result if the
// request id captured when it was fired still matches the latest request id
// at the moment the response arrives. A retake, a second correction, or a
// "Yes, looks good" tap in the meantime bumps the id and makes the older
// in-flight response a no-op instead of clobbering newer state.
export function isCurrentCorrectionRequest(requestId: string, latestRequestId: string | null): boolean {
  return latestRequestId !== null && requestId === latestRequestId;
}
