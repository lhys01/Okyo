import type { CorrectRecipeRequest } from '../api/types';
import type { RecipeMode } from '../mocks';
import { normalizeOutboundRecipeMode } from './recipeModes';

export const MAX_CORRECTION_NOTE_LENGTH = 300;

// Validates a user's free-text recipe correction. Returns a user-friendly
// error, or null when the trimmed text is safe to submit.
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

export function getRecipeCorrectionSourceId(recipe: {
  id: string;
  sourceRecipeId?: unknown;
}): string {
  return typeof recipe.sourceRecipeId === 'string' && recipe.sourceRecipeId.trim()
    ? recipe.sourceRecipeId
    : recipe.id;
}

// Builds the exact request payload sent to POST /v1/recipes/:recipeId/correct.
// Trims the note and the optional dish-name override so the API never
// receives leading/trailing whitespace.
export function buildCorrectionRequest(input: {
  correctionRequestId?: string;
  correctionNote: string;
  dishNameOverride?: string | null;
  expectedSourceRecipeId: string;
  canonicalRecipeId?: string;
  scanSessionId?: string | null;
  mode: RecipeMode;
}): CorrectRecipeRequest {
  const trimmedNote = input.correctionNote.trim();
  const trimmedOverride = input.dishNameOverride?.trim();

  return {
    ...(input.correctionRequestId ? { correctionRequestId: input.correctionRequestId } : {}),
    correctionNote: trimmedNote,
    ...(trimmedOverride ? { dishNameOverride: trimmedOverride } : {}),
    expectedSourceRecipeId: input.expectedSourceRecipeId,
    ...(input.canonicalRecipeId ? { canonicalRecipeId: input.canonicalRecipeId } : {}),
    ...(input.scanSessionId ? { scanSessionId: input.scanSessionId } : {}),
    mode: normalizeOutboundRecipeMode(input.mode),
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
