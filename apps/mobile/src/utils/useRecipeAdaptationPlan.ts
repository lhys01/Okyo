import { useEffect, useMemo, useRef, useState } from 'react';

import type { Recipe } from '../mocks';
import {
  adaptRecipeWithBackend,
  getRecipeAdaptationKey,
  type RecipeAdaptationContext,
  type RecipeAdaptationPlan,
} from '../api/recipeAdaptationClient';
import type { RecipeAdaptationGoal } from './makeItMine';

type BackendPlanState = {
  key: string;
  plan: RecipeAdaptationPlan;
};

export function useRecipeAdaptationPlan(
  recipe: Recipe | null,
  goal: RecipeAdaptationGoal | null,
  context?: RecipeAdaptationContext,
): RecipeAdaptationPlan | null {
  const planKey = useMemo(
    () => (recipe && goal ? getRecipeAdaptationKey(recipe, goal, context) : ''),
    [context?.budgetPreference, context?.skillLevel, context?.source, context?.timePreference, goal, recipe],
  );
  const [backendPlan, setBackendPlan] = useState<BackendPlanState | null>(null);
  const planCacheRef = useRef<Map<string, RecipeAdaptationPlan>>(new Map());
  const attemptedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!recipe || !goal || !planKey) {
      setBackendPlan(null);
      return;
    }

    const cachedPlan = planCacheRef.current.get(planKey);
    if (cachedPlan) {
      setBackendPlan({ key: planKey, plan: cachedPlan });
      return;
    }

    setBackendPlan((current) => (current?.key === planKey ? current : null));
    if (attemptedKeysRef.current.has(planKey)) {
      return;
    }

    let active = true;
    attemptedKeysRef.current.add(planKey);
    adaptRecipeWithBackend(recipe, goal, context)
      .then((plan) => {
        planCacheRef.current.set(planKey, plan);
        if (active) {
          setBackendPlan({ key: planKey, plan });
        }
      })
      .catch(() => {
        // Local Make It Mine remains the silent fallback.
      });

    return () => {
      active = false;
    };
  }, [context, goal, planKey, recipe]);

  return backendPlan?.key === planKey ? backendPlan.plan : null;
}
