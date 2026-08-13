import {
  analyzeScan,
  createMockScan,
  generateRecipeFromAnalysis,
} from '../../api/client';
import type {
  AnalyzeScanRequest,
  AnalyzeScanResult,
  CreateScanRequest,
  CreateScanResult,
  GenerateRecipeFromAnalysisRequest,
  GenerateRecipeFromAnalysisResult,
} from '../../api/types';

type AnalysisDependencies = {
  analyze: (request: AnalyzeScanRequest, signal?: AbortSignal) => Promise<AnalyzeScanResult>;
};

type RecipeDependencies = {
  fallback: (request: CreateScanRequest) => Promise<CreateScanResult>;
  generate: (
    analysisId: string,
    request: GenerateRecipeFromAnalysisRequest,
    signal?: AbortSignal,
  ) => Promise<GenerateRecipeFromAnalysisResult>;
};

export async function runOnboardingAnalysis(
  request: AnalyzeScanRequest,
  signal: AbortSignal | undefined,
  dependencies: AnalysisDependencies = { analyze: analyzeScan },
) {
  return dependencies.analyze(request, signal);
}

export async function runOnboardingRecipeGeneration(
  input: {
    analysisId: string;
    fallbackRequest: CreateScanRequest;
    request: GenerateRecipeFromAnalysisRequest;
  },
  signal: AbortSignal | undefined,
  dependencies: RecipeDependencies = {
    fallback: createMockScan,
    generate: generateRecipeFromAnalysis,
  },
) {
  try {
    return await dependencies.generate(input.analysisId, input.request, signal);
  } catch (error) {
    if (isMissingAnalysisError(error)) {
      return dependencies.fallback(input.fallbackRequest);
    }
    throw error;
  }
}

function isMissingAnalysisError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.status === 404 || candidate.status === 410 ||
    candidate.code === 'analysis_not_found' || candidate.code === 'analysis_expired';
}
