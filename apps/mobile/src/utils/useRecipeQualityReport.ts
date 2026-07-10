import { useEffect, useMemo, useState } from 'react';

import type { Recipe, RecipeQualityReport } from '../mocks';
import { checkRecipeQualityWithBackend, type RecipeCheckContext } from '../api/recipeCheckClient';
import { buildRecipeQualityReport } from './recipeQuality';

type BackendReportState = {
  key: string;
  report: RecipeQualityReport;
};

export function useRecipeQualityReport(
  recipe: Recipe | null,
  context?: RecipeCheckContext,
): RecipeQualityReport | null {
  const recipeKey = recipe ? getRecipeQualityKey(recipe, context) : '';
  const localReport = useMemo(() => (recipe ? buildRecipeQualityReport(recipe) : null), [recipe]);
  const [backendReport, setBackendReport] = useState<BackendReportState | null>(null);

  useEffect(() => {
    if (!recipe) {
      setBackendReport(null);
      return;
    }

    let active = true;
    setBackendReport((current) => (current?.key === recipeKey ? current : null));
    checkRecipeQualityWithBackend(recipe, context)
      .then((report) => {
        if (active) {
          setBackendReport({ key: recipeKey, report });
        }
      })
      .catch(() => {
        // Local Recipe Check remains the silent fallback.
      });

    return () => {
      active = false;
    };
  }, [context?.skillLevel, context?.source, context?.timePreference, context?.userGoal, recipe, recipeKey]);

  return backendReport?.key === recipeKey ? backendReport.report : localReport;
}

function getRecipeQualityKey(recipe: Recipe, context?: RecipeCheckContext) {
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  const stepCount = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
  const structuredStepCount = Array.isArray(recipe.structuredSteps) ? recipe.structuredSteps.length : 0;
  return [
    recipe.id,
    recipe.title,
    recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes,
    ingredientCount,
    stepCount,
    structuredStepCount,
    context?.source ?? '',
    context?.skillLevel ?? '',
    context?.userGoal ?? '',
    context?.timePreference ?? '',
  ].join('|');
}
