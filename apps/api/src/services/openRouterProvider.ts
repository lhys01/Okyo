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
const recipeModeOutputSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);

export const openRouterVisionOutputSchema = z.object({
  dishName: z.string().optional(),
  scanState: z.string().optional(),
  broadDishCategory: z.string().optional(),
  dishCategory: z.string().optional(),
  cuisine: z.string().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
  isFoodImage: z.union([z.boolean(), z.string()]).optional(),
  foodDetected: z.union([z.boolean(), z.string()]).optional(),
  isRestaurantMeal: z.union([z.boolean(), z.string()]).optional(),
  rejectionReason: z.string().optional(),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  possibleDishNames: z.array(z.string()).optional().default([]),
  visibleComponents: z.object({
    protein: z.string().optional().default(''),
    sauce: z.string().optional().default(''),
    baseStarch: z.string().optional().default(''),
    vegetables: z.string().optional().default(''),
    toppingsGarnish: z.string().optional().default(''),
    cookingMethod: z.string().optional().default(''),
  }).optional().default({}),
  restaurantPriceEstimate: z.union([z.number(), z.string()]).optional(),
  homemadeCostEstimate: z.union([z.number(), z.string()]).optional(),
  confidenceReason: z.string().optional(),
});

const recipeStepSchema = z.object({
  text: z.string().optional().default(''),
  timeEstimate: z.string().optional().default(''),
  visualCue: z.string().optional().default(''),
  whyItMatters: z.string().optional().default(''),
  safetyNote: z.string().optional().default(''),
  flavorBoost: z.string().optional().default(''),
  cookingTerm: z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  }).optional(),
});

const recipeVariantSchema = z.object({
  title: z.string().optional().default(''),
  description: z.string().optional().default(''),
  mainIngredientsSummary: z.string().optional().default(''),
  equipment: z.array(z.string()).optional().default([]),
  bestFor: z.string().optional().default(''),
  ingredients: z.array(z.string()).optional().default([]),
  ingredientGroups: z.array(z.object({
    component: z.string().optional().default(''),
    items: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  steps: z.array(z.union([z.string(), recipeStepSchema])).optional().default([]),
  avoidMistake: z.string().optional().default(''),
  mistakeWarning: z.string().optional().default(''),
  substitutions: z.array(z.string()).optional().default([]),
  storageAndReheating: z.string().optional().default(''),
  storage: z.string().optional().default(''),
  groceryItems: z.array(z.object({
    name: z.string().optional().default(''),
    quantity: z.string().optional().default(''),
    category: z.string().optional().default(''),
    pantryStaple: z.union([z.boolean(), z.string()]).optional(),
    sourceIngredient: z.string().optional().default(''),
    shoppingNote: z.string().optional().default(''),
  })).optional().default([]),
  spicePairings: z.array(z.string()).optional().default([]),
  cookingTerms: z.array(z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  })).optional().default([]),
  pantryNote: z.string().optional().default(''),
  prepTime: z.string().optional().default(''),
  cookTime: z.string().optional().default(''),
  totalTime: z.string().optional().default(''),
  activeTime: z.string().optional().default(''),
  servings: z.union([z.number(), z.string()]).optional(),
  skillLevel: z.string().optional().default(''),
  difficulty: z.string().optional().default(''),
});

export const openRouterRecipeOutputSchema = z.object({
  selectedMode: recipeModeOutputSchema.optional(),
  restaurantCopy: recipeVariantSchema.optional().default({}),
  budget: recipeVariantSchema.optional().default({}),
  healthy: recipeVariantSchema.optional().default({}),
});

export type OpenRouterVisionOutput = z.input<typeof openRouterVisionOutputSchema>;
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
  logOpenRouterDebug('api_openrouter_has_image_payload', {
    contentItemTypes: content.map((part) => part.type),
    hasImagePayload: Boolean(imageUrl),
    imagePayloadLength: imageUrl?.length ?? 0,
  });
  logOpenRouterDebug('openrouter_vision_payload', {
    contentPartTypes: content.map((part) => part.type),
    imagePayloadAttached: Boolean(imageUrl),
    imagePayloadLength: imageUrl?.length ?? 0,
    imageUriKind: getSafeImageUrl(input.image) ? 'provider_visible' : input.image?.uri ? 'local_or_private_uri_not_sent' : 'none',
    model: input.config.openRouterVisionModel,
  });

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
    stage: 'vision',
  });

  const output = openRouterVisionOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterVisionModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }

  logOpenRouterDebug('openrouter_vision_output', {
    broadDishCategory: output.data.broadDishCategory ?? output.data.dishCategory,
    confidence: output.data.confidence,
    dishName: output.data.dishName,
    foodDetected: output.data.foodDetected ?? output.data.isFoodImage,
    scanState: output.data.scanState,
  });

  return output.data;
}

export async function generateRecipeWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode: RecipeMode;
}) {
  const retryReasons: OpenRouterFailureReason[] = ['openrouter_output_truncated', 'openrouter_invalid_json'];

  try {
    const json = await callOpenRouterJson({
      config: input.config,
      messages: [
        {
          role: 'system',
          content: 'You are Okyo, a recipe assistant. Return ONLY valid JSON. No markdown. No reasoning. No explanations.',
        },
        {
          role: 'user',
          content: getRecipePrompt(input.analysis, input.mode),
        },
      ],
      model: input.config.openRouterTextModel,
      // Single-variant recipe fits in ~1500 tokens; cap at 1800 to avoid reasoning-model length cuts
      maxTokens: Math.min(input.config.maxOutputTokens, 1800),
      stage: 'recipe',
    });

    const output = openRouterRecipeOutputSchema.safeParse(json);
    if (!output.success) {
      throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
        openRouterErrorMessage: getSchemaErrorMessage(output.error),
      });
    }
    return output.data;
  } catch (firstError) {
    const shouldRetry = firstError instanceof OpenRouterProviderError &&
      retryReasons.includes(firstError.failure.reason);

    if (!shouldRetry) {
      throw firstError;
    }

    logOpenRouterDebug('openrouter_recipe_retry', {
      firstReason: firstError.failure.reason,
      model: input.config.openRouterTextModel,
      retryPrompt: 'compact',
      retryMaxTokens: 1200,
    });

    const retryJson = await callOpenRouterJson({
      config: input.config,
      messages: [
        {
          role: 'system',
          content: 'Return JSON only. No markdown. No explanations.',
        },
        {
          role: 'user',
          content: getCompactRecipeRetryPrompt(input.analysis, input.mode),
        },
      ],
      model: input.config.openRouterTextModel,
      maxTokens: 1200,
      stage: 'recipe_retry',
    });

    const retryOutput = openRouterRecipeOutputSchema.safeParse(retryJson);
    if (!retryOutput.success) {
      throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
        openRouterErrorMessage: getSchemaErrorMessage(retryOutput.error),
      });
    }
    return retryOutput.data;
  }
}

async function callOpenRouterJson(input: {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  model: string;
  stage?: string;
}) {
  if (!input.config.openRouterApiKey) {
    throw createOpenRouterError(input.config, input.model, 'openrouter_missing_key', {
      openRouterErrorMessage: 'OpenRouter API key is missing.',
    });
  }

  logOpenRouterDebug('openrouter_call_start', {
    model: input.model,
    provider: input.config.provider,
    maxTokens: input.maxTokens,
    stage: input.stage ?? 'unknown',
  });

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

    logOpenRouterDebug('api_openrouter_response_status', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
    if (!response.ok) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_http_error', {
        httpStatus: response.status,
        openRouterErrorMessage: await getOpenRouterErrorMessage(response),
      });
    }

    const responseJson = await parseResponseJson(response, input.config, input.model);
    const responseShape = getOpenRouterResponseShape(responseJson);
    logOpenRouterDebug('openrouter_response_shape', responseShape);
    logOpenRouterDebug('openrouter_call_finish', {
      model: input.model,
      provider: input.config.provider,
      maxTokens: input.maxTokens,
      stage: input.stage ?? 'unknown',
      finishReason: responseShape.finishReason,
    });
    const assistantText = extractAssistantTextFromOpenRouterResponse(responseJson, input.config, input.model);
    logOpenRouterDebug('api_openrouter_response_text_preview', {
      length: assistantText.length,
      preview: assistantText.slice(0, 300),
    });
    return parseJsonContent(
      assistantText,
      input.config,
      input.model,
      responseShape.finishReason,
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
    'Analyze this real-world restaurant or takeout food photo for a testing-only Okyo prototype.',
    'Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
    'Return JSON only with exactly these fields:',
    '{"scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string}',
    'First decide whether real edible food is visible. If any visible food exists, do not hard reject. Ignore table clutter, plates, utensils, hands, cups, napkins, packaging, captions, UI chrome, and restaurant background unless they help identify the food.',
    'Real restaurant photos are allowed to be messy: dim lighting, busy tables, multiple items, dark or charred food, shiny sauce, garnish, angled phone photos, partial plates, takeout containers, screenshots of food posts, hands, cups, napkins, menus, utensils, and cluttered backgrounds are normal.',
    'Ignore plates, utensils, table surfaces, cups, napkins, hands, menus, packaging, captions, UI chrome, and background unless they help identify the food. Focus on edible food.',
    'If multiple dishes are visible, choose the largest or most central edible item. Identify the central plate or central food pile; do not reject because side plates or clutter are present.',
    'If the exact dish is uncertain, identify a broad useful food category and give a lower-confidence best guess. Use broad category names instead of failure.',
    'Do not reject just because food is dark, charred, saucy, cluttered, garnished, partially visible, cropped, or photographed at an angle. Return lower confidence instead.',
    'Examples: messy grilled meat platter -> Grilled Meat Plate or Mixed Restaurant Plate; saucy bowl -> Saucy Rice Bowl or Noodle Bowl; cluttered table with central plate -> identify the central dish; partial sandwich or burger -> Loaded Sandwich or Loaded Burger; unclear pasta/noodles -> Pasta Bowl or Noodle Bowl; charred or dark food -> Grilled or Charred Plate, not rejection.',
    'Set broadDishCategory to one of: pizza, pasta/noodles, rice bowl, burger/sandwich, tacos/wrap, grilled meat, fried food, seafood, salad, soup/stew, dessert, breakfast item, mixed platter, unknown food dish.',
    'Identify cuisine only when there are strong visual clues. Otherwise use "Restaurant-style".',
    'Use visibleComponents to describe visible protein, sauce, base/starch, vegetables, toppings/garnish, and cooking method. Empty string is okay when not visible.',
    'Return a best-guess dishName even if the exact restaurant dish name is unknown. Use broad useful names like "Mixed Restaurant Plate", "Grilled Meat Plate", "Charred Grill Plate", "Saucy Rice Bowl", "Noodle Bowl", "Pasta Bowl", "Loaded Sandwich", "Loaded Burger", "Pizza", "Stir-Fry Plate", "Restaurant-Style Food Plate", "Creamy Tomato Pasta", "Spicy Noodle Bowl", or "Grilled Chicken Rice Bowl". Do not invent exact menu names.',
    'When uncertain, include 2-4 possibleDishNames using broad safe guesses such as Mixed Restaurant Plate, Grilled Meat Plate, Saucy Rice Bowl, Noodle Bowl, Pasta Bowl, Loaded Sandwich, Pizza, or Stir-Fry Plate.',
    'scanState rules: clear_food means food and dish are clear; food_present_uncertain_dish means food is clear but exact dish/cuisine is uncertain; partial_food means food is visible but partial/low-quality/ambiguous; not_food means clearly no food; too_unclear means too blurry/dark/blocked to identify food safely.',
    'Confidence score rules: 80-95 clear dish, 60-79 food clear but exact dish uncertain, 40-59 food visible but ambiguous or partial, below 40 retry/clarification needed. If food is visible and confidence is 40-79, keep isFoodImage true and use scanState food_present_uncertain_dish or partial_food.',
    'Only reject when food is clearly absent or the image is too unclear to identify any visible food. Do not reject just because the exact dish name is uncertain.',
    'Only use not_food when no food is visible. If food is visible, not_food is wrong.',
    'Only use too_unclear when food cannot reasonably be identified at all because the image is truly blurry, blocked, or unreadable. If food is visible but the exact dish is unclear, use partial_food or food_present_uncertain_dish instead.',
    'If the image is not food, set scanState not_food, isFoodImage false, isRestaurantMeal false, and rejectionReason to a short user-friendly reason.',
    'If the image is too blurry/dark/blocked to know whether food is visible, set scanState too_unclear, isFoodImage false, confidence below 40, and rejectionReason to ask for a clearer food photo.',
    'If food is visible but uncertain, do NOT say "could not recognize" or "failed"; provide a broad best guess with lower confidence instead of failure.',
    'confidence may be 0-100. Use lower confidence when the image is unclear, partial, or screenshot-like.',
    'Do not invent exact restaurant menu prices from a photo. Set restaurantPriceEstimate to 0 unless a menu, receipt, visible price, or user-provided price is available in metadata.',
    'homemadeCostEstimate may be a cautious grocery-cost estimate for making a similar recipe at home.',
    'Use cautious estimates. Never present food identification, cost, or ingredients as exact.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    'If no actual image is available, return a cautious low-confidence result based only on metadata.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getModeKey(mode: RecipeMode) {
  return mode === 'Budget' ? 'budget' : mode === 'Healthy' ? 'healthy' : 'restaurantCopy';
}

function getRecipePrompt(analysis: FoodImageAnalysis, mode: RecipeMode) {
  const modeKey = getModeKey(mode);
  const isUncertainFood = analysis.scanState === 'food_present_uncertain_dish' || analysis.scanState === 'partial_food';

  return [
    `Create a compact inspired-by homemade recipe JSON for the ${mode} mode only.`,
    'Return ONLY valid minified JSON. No markdown, no prose, no reasoning, no extra text.',
    `Return exactly: {"selectedMode":"${mode}","${modeKey}":{...recipe fields...}}`,
    `Include ONLY "selectedMode" and "${modeKey}". Do NOT include other mode keys.`,
    'Recipe fields: title, description, mainIngredientsSummary, equipment, bestFor, ingredients, steps, avoidMistake, substitutions, storageAndReheating, pantryNote, prepTime, cookTime, totalTime, servings, skillLevel, groceryItems, spicePairings.',
    'Strict limits: ingredients max 8, steps 5-7 (plain strings), substitutions max 2, equipment max 4, groceryItems max 8, spicePairings max 2.',
    'Text limits: description 1 sentence. Each step max 20 words. avoidMistake 1 sentence. storageAndReheating 1 sentence.',
    'Steps are plain strings starting with action verbs. Include time and visual cue. Use 160°F/71°C for ground meat, 165°F/74°C for chicken.',
    'Never use the word copycat. Use inspired-by or restaurant-style.',
    'Grocery categories: Produce, Protein, Bakery / Bread, Dairy, Sauces / Condiments, Pantry, Spices, Noodles / Grains, Garnish.',
    'No nutrition claims. No unsafe cooking advice. Never call it official.',
    isUncertainFood
      ? 'Scan is uncertain — make a flexible best-guess inspired-by version based only on visible components.'
      : 'Scan is clear — keep wording honest and inspired-by.',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      scanState: analysis.scanState,
      visibleIngredients: analysis.visibleIngredients.slice(0, 5),
      likelyIngredients: analysis.likelyIngredients.slice(0, 5),
      visibleComponents: analysis.visibleComponents,
    })}`,
  ].join('\n');
}

function getCompactRecipeRetryPrompt(analysis: FoodImageAnalysis, mode: RecipeMode) {
  const modeKey = getModeKey(mode);

  return [
    'JSON only. No markdown. No explanations.',
    `Return: {"selectedMode":"${mode}","${modeKey}":{"title":"...","description":"...","ingredients":["...x6"],"steps":["...x5"],"prepTime":"...","cookTime":"...","totalTime":"...","servings":2,"skillLevel":"Easy","avoidMistake":"...","substitutions":["...x2"],"storageAndReheating":"...","pantryNote":"...","groceryItems":[],"spicePairings":[]}}`,
    'ingredients: max 6 items. steps: exactly 5 plain strings, each under 18 words. All other text brief.',
    `Dish: ${analysis.dishName}. Mode: ${mode}. Visible: ${analysis.visibleIngredients.slice(0, 4).join(', ')}.`,
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
  logOpenRouterDebug('openrouter_assistant_content_shape', shape);

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

function logOpenRouterDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(event, details);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
