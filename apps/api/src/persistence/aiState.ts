import { randomUUID } from 'node:crypto';
import * as local from '../store.js';
import { getAiConfig } from '../config/aiConfig.js';
import type { Recipe } from '../types.js';
import { database } from './database.js';
import { getRuntime, ownerScope, persistentPayload, putRuntime } from './runtimeStore.js';
export { StaleRecipeRevisionError } from '../store.js';
const durable = () => process.env.NODE_ENV === 'production';
const recipeTtl = 24 * 60 * 60 * 1000;
type Entry = { recipe: Recipe; rootRevisionId: string; parentRevisionId?: string; supersededBy?: string };

export async function storeGeneratedRecipe(recipe: Recipe) {
  if (!durable()) return local.storeGeneratedRecipe(recipe);
  // Never overwrite revision metadata on an existing ID.
  await database().query(`INSERT INTO okyo_private.okyo_runtime(kind,id,owner,payload,expires_at)
    VALUES('recipe',$1,$2,$3,now()+interval '1 day') ON CONFLICT DO NOTHING`,
  [recipe.id, ownerScope(), JSON.stringify(persistentPayload({ recipe, rootRevisionId: recipe.id }))]);
}
export async function getGeneratedRecipe(id: string) {
  return durable() ? (await getRuntime<Entry>('recipe', id))?.recipe ?? null : local.getGeneratedRecipe(id);
}
export async function getCurrentGeneratedRecipe(id: string) {
  if (!durable()) return local.getCurrentGeneratedRecipe(id);
  const entry = await getRuntime<Entry>('recipe', id);
  if (entry?.supersededBy) throw new local.StaleRecipeRevisionError(id, entry.supersededBy);
  return entry?.recipe ?? null;
}
export async function getGeneratedRecipeRevisionMetadata(id: string) {
  if (!durable()) return local.getGeneratedRecipeRevisionMetadata(id);
  const entry = await getRuntime<Entry>('recipe', id);
  if (!entry) return null;
  return { rootRevisionId: entry.rootRevisionId, parentRevisionId: entry.parentRevisionId, supersededBy: entry.supersededBy };
}
export async function storeGeneratedRecipeRevision(parentId: string, candidate: Recipe) {
  if (!durable()) return local.storeGeneratedRecipeRevision(parentId, candidate);
  const id = `recipe-revision-${randomUUID()}`;
  const recipe = { ...candidate, id };
  const result = await database().query(`WITH parent AS (
    UPDATE okyo_private.okyo_runtime SET payload=jsonb_set(payload,'{supersededBy}',to_jsonb($4::text))
    WHERE kind='recipe' AND id=$1 AND owner=$2 AND expires_at>now() AND NOT payload ? 'supersededBy'
    RETURNING payload->>'rootRevisionId' AS root
  ) INSERT INTO okyo_private.okyo_runtime(kind,id,owner,payload,expires_at)
    SELECT 'recipe',$4,$2,jsonb_build_object('recipe',$3::jsonb,'rootRevisionId',root,'parentRevisionId',$1::text),now()+interval '1 day'
    FROM parent RETURNING payload`, [parentId, ownerScope(), JSON.stringify(persistentPayload(recipe)), id]);
  if (!result.rows.length) throw new local.StaleRecipeRevisionError(parentId);
  return { parentRevisionId: parentId, recipe, rootRevisionId: result.rows[0].payload.rootRevisionId as string };
}
export async function storeAnalysisContext(context: Omit<local.StoredAnalysisContext, 'expiresAt'>, now = Date.now()) {
  if (!durable()) return local.storeAnalysisContext(context, now);
  const analysisId = randomUUID();
  const expiresAt = now + local.ANALYSIS_TTL_MS;
  await putRuntime('analysis', analysisId, { ...context, expiresAt }, local.ANALYSIS_TTL_MS);
  return { analysisId, expiresAt };
}
export async function getAnalysisContext(id: string, now = Date.now()): Promise<ReturnType<typeof local.getAnalysisContext>> {
  if (!durable()) return local.getAnalysisContext(id, now);
  const context = await getRuntime<local.StoredAnalysisContext>('analysis', id);
  if (!context) return { status: 'missing' };
  // Secrets and model config are re-read on the server, never loaded from JSON.
  return { status: 'found', context: { ...context, config: getAiConfig({ fableActive: context.fableActive }) } };
}
