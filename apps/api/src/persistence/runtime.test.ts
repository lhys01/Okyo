import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { useDatabaseForTests, databaseHealthy, cleanupPersistentRuntime } from './database.js';
import { persistentPayload, putRuntime, getRuntime, deleteRuntimeOwner, ownerScope } from './runtimeStore.js';
import { executeDurableRequest, DurableRequestPendingError, DurableRequestConflictError } from './idempotency.js';
import { runWithRequestContext } from '../observability/requestContext.js';
import { postgresAiQuota } from '../services/postgresAiQuota.js';
import { productionReadiness } from '../services/productionReadiness.js';
import { storeGeneratedRecipe, storeGeneratedRecipeRevision, getCurrentGeneratedRecipe } from './aiState.js';
import type { Recipe } from '../types.js';

const schema = readFileSync(new URL('../../migrations/001_runtime.sql', import.meta.url), 'utf8');
const ideaSchema = readFileSync(new URL('../../migrations/002_idea_submissions.sql', import.meta.url), 'utf8');
const context = (fn: () => Promise<void>) => runWithRequestContext({ requestId:'internal',anonId:null,ownerKey:'guest:127.0.0.1' }, fn);

test('PostgreSQL atomic quotas, restart-compatible storage, duplicate claims and unavailable dependencies', async () => {
  const db = new PGlite();
  const saved = { ...process.env };
  process.env.QUOTA_SCOPE_HMAC_KEY = 'test-only-scope-key-with-at-least-32-characters';
  process.env.AI_SUBJECT_DAILY_CALL_CAP = '3';
  useDatabaseForTests(db);
  try {
    assert.equal(await databaseHealthy(), false, 'missing migration fails readiness');
    await db.exec(schema);
    await db.exec(ideaSchema);
    assert.equal(await databaseHealthy(), true);
    await context(async () => {
      const reserve = () => postgresAiQuota.reserveGlobalDaily({key:'global',limit:5,now:new Date()});
      const reservations = await Promise.all(Array.from({length:20}, reserve));
      assert.equal(reservations.filter(Boolean).length,3);
      const count = await db.query<{used: number}>("SELECT used::int FROM okyo_private.okyo_quota WHERE bucket='global'");
      assert.equal(count.rows[0]?.used,3,'failed subject reservations must roll back global count');
      assert.equal(await reserve(),null,'new adapter call/restart cannot reset stored cap');
      await putRuntime('analysis','a',{value:'recipe',config:{openRouterApiKey:'secret'},image:'private-photo'},60000);
      await db.query("INSERT INTO okyo_private.okyo_runtime(kind,id,owner,payload,expires_at) VALUES('expired','b','old','{}',now()-interval '1 day')");
      await db.query("INSERT INTO okyo_private.okyo_quota(bucket,period,used) VALUES('old','2000-01-01',2)");
      assert.ok(await cleanupPersistentRuntime() >= 2, 'scheduled cleanup removes expired state and prior-day counters');
      assert.equal((await db.query<{count:number}>("SELECT count(*)::int AS count FROM okyo_private.okyo_runtime WHERE kind='expired'")).rows[0]?.count, 0);
      assert.equal((await db.query<{count:number}>("SELECT count(*)::int AS count FROM okyo_private.okyo_quota WHERE bucket='old'")).rows[0]?.count, 0);
      useDatabaseForTests(db); // second adapter / same durable database
      assert.deepEqual(await getRuntime('analysis','a'),{value:'recipe'});
      let finish!: () => void;
      const barrier = new Promise<void>(resolve => {finish=resolve;});
      let calls = 0;
      const input = {key:'duplicate',fingerprintSource:{safe:1},operation:async () => {calls++;await barrier;return {ok:true};}};
      const first = executeDurableRequest(input);
      await new Promise(resolve=>setTimeout(resolve,20));
      await assert.rejects(executeDurableRequest(input),DurableRequestPendingError);
      finish(); await first;
      assert.deepEqual(await executeDurableRequest(input),{ok:true});
      assert.equal(calls,1);
      await assert.rejects(executeDurableRequest({...input,fingerprintSource:{safe:2}}),DurableRequestConflictError);
      await assert.rejects(executeDurableRequest({...input,key:'failed',operation:async()=>{throw new Error('provider timeout');}}));
      await assert.rejects(executeDurableRequest({...input,key:'failed'}),DurableRequestPendingError);
      process.env.NODE_ENV='production';
      const recipe = {id:'source',title:'Example'} as Recipe;
      await storeGeneratedRecipe(recipe);
      const revisions = await Promise.allSettled([storeGeneratedRecipeRevision('source',recipe),storeGeneratedRecipeRevision('source',recipe)]);
      assert.equal(revisions.filter(r=>r.status==='fulfilled').length,1);
      await assert.rejects(getCurrentGeneratedRecipe('source'));
    });
    process.env.PRODUCTION_AI_ENABLED='false';
    assert.equal((await productionReadiness()).productionAiEnabled,false);
    process.env.PRODUCTION_AI_ENABLED='true';
    delete process.env.CLERK_AUTHORIZED_PARTIES;
    assert.equal((await productionReadiness()).productionAiEnabled,false);
    useDatabaseForTests({query:async()=>{throw new Error('offline');}});
    assert.equal(await databaseHealthy(),false);
    assert.equal((await productionReadiness()).productionAiEnabled,false);
    await context(async()=>{await assert.rejects(postgresAiQuota.reserveGlobalDaily({key:'global',limit:5,now:new Date()}));});
  } finally {
    useDatabaseForTests();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env,saved);
    await db.close();
  }
});

test('readiness checks database capabilities with one read-only query', async () => {
  const statements: string[] = [];
  useDatabaseForTests({
    query: async (text) => {
      statements.push(text);
      return { rows: [{ quota: true, cleanup: true, schema_usage: true, runtime_dml: true, quota_dml: true, idea_insert: true }] };
    },
  });
  try {
    assert.equal(await databaseHealthy(), true);
    assert.equal(statements.length, 1);
    assert.doesNotMatch(statements[0]!, /^\s*(?:INSERT|UPDATE|DELETE)\b/im);
  } finally {
    useDatabaseForTests();
  }
});

test('durable payload excludes credentials and photos recursively', () => {
  assert.deepEqual(persistentPayload({recipe:{title:'Test',image:'private',nested:{base64:'secret'}},config:{openRouterApiKey:'secret'}}),
    {recipe:{title:'Test',nested:{}}});
});

test('persistent account cleanup removes only the authenticated owner runtime rows', async () => {
  const db = new PGlite();
  const saved = { ...process.env };
  process.env.QUOTA_SCOPE_HMAC_KEY = 'test-only-scope-key-with-at-least-32-characters';
  useDatabaseForTests(db);
  try {
    await db.exec(schema);
    await runWithRequestContext({ requestId: 'runtime-a', anonId: null, ownerKey: 'user:delete-a' }, async () => {
      await putRuntime('analysis', 'analysis-a', { value: 'private analysis' }, 60_000);
      await putRuntime('recipe', 'recipe-a', { recipe: { title: 'private recipe' } }, 60_000);
      await putRuntime('request', 'request-a', { state: 'complete', result: { title: 'private result' } }, 60_000);
    });
    await runWithRequestContext({ requestId: 'runtime-b', anonId: null, ownerKey: 'user:delete-b' }, async () => {
      await putRuntime('analysis', 'analysis-b', { value: 'other user analysis' }, 60_000);
    });

    const ownerA = runWithRequestContext({ requestId: 'scope-a', anonId: null, ownerKey: 'user:delete-a' }, ownerScope);
    const ownerB = runWithRequestContext({ requestId: 'scope-b', anonId: null, ownerKey: 'user:delete-b' }, ownerScope);
    await db.query('INSERT INTO okyo_private.okyo_quota(bucket,period,used) VALUES($1,current_date,1),($2,current_date,1),($3,current_date,1)',
      [`subject:${ownerA}`, `subject:${ownerB}`, 'global']);

    await runWithRequestContext({ requestId: 'delete-a', anonId: null, ownerKey: 'user:delete-a' }, deleteRuntimeOwner);
    const quotas = await db.query<{bucket:string}>('SELECT bucket FROM okyo_private.okyo_quota ORDER BY bucket');
    assert.equal(quotas.rows.some((row) => row.bucket === `subject:${ownerA}`), false);
    assert.equal(quotas.rows.some((row) => row.bucket === `subject:${ownerB}`), true);
    assert.equal(quotas.rows.some((row) => row.bucket === 'global'), true);
    await runWithRequestContext({ requestId: 'verify-a', anonId: null, ownerKey: 'user:delete-a' }, async () => {
      assert.equal(await getRuntime('analysis', 'analysis-a'), null);
      assert.equal(await getRuntime('recipe', 'recipe-a'), null);
      assert.equal(await getRuntime('request', 'request-a'), null);
      await deleteRuntimeOwner();
    });
    await runWithRequestContext({ requestId: 'verify-b', anonId: null, ownerKey: 'user:delete-b' }, async () => {
      assert.deepEqual(await getRuntime('analysis', 'analysis-b'), { value: 'other user analysis' });
    });
  } finally {
    useDatabaseForTests();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    await db.close();
  }
});
