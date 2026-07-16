import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(currentDir, '../..');
const repoRoot = resolve(apiRoot, '../..');

loadDotenv({ path: resolve(repoRoot, '.env'), quiet: true });
loadDotenv({ path: resolve(apiRoot, '.env'), quiet: true });

const defaultVisionModel = 'openai/gpt-4o-mini';
const defaultTextModel = 'openai/gpt-4o-mini';
const defaultTimeoutMs = 45000;
const defaultMaxOutputTokens = 1024;
const defaultFableModel = 'anthropic/claude-fable-5';

export type AiProviderName = 'openrouter';

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  openRouterApiKey?: string;
  openRouterVisionModel: string;
  openRouterTextModel: string;
  timeoutMs: number;
  maxOutputTokens: number;
  compactRecipeEnabled: boolean;
  // Fable 5 rides the same OpenRouter provider/endpoint — it is a model
  // selection, not a second provider integration.
  fableEnabled: boolean;
  fableModel: string;
  // True only when fableEnabled AND the caller explicitly opted in for this
  // request (see getAiConfig options). When true, openRouterVisionModel /
  // openRouterTextModel above are already swapped to fableModel.
  isFableActive: boolean;
};

export type PublicAiConfig = {
  aiEnabled: boolean;
  provider: AiProviderName;
  hasOpenRouterKey: boolean;
  visionModel: string;
  textModel: string;
  timeoutMs: number;
  maxOutputTokens: number;
  compactRecipeEnabled: boolean;
  fableEnabled: boolean;
};

export type GetAiConfigOptions = {
  // Set by the request-level opt-in (`x-okyo-model: fable` header) after the
  // caller has already validated FABLE_ENABLED and the daily cap. Ignored
  // (falls back to the default OpenRouter model) if fableEnabled is false.
  fableActive?: boolean;
};

export function getAiConfig(options?: GetAiConfigOptions): AiConfig {
  const fableEnabled = process.env.FABLE_ENABLED === 'true';
  const fableModel = process.env.FABLE_MODEL?.trim() || defaultFableModel;
  const isFableActive = fableEnabled && Boolean(options?.fableActive);
  const openRouterVisionModel = isFableActive
    ? fableModel
    : process.env.OPENROUTER_VISION_MODEL?.trim() || defaultVisionModel;
  const openRouterTextModel = isFableActive
    ? fableModel
    : process.env.OPENROUTER_TEXT_MODEL?.trim() || defaultTextModel;

  return {
    enabled: process.env.AI_ENABLED === 'true',
    provider: 'openrouter',
    openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || undefined,
    openRouterVisionModel,
    openRouterTextModel,
    timeoutMs: getTimeoutMs(process.env.AI_TIMEOUT_MS),
    maxOutputTokens: getPositiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, defaultMaxOutputTokens),
    compactRecipeEnabled: process.env.COMPACT_RECIPE_PIPELINE === 'true',
    fableEnabled,
    fableModel,
    isFableActive,
  };
}

export function getPublicAiConfig(): PublicAiConfig {
  const config = getAiConfig();

  return {
    aiEnabled: config.enabled,
    provider: config.provider,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    visionModel: config.openRouterVisionModel,
    textModel: config.openRouterTextModel,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    compactRecipeEnabled: config.compactRecipeEnabled,
    fableEnabled: config.fableEnabled,
  };
}

function getTimeoutMs(value: string | undefined) {
  return getPositiveInteger(value, defaultTimeoutMs);
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}
