import { z } from 'zod';

import type { AiConfig } from '../config/aiConfig.js';
import type { RecipeMode, ScanImageMetadata } from '../types.js';
import type { FoodImageAnalysis } from './aiService.js';

const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
export type OpenRouterFailureReason =
  | 'openrouter_missing_key'
  | 'openrouter_http_error'
  | 'openrouter_timeout'
  | 'openrouter_empty_content'
  | 'openrouter_output_truncated'
  | 'openrouter_invalid_json'
  | 'openrouter_invalid_schema'
  | 'openrouter_network_error'
  | 'openrouter_unknown_error';

export type OpenRouterFailureInfo = {
  reason: OpenRouterFailureReason;
  aiEnabled: boolean;
  hasOpenRouterKey: boolean;
  model: string;
  provider: string;
  timeoutMs: number;
  maxOutputTokens: number;
  httpStatus?: number;
  openRouterErrorMessage?: string;
};

export class OpenRouterProviderError extends Error {
  readonly failure: OpenRouterFailureInfo;

  constructor(failure: OpenRouterFailureInfo) {
    super(failure.openRouterErrorMessage ?? failure.reason);
    this.name = 'OpenRouterProviderError';
    this.failure = failure;
  }
}

type SafeRecord = Record<string, unknown>;

export const openRouterVisionOutputSchema = z.object({
  dishName: z.string().optional(),
  cuisine: z.string().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
  isFoodImage: z.union([z.boolean(), z.string()]).optional(),
  isRestaurantMeal: z.union([z.boolean(), z.string()]).optional(),
  rejectionReason: z.string().optional(),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  restaurantPriceEstimate: z.union([z.number(), z.string()]).optional(),
  homemadeCostEstimate: z.union([z.number(), z.string()]).optional(),
  confidenceReason: z.string().optional(),
});

const recipeVariantSchema = z.object({
  title: z.string().optional().default(''),
  description: z.string().optional().default(''),
  ingredients: z.array(z.string()).optional().default([]),
  steps: z.array(z.string()).optional().default([]),
  substitutions: z.array(z.string()).optional().default([]),
  pantryNote: z.string().optional().default(''),
  prepTime: z.string().optional().default(''),
  cookTime: z.string().optional().default(''),
  difficulty: z.string().optional().default(''),
});

export const openRouterRecipeOutputSchema = z.object({
  restaurantCopy: recipeVariantSchema.optional().default({}),
  budget: recipeVariantSchema.optional().default({}),
  healthy: recipeVariantSchema.optional().default({}),
});

export type OpenRouterVisionOutput = z.infer<typeof openRouterVisionOutputSchema>;
export type OpenRouterRecipeOutput = z.infer<typeof openRouterRecipeOutputSchema>;
export type OpenRouterRecipeVariant = z.infer<typeof recipeVariantSchema>;

type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string | OpenRouterContentPart[];
};

export async function analyzeFoodImageWithOpenRouter(input: {
  config: AiConfig;
  image?: ScanImageMetadata;
  mode: RecipeMode;
}) {
  const content: OpenRouterContentPart[] = [
    {
      type: 'text',
      text: getVisionPrompt(input.image, input.mode),
    },
  ];
  const imageUrl = getSafeImageUrl(input.image);
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } });
  }

  const json = await callOpenRouterJson({
    config: input.config,
    messages: [
      {
        role: 'system',
        content: 'You are Okyo, a cautious food analysis assistant. Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
      },
      {
        role: 'user',
        content,
      },
    ],
    model: input.config.openRouterVisionModel,
    maxTokens: Math.min(input.config.maxOutputTokens, 1800),
  });

  const output = openRouterVisionOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterVisionModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }

  return output.data;
}

export async function generateRecipeWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode: RecipeMode;
}) {
  const json = await callOpenRouterJson({
    config: input.config,
    messages: [
      {
        role: 'system',
        content: 'You are Okyo, a cautious copycat-style recipe assistant. Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
      },
      {
        role: 'user',
        content: getRecipePrompt(input.analysis, input.mode),
      },
    ],
    model: input.config.openRouterTextModel,
    maxTokens: input.config.maxOutputTokens,
  });

  const output = openRouterRecipeOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }

  return output.data;
}

async function callOpenRouterJson(input: {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  model: string;
}) {
  if (!input.config.openRouterApiKey) {
    throw createOpenRouterError(input.config, input.model, 'openrouter_missing_key', {
      openRouterErrorMessage: 'OpenRouter API key is missing.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const response = await fetch(openRouterEndpoint, {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: input.messages,
        model: input.model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${input.config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://okyo.local',
        'X-Title': 'Okyo',
      },
      method: 'POST',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_http_error', {
        httpStatus: response.status,
        openRouterErrorMessage: await getOpenRouterErrorMessage(response),
      });
    }

    const responseJson = await parseResponseJson(response, input.config, input.model);
    const assistantText = extractAssistantTextFromOpenRouterResponse(responseJson, input.config, input.model);
    return parseJsonContent(
      assistantText,
      input.config,
      input.model,
      getOpenRouterResponseShape(responseJson).finishReason,
    );
  } catch (error) {
    if (error instanceof OpenRouterProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_timeout', {
        openRouterErrorMessage: 'OpenRouter request timed out.',
      });
    }

    if (error instanceof TypeError) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_network_error', {
        openRouterErrorMessage: getSafeErrorMessage(error),
      });
    }

    throw createOpenRouterError(input.config, input.model, 'openrouter_unknown_error', {
      openRouterErrorMessage: getSafeErrorMessage(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getVisionPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  return [
    'Analyze this restaurant meal for a testing-only Okyo prototype.',
    'Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
    'Return JSON only with exactly these fields:',
    '{"dishName": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string}',
    'If the image is not food, set isFoodImage false, isRestaurantMeal false, confidence low, and rejectionReason to a short reason.',
    'If the image might be food but you are unsure, keep isFoodImage true, use low confidence, and explain uncertainty.',
    'If the image is food but not clearly restaurant-style, keep isRestaurantMeal true when it could reasonably be a meal.',
    'Only set isRestaurantMeal false when you are confident the image is not a meal at all.',
    'dishName should be specific but cautious, like "Possible Spicy Rigatoni" if unsure; do not use generic names like "food" or "meal".',
    'confidence may be 0-100. Use lower confidence when the image is unclear.',
    'Price and homemade cost must be realistic US dollar estimates, not exact; homemadeCostEstimate should usually be lower than restaurantPriceEstimate.',
    'Use cautious estimates. Never present food identification, cost, or ingredients as exact.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    'If no actual image is available, return a cautious low-confidence result based only on metadata.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getRecipePrompt(analysis: FoodImageAnalysis, mode: RecipeMode) {
  return [
    'Create compact copycat-style homemade recipe options for Okyo based on this uncertain food analysis.',
    'Return compact valid JSON only. Keep the response short enough to fit. No markdown. No explanation. No reasoning. No extra text.',
    'Return exactly these top-level fields: restaurantCopy, budget, healthy.',
    'Each mode must contain: title, description, ingredients, steps, substitutions, pantryNote, prepTime, cookTime, difficulty.',
    'Hard limits for each mode: description one sentence, max 6 ingredients, max 5 short steps, max 3 substitutions, pantryNote under 12 words.',
    'Titles and descriptions must say "copycat-style" or "inspired-by"; never claim the recipe is official.',
    'Make Restaurant Copy closest to the restaurant-style version, Budget lower-cost, and Healthy lighter without exact nutrition claims.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    `Primary requested mode: ${mode}.`,
    `Food analysis summary: ${JSON.stringify({
      confidence: analysis.confidence,
      cuisine: analysis.cuisine,
      dishName: analysis.dishName,
      likelyIngredients: analysis.likelyIngredients.slice(0, 6),
      visibleIngredients: analysis.visibleIngredients.slice(0, 6),
    })}`,
  ].join('\n');
}

async function parseResponseJson(response: Response, config: AiConfig, model: string) {
  try {
    return await response.json() as unknown;
  } catch {
    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      httpStatus: response.status,
      openRouterErrorMessage: 'OpenRouter response body was not valid JSON.',
    });
  }
}

function parseJsonContent(
  content: string,
  config: AiConfig,
  model: string,
  finishReason: string | null | undefined,
) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? findFirstJsonObject(trimmed) ?? trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    if (finishReason === 'length') {
      throw createOpenRouterError(config, model, 'openrouter_output_truncated', {
        openRouterErrorMessage: 'OpenRouter response was truncated before valid JSON completed.',
      });
    }

    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      openRouterErrorMessage: 'OpenRouter message content did not contain valid JSON.',
    });
  }
}

function getSafeImageUrl(image: ScanImageMetadata | undefined) {
  if (!image || image.placeholder) {
    return undefined;
  }

  if (image.dataUrl?.startsWith('data:image/')) {
    return image.dataUrl;
  }

  if (image.uri?.startsWith('https://') || image.uri?.startsWith('http://')) {
    return image.uri;
  }

  return undefined;
}

function getSafeImageMetadata(image: ScanImageMetadata | undefined) {
  if (!image) {
    return null;
  }

  return {
    fileName: image.fileName,
    dataUrlSizeBytes: image.dataUrlSizeBytes,
    height: image.height,
    hasDataUrl: Boolean(image.dataUrl),
    mimeType: image.mimeType,
    placeholder: image.placeholder,
    source: image.source,
    conversionError: image.conversionError,
    uriKind: getSafeImageUrl(image) ? 'sendable' : image.uri ? 'local_or_private_uri_not_sent' : 'none',
    width: image.width,
  };
}

function extractAssistantTextFromOpenRouterResponse(response: unknown, config: AiConfig, model: string) {
  const shape = getOpenRouterResponseShape(response);
  console.log('openrouter_response_shape', shape);

  const firstChoice = getFirstChoice(response);
  const message = getRecord(firstChoice?.message);
  const content = message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content.map(extractTextBlock).filter(Boolean).join('\n').trim();
    if (text) {
      return text;
    }
  }

  const reasoning = message?.reasoning;
  if (typeof reasoning === 'string' && reasoning.trim()) {
    return reasoning;
  }

  const reasoningDetails = extractTextFromReasoningDetails(message?.reasoning_details);
  if (reasoningDetails) {
    return reasoningDetails;
  }

  const fallbackText = getFirstString(
    message?.text,
    message?.output_text,
    message?.content_text,
    firstChoice?.text,
    firstChoice?.output_text,
  );
  if (fallbackText) {
    return fallbackText;
  }

  throw createOpenRouterError(config, model, 'openrouter_empty_content', {
    openRouterErrorMessage: 'OpenRouter response did not include usable assistant text.',
  });
}

function getOpenRouterResponseShape(response: unknown) {
  const firstChoice = getFirstChoice(response);
  const message = getRecord(firstChoice?.message);
  const content = message?.content;

  return {
    hasChoices: Array.isArray(getRecord(response)?.choices),
    choiceCount: getChoiceCount(response),
    hasMessage: Boolean(message),
    contentType: getValueType(content),
    contentIsNull: content === null,
    hasReasoning: typeof message?.reasoning === 'string' && message.reasoning.length > 0,
    hasReasoningDetails: Boolean(message?.reasoning_details),
    finishReason: getFinishReason(firstChoice),
  };
}

function getFirstChoice(response: unknown): SafeRecord | undefined {
  const choices = getRecord(response)?.choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }

  return getRecord(choices[0]);
}

function getChoiceCount(response: unknown) {
  const choices = getRecord(response)?.choices;
  return Array.isArray(choices) ? choices.length : 0;
}

function extractTextBlock(value: unknown) {
  const block = getRecord(value);
  if (!block) {
    return undefined;
  }

  return getFirstString(block.text, block.content, block.output_text);
}

function extractTextFromReasoningDetails(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = value.map((item) => {
    if (typeof item === 'string') {
      return item;
    }

    const block = getRecord(item);
    return block ? getFirstString(block.text, block.content, block.summary, block.output_text) : undefined;
  }).filter(Boolean).join('\n').trim();

  return text || undefined;
}

function getFirstString(...values: unknown[]) {
  const text = values.find((value) => typeof value === 'string' && value.trim());
  return typeof text === 'string' ? text : undefined;
}

function getRecord(value: unknown): SafeRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SafeRecord : undefined;
}

function getValueType(value: unknown) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function getFinishReason(choice: SafeRecord | undefined) {
  const finishReason = choice?.finish_reason ?? choice?.finishReason;
  return typeof finishReason === 'string' || finishReason === null ? finishReason : undefined;
}

function createOpenRouterError(
  config: AiConfig,
  model: string,
  reason: OpenRouterFailureReason,
  details: Pick<OpenRouterFailureInfo, 'httpStatus' | 'openRouterErrorMessage'> = {},
) {
  return new OpenRouterProviderError({
    reason,
    aiEnabled: config.enabled,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    model,
    provider: config.provider,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    httpStatus: details.httpStatus,
    openRouterErrorMessage: sanitizeProviderMessage(details.openRouterErrorMessage),
  });
}

async function getOpenRouterErrorMessage(response: Response) {
  const body = await response.text();
  const trimmed = body.trim();
  if (!trimmed) {
    return `OpenRouter returned HTTP ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const message = getNestedErrorMessage(parsed);
    return message ?? `OpenRouter returned HTTP ${response.status}.`;
  } catch {
    return trimmed;
  }
}

function getNestedErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directMessage = record.message;
  if (typeof directMessage === 'string') {
    return directMessage;
  }

  const error = record.error;
  if (error && typeof error === 'object') {
    return getNestedErrorMessage(error);
  }

  return undefined;
}

function findFirstJsonObject(value: string) {
  let depth = 0;
  let startIndex = -1;
  let isInString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        isInString = false;
      }
      continue;
    }

    if (char === '"') {
      isInString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return undefined;
}

function getSchemaErrorMessage(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

function sanitizeProviderMessage(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, 'data:image/[redacted];base64,[redacted]').slice(0, 600);
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return sanitizeProviderMessage(error.message);
  }

  return 'Unknown OpenRouter error.';
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
