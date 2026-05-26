import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import {
  awardXp,
  createChallenge,
  getLibrary,
  getRecipe,
  getRestaurantPack,
  getRestaurantPacks,
  getSavingsSummary,
  getScan,
  getWeeklyRankings,
  getXpDefinitions,
  saveRecipe,
} from './store.js';
import { createMockAiScan } from './services/aiService.js';
import type { ApiFailure, ApiResponse } from './types.js';

const port = Number(process.env.PORT ?? 8081);
const app = express();

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const scanSourceSchema = z.enum(['camera', 'photos', 'mock']);
const scanImageMetadataSchema = z.object({
  uri: z.string().min(1).max(2000).optional(),
  fileName: z.string().min(1).max(255).optional(),
  mimeType: z.string().min(1).max(120).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  source: scanSourceSchema.optional(),
  placeholder: z.boolean().optional(),
}).strict();
const scanRequestSchema = z.object({
  source: scanSourceSchema.optional().default('mock'),
  mode: recipeModeSchema.optional().default('Restaurant Copy'),
  image: scanImageMetadataSchema.optional(),
});
const challengeRequestSchema = z.object({
  recipeId: z.string().min(1),
  mode: recipeModeSchema.optional().default('Restaurant Copy'),
  rating: z.enum(['Nailed it', 'Pretty close', 'Needs work', 'Not close']),
  matchScore: z.number().min(0).max(10).optional(),
});
const xpEventRequestSchema = z.object({
  eventType: z.string().min(1),
  sourceId: z.string().min(1).optional(),
});

app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  sendOk(response, {
    status: 'ok',
    service: 'okyo-api',
    mode: 'mock',
    realAiEnabled: false,
    databaseEnabled: false,
    timestamp: new Date().toISOString(),
  });
});

app.post('/v1/scans', (request, response) => {
  const body = parseRequest(scanRequestSchema, request.body);
  const result = createMockAiScan({
    image: body.image,
    mode: body.mode,
    source: body.source,
  });

  sendOk(response.status(201), {
    ...result,
    image: body.image,
    source: body.source,
  });
});

app.get('/v1/scans/:scanId', (request, response) => {
  const scan = getScan(request.params.scanId);

  if (!scan) {
    sendNotFound(response, 'scan_not_found', 'Scan was not found in mock data.');
    return;
  }

  sendOk(response, { scan });
});

app.get('/v1/recipes/:recipeId', (request, response) => {
  const recipe = getRecipe(request.params.recipeId);

  if (!recipe) {
    sendNotFound(response, 'recipe_not_found', 'Recipe was not found in mock data.');
    return;
  }

  sendOk(response, { recipe });
});

app.post('/v1/recipes/:recipeId/save', (request, response) => {
  const recipe = getRecipe(request.params.recipeId);

  if (!recipe) {
    sendNotFound(response, 'recipe_not_found', 'Recipe was not found in mock data.');
    return;
  }

  const library = saveRecipe(recipe);
  sendOk(response, { saved: true, recipe, library });
});

app.get('/v1/library', (_request, response) => {
  sendOk(response, { recipes: getLibrary() });
});

app.get('/v1/savings', (_request, response) => {
  sendOk(response, getSavingsSummary());
});

app.post('/v1/challenges', (request, response) => {
  const body = parseRequest(challengeRequestSchema, request.body);
  const challenge = createChallenge(body);

  if (!challenge) {
    sendNotFound(response, 'recipe_not_found', 'Challenge recipe was not found in mock data.');
    return;
  }

  sendOk(response.status(201), { challenge });
});

app.post('/v1/xp-events', (request, response) => {
  const body = parseRequest(xpEventRequestSchema, request.body);
  const event = awardXp(body.eventType, body.sourceId);

  sendOk(response.status(201), {
    event,
    definitions: getXpDefinitions(),
  });
});

app.get('/v1/rankings/weekly', (_request, response) => {
  sendOk(response, getWeeklyRankings());
});

app.get('/v1/restaurant-packs', (_request, response) => {
  sendOk(response, { packs: getRestaurantPacks() });
});

app.get('/v1/restaurant-packs/:packId', (request, response) => {
  const pack = getRestaurantPack(request.params.packId);

  if (!pack) {
    sendNotFound(response, 'pack_not_found', 'Restaurant pack was not found in mock data.');
    return;
  }

  sendOk(response, { pack });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    sendError(response.status(400), 'validation_error', 'Request validation failed.', error.flatten());
    return;
  }

  sendError(response.status(500), 'internal_error', 'Unexpected API error.');
});

app.listen(port, () => {
  console.log(`Okyo API listening on http://localhost:${port}`);
});

function parseRequest<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  return schema.parse(value);
}

function sendOk<T>(response: Response, data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  response.json(payload);
}

function sendNotFound(response: Response, code: string, message: string) {
  sendError(response.status(404), code, message);
}

function sendError(response: Response, code: string, message: string, details?: unknown) {
  const payload: ApiFailure = {
    ok: false,
    error: { code, message, details },
  };
  response.json(payload);
}
