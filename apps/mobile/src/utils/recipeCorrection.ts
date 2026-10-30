import type { CorrectRecipeRequest } from '../api/types';
import type { Recipe, RecipeMode } from '../mocks';
import { getFoxDisplayName } from '../state/foxDisplayName';
import { normalizeOutboundRecipeMode } from './recipeModes';

export const MAX_CORRECTION_NOTE_LENGTH = 300;

// Validates a user's free-text recipe correction. Returns a user-friendly
// error, or null when the trimmed text is safe to submit.
export function validateCorrectionNote(value: string, mascotName?: string | null): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `Tell ${getFoxDisplayName(mascotName)} what to change first.`;
  }
  if (trimmed.length > MAX_CORRECTION_NOTE_LENGTH) {
    return `Keep it under ${MAX_CORRECTION_NOTE_LENGTH} characters.`;
  }
  return null;
}

// Maps a failed correction request to specific, actionable copy. The API client
// replaces every error message with a generic string but preserves `code` and
// `status`, so we recover an intent from those.
export function getCorrectionErrorMessage(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status: unknown }).status) : undefined;
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : undefined;

  if (status === 0 || code === 'network_or_parse_failure') {
    return 'Uh-oh! Check your connection and try again.';
  }
  if (status === 429) {
    return 'That’s a lot of changes at once. Wait a moment, then try again.';
  }
  if (status === 409 || code === 'stale_recipe_revision') {
    return 'This recipe just changed. Reopen it and try again.';
  }
  if (status === 422 || code === 'recipe_correction_failed') {
    return 'Okyo couldn’t work that change in. Try describing it a different way.';
  }
  if (status === 502 || status === 503 || code === 'recipe_correction_unavailable') {
    return 'Okyo’s kitchen is busy right now. Try again in a minute.';
  }
  return 'We couldn’t update the recipe. Try again.';
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
  currentRecipe: Recipe;
  goalContext?: CorrectRecipeRequest['goalContext'];
  scanSessionId?: string | null;
  mode: RecipeMode;
}): CorrectRecipeRequest {
  const trimmedNote = input.correctionNote.trim();
  const trimmedOverride = input.dishNameOverride?.trim();

  return {
    ...(input.correctionRequestId ? { correctionRequestId: input.correctionRequestId } : {}),
    correctionNote: trimmedNote,
    currentRecipe: input.currentRecipe,
    ...(trimmedOverride ? { dishNameOverride: trimmedOverride } : {}),
    expectedSourceRecipeId: input.expectedSourceRecipeId,
    ...(input.canonicalRecipeId ? { canonicalRecipeId: input.canonicalRecipeId } : {}),
    ...(input.scanSessionId ? { scanSessionId: input.scanSessionId } : {}),
    mode: normalizeOutboundRecipeMode(input.mode),
    ...(input.goalContext ? { goalContext: input.goalContext } : {}),
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
