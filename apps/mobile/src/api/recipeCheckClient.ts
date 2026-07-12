import { OKYO_API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedClient';
import type { Recipe, RecipeQualityReport } from '../mocks';

const recipeCheckTimeoutMs = 8000;

export type RecipeCheckSource = 'scan' | 'foodIdea' | 'savedRecipe' | 'manual';

export type RecipeCheckContext = {
  source?: RecipeCheckSource;
  userGoal?: string;
  timePreference?: string;
  skillLevel?: string;
};

type BackendRecipeQualityReport = {
  version?: number;
  status?: 'great' | 'good' | 'needs_attention' | 'risky';
  score?: number;
  confidence?: 'low' | 'medium' | 'high' | number;
  summary?: string;
  userFacingSummary?: string;
  fixesApplied?: string[];
  missingIngredients?: string[];
  missingSteps?: string[];
  vagueInstructions?: string[];
  timeWarnings?: string[];
  equipmentWarnings?: string[];
  timeRealityCheck?: string;
  pantryStaples?: string[];
  budgetIdeas?: string[];
  speedIdeas?: string[];
  healthIdeas?: string[];
  budgetOpportunities?: string[];
  speedOpportunities?: string[];
  healthOpportunities?: string[];
  whatCouldGoWrong?: string[];
  cookabilityStatus?: RecipeQualityReport['cookabilityStatus'];
};

type RecipeCheckPayload =
  | { ok: true; report?: BackendRecipeQualityReport; data?: { report?: BackendRecipeQualityReport } }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

export async function checkRecipeQualityWithBackend(
  recipe: Recipe,
  context?: RecipeCheckContext,
): Promise<RecipeQualityReport> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), recipeCheckTimeoutMs);

  try {
    const response = await authenticatedFetch(`${OKYO_API_BASE_URL}/v1/recipes/check`, {
      body: JSON.stringify({ recipe, context }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });
    const payload = await response.json() as RecipeCheckPayload;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? `Recipe check failed with ${response.status}` : payload.error?.message ?? 'Recipe check failed');
    }
    const report = payload.report ?? payload.data?.report;
    if (!report || report.version !== 1) {
      throw new Error('Recipe check response was missing a versioned report.');
    }
    return mapBackendReport(report);
  } finally {
    clearTimeout(timeout);
  }
}

function mapBackendReport(report: BackendRecipeQualityReport): RecipeQualityReport {
  const timeWarnings = [
    ...getSafeList(report.timeWarnings),
    ...(typeof report.timeRealityCheck === 'string' && report.timeRealityCheck.trim() ? [report.timeRealityCheck.trim()] : []),
  ];

  return {
    score: getSafeScore(report.score),
    confidence: getSafeConfidence(report.confidence),
    cookabilityStatus: getCookabilityStatus(report),
    missingIngredients: getSafeList(report.missingIngredients),
    missingSteps: getSafeList(report.missingSteps),
    vagueInstructions: getSafeList(report.vagueInstructions),
    timeWarnings,
    equipmentWarnings: getSafeList(report.equipmentWarnings),
    pantryStaples: getSafeList(report.pantryStaples),
    budgetOpportunities: getSafeList(report.budgetOpportunities).length > 0
      ? getSafeList(report.budgetOpportunities)
      : getSafeList(report.budgetIdeas),
    speedOpportunities: getSafeList(report.speedOpportunities).length > 0
      ? getSafeList(report.speedOpportunities)
      : getSafeList(report.speedIdeas),
    healthOpportunities: getSafeList(report.healthOpportunities).length > 0
      ? getSafeList(report.healthOpportunities)
      : getSafeList(report.healthIdeas),
    whatCouldGoWrong: getSafeList(report.whatCouldGoWrong),
    fixesApplied: getSafeList(report.fixesApplied),
    userFacingSummary: getSummary(report),
  };
}

function getCookabilityStatus(report: BackendRecipeQualityReport): RecipeQualityReport['cookabilityStatus'] {
  if (
    report.cookabilityStatus === 'cookable' ||
    report.cookabilityStatus === 'needs_quick_fix' ||
    report.cookabilityStatus === 'too_vague_to_trust'
  ) {
    return report.cookabilityStatus;
  }
  if (report.status === 'great' || report.status === 'good') {
    return 'cookable';
  }
  if (report.status === 'risky') {
    return 'too_vague_to_trust';
  }
  return 'needs_quick_fix';
}

function getSafeScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 72;
}

function getSafeConfidence(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (value === 'high') return 0.86;
  if (value === 'low') return 0.62;
  return 0.74;
}

function getSummary(report: BackendRecipeQualityReport) {
  const summary = typeof report.userFacingSummary === 'string' && report.userFacingSummary.trim()
    ? report.userFacingSummary
    : report.summary;
  return typeof summary === 'string' && summary.trim()
    ? summary.trim()
    : 'Okyo checked this recipe and found a few practical things to review before cooking.';
}

function getSafeList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}
