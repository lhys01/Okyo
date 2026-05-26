import { z } from 'zod';

import type { AiConfig } from '../config/aiConfig.js';
import type { RecipeMode, ScanImageMetadata } from '../types.js';
import type { FoodImageAnalysis } from './aiService.js';

const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';

const chatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }),
  })).min(1),
});

export const openRouterVisionOutputSchema = z.object({
  dishName: z.string().min(1),
  cuisine: z.string().min(1),
  confidence: z.number().min(0).max(1),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  restaurantPriceEstimate: z.number().nonnegative(),
  homemadeCostEstimate: z.number().nonnegative(),
  confidenceReason: z.string().min(1),
});

const recipeVariantSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  ingredients: z.array(z.string()).min(1),
  steps: z.array(z.string()).min(1),
  substitutions: z.array(z.string()).default([]),
  pantryNote: z.string().min(1),
  prepTime: z.string().min(1),
  cookTime: z.string().min(1),
  difficulty: z.string().min(1),
});

export const openRouterRecipeOutputSchema = z.object({
  restaurantCopy: recipeVariantSchema,
  budget: recipeVariantSchema,
  healthy: recipeVariantSchema,
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
        content: 'You are Okyo, a cautious food analysis assistant. Return JSON only.',
      },
      {
        role: 'user',
        content,
      },
    ],
    model: input.config.openRouterVisionModel,
  });

  return openRouterVisionOutputSchema.parse(json);
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
        content: 'You are Okyo, a cautious copycat-style recipe assistant. Return JSON only.',
      },
      {
        role: 'user',
        content: getRecipePrompt(input.analysis, input.mode),
      },
    ],
    model: input.config.openRouterTextModel,
  });

  return openRouterRecipeOutputSchema.parse(json);
}

async function callOpenRouterJson(input: {
  config: AiConfig;
  messages: OpenRouterMessage[];
  model: string;
}) {
  if (!input.config.openRouterApiKey) {
    throw new Error('OpenRouter API key is missing.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const response = await fetch(openRouterEndpoint, {
      body: JSON.stringify({
        max_tokens: 1800,
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
      throw new Error(`OpenRouter request failed with ${response.status}.`);
    }

    const payload = chatResponseSchema.parse(await response.json());
    return parseJsonContent(payload.choices[0].message.content);
  } finally {
    clearTimeout(timeout);
  }
}

function getVisionPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  return [
    'Analyze this restaurant meal for a testing-only Okyo prototype.',
    'Return JSON only with exactly these fields:',
    '{"dishName": string, "cuisine": string, "confidence": number, "visibleIngredients": string[], "likelyIngredients": string[], "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string}',
    'Use cautious estimates. Never present food identification, cost, or ingredients as exact.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    'If no actual image is available, return a cautious low-confidence result based only on metadata.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getRecipePrompt(analysis: FoodImageAnalysis, mode: RecipeMode) {
  return [
    'Create copycat-style homemade recipe options for Okyo based on this uncertain food analysis.',
    'Return JSON only with exactly these top-level fields: restaurantCopy, budget, healthy.',
    'Each field must contain: title, description, ingredients, steps, substitutions, pantryNote, prepTime, cookTime, difficulty.',
    'Never claim the recipe is official. Use "copycat-style" or "inspired-by."',
    'Include cautious language when confidence is low. Do not give exact nutrition claims.',
    'Do not give unsafe cooking advice; include normal safe cooking temperatures if meat is mentioned.',
    `Primary requested mode: ${mode}.`,
    `Food analysis: ${JSON.stringify({
      confidence: analysis.confidence,
      confidenceReason: analysis.confidenceReason,
      cuisine: analysis.cuisine,
      dishName: analysis.dishName,
      likelyIngredients: analysis.likelyIngredients,
      visibleIngredients: analysis.visibleIngredients,
    })}`,
  ].join('\n');
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch?.[1]?.trim() ?? trimmed;
  return JSON.parse(jsonText) as unknown;
}

function getSafeImageUrl(image: ScanImageMetadata | undefined) {
  if (!image?.uri || image.placeholder) {
    return undefined;
  }

  if (image.uri.startsWith('https://') || image.uri.startsWith('http://') || image.uri.startsWith('data:image/')) {
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
    height: image.height,
    mimeType: image.mimeType,
    placeholder: image.placeholder,
    source: image.source,
    uriKind: getSafeImageUrl(image) ? 'sendable' : image.uri ? 'local_or_private_uri_not_sent' : 'none',
    width: image.width,
  };
}
