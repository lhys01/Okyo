export class RecipeGenerationError extends Error {
  readonly reason: string;

  constructor(reason = 'provider_failed') {
    super('Recipe generation failed.');
    this.name = 'RecipeGenerationError';
    this.reason = sanitizeReason(reason);
  }
}

export class RecipeValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('Recipe validation failed.');
    this.name = 'RecipeValidationError';
    this.issues = [...new Set(issues.map(sanitizeReason).filter(Boolean))].slice(0, 20);
  }
}

export function getRecipeFailureApiError(error: unknown): {
  status: number;
  code: 'recipe_generation_failed' | 'recipe_validation_failed';
  message: string;
} | null {
  if (error instanceof RecipeValidationError) {
    return {
      status: 502,
      code: 'recipe_validation_failed',
      message: 'Okyo could not produce a safe, cookable recipe. Please try again.',
    };
  }
  if (error instanceof RecipeGenerationError) {
    return {
      status: 502,
      code: 'recipe_generation_failed',
      message: 'Okyo could not generate the recipe. Please try again.',
    };
  }
  return null;
}

function sanitizeReason(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_:-]/g, '_').slice(0, 120);
}
