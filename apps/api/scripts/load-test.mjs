#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { assertLocalLoadTestTarget, assertMockServer } from './load-test-safety.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--') && all[index + 1] && !all[index + 1].startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const baseUrl = assertLocalLoadTestTarget(args.url ?? 'http://127.0.0.1:8081');
const workload = args.workload ?? 'browse';
const scenario = args.scenario ?? 'immediate';
const concurrency = integer(args.concurrency, 100, 1, 10_000);
const rps = integer(args.rps, 100, 1, 100_000);
const durationSeconds = integer(args.duration, 10, 1, 3_600);
const delayMs = args.delay === undefined ? undefined : integer(args.delay, 0, 0, 60_000);
const maxRssMb = integer(args['max-rss-mb'], 1_024, 100, 100_000);
const maxErrorRate = number(args['max-error-rate'], workload === 'browse' || workload === 'read' ? 0.01 : 0.05, 0, 1);
const duplicateEvery = integer(args['duplicate-every'], 0, 0, 1_000_000);
const validWorkloads = new Set(['idle', 'browse', 'read', 'auth', 'upload', 'ai', 'mixed']);
const validScenarios = new Set(['immediate', '5s', '15s', '30s', 'near-timeout', 'timeout', '429', '500', 'malformed', 'missing-nutrition', 'retryable-failure']);
if (!validWorkloads.has(workload) || !validScenarios.has(scenario)) throw new Error('Invalid workload or scenario.');
if (process.env.OKYO_LOAD_TEST_MODE !== 'true' || process.env.OKYO_LOAD_TEST_TARGET !== 'local') {
  throw new Error('Set OKYO_LOAD_TEST_MODE=true and OKYO_LOAD_TEST_TARGET=local explicitly.');
}
const before = await assertMockServer(baseUrl);
const runId = randomUUID().replaceAll('-', '').slice(0, 16);
const imagePath = resolve(import.meta.dirname, '../../mobile/assets/food/recipes/smash-cheeseburger.png');
const fixture = workload === 'upload' || workload === 'mixed'
  ? `data:image/png;base64,${(await readFile(imagePath)).toString('base64')}` : null;
const startedAt = performance.now();
const endAt = startedAt + durationSeconds * 1_000;
const abort = new AbortController();
let nextStartAt = startedAt;
let issued = 0;
let duplicates = 0;
let clientInFlight = 0;
let peakClientInFlight = 0;
let peakRssBytes = before.rssBytes ?? 0;
let peakProviderConcurrency = before.ai?.inFlight ?? 0;
let stoppedReason = null;
const samples = [];
const healthLatencies = [];
const outcomes = [];
const sampleTimer = setInterval(async () => {
  try {
    const sample = await assertMockServer(baseUrl);
    samples.push(sample);
    const healthStarted = performance.now();
    const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3_000) });
    healthLatencies.push(performance.now() - healthStarted);
    if (!health.ok) { stoppedReason = 'health_unavailable'; abort.abort(); return; }
    peakRssBytes = Math.max(peakRssBytes, sample.rssBytes ?? 0);
    peakProviderConcurrency = Math.max(peakProviderConcurrency, sample.ai?.inFlight ?? 0);
    const serverFailures = outcomes.filter((item) => item.status >= 500 || item.timeout).length;
    if (peakRssBytes > maxRssMb * 1024 * 1024 ||
      (outcomes.length >= 50 && serverFailures / outcomes.length > maxErrorRate)) {
      stoppedReason = peakRssBytes > maxRssMb * 1024 * 1024 ? 'memory_limit' : 'error_rate';
      abort.abort();
    }
  } catch { stoppedReason = 'mock_status_unavailable'; abort.abort(); }
}, 1_000);

async function worker() {
  while (!abort.signal.aborted) {
    const now = performance.now();
    if (now >= endAt) return;
    const slot = issued++;
    const startAt = Math.max(now, nextStartAt);
    nextStartAt = startAt + 1_000 / rps;
    if (startAt >= endAt) return;
    if (startAt > now) await new Promise((resolveWait) => setTimeout(resolveWait, startAt - now));
    if (abort.signal.aborted) return;
    if (workload === 'idle') continue;
    const duplicate = duplicateEvery > 1 && slot % duplicateEvery === 1;
    const actionId = duplicate ? slot - 1 : slot;
    if (duplicate) duplicates += 1;
    const user = `load_user_${actionId % concurrency}`;
    const selected = workload === 'mixed' ? ['browse', 'read', 'read', 'auth', 'upload', 'ai'][slot % 6] : workload;
    const idempotencyKey = `load_${runId}_${actionId}`;
    const headers = { 'x-okyo-load-user': user, 'idempotency-key': idempotencyKey };
    if (delayMs !== undefined) headers['x-okyo-load-delay-ms'] = String(delayMs);
    let path = '/v1/restaurant-packs';
    let method = 'GET';
    let body;
    if (selected === 'read') path = '/v1/recipes/recipe-spicy-vodka-rigatoni-restaurant-copy';
    if (selected === 'auth') path = '/internal/load-test/session';
    if (selected === 'upload' || selected === 'ai') {
      path = '/v1/scans'; method = 'POST';
      headers['content-type'] = 'application/json';
      headers['x-okyo-load-scenario'] = scenario;
      body = selected === 'upload'
        ? JSON.stringify({ source: 'photos', mode: 'Normal', image: { dataUrl: fixture ?? 'data:image/png;base64,iVBORw0KGgo=', mimeType: 'image/png' } })
        : JSON.stringify({ source: 'description', mode: 'Normal', mealDescription: 'Synthetic restaurant meal fixture' });
    }
    const sentAt = performance.now();
    clientInFlight += 1;
    peakClientInFlight = Math.max(peakClientInFlight, clientInFlight);
    try {
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(65_000)]);
      const response = await fetch(`${baseUrl}${path}`, { method, headers, body, signal });
      const payload = await response.json();
      outcomes.push({ status: response.status, latencyMs: performance.now() - sentAt, timeout: false,
        code: payload?.error?.code ?? null, scanId: payload?.data?.scan?.id ?? null,
        actionId, duplicate });
    } catch (error) {
      outcomes.push({ status: 0, latencyMs: performance.now() - sentAt,
        timeout: error?.name === 'TimeoutError', code: error?.name ?? 'network_error', actionId, duplicate });
    } finally {
      clientInFlight -= 1;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
if (!abort.signal.aborted) {
  const remainingMs = endAt - performance.now();
  if (remainingMs > 0) await new Promise((resolveWait) => setTimeout(resolveWait, remainingMs));
}
clearInterval(sampleTimer);
const after = await assertMockServer(baseUrl);
const recoveryStarted = performance.now();
let recoveryMs = 0;
while ((await assertMockServer(baseUrl)).inFlightRequests > 1 && recoveryMs < 10_000) {
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  recoveryMs = performance.now() - recoveryStarted;
}
const elapsedSeconds = (performance.now() - startedAt) / 1_000;
const latencies = outcomes.map((item) => item.latencyMs).sort((a, b) => a - b);
const count = (predicate) => outcomes.filter(predicate).length;
const duplicateMismatches = outcomes.filter((item) => item.duplicate && item.scanId &&
  outcomes.some((first) => first.actionId === item.actionId && first.scanId && first.scanId !== item.scanId)).length;
const failureRate = outcomes.length ? count((item) => item.status >= 500 || item.timeout || item.status === 0) / outcomes.length : 0;
if (!stoppedReason && failureRate > maxErrorRate) stoppedReason = 'error_rate';
const report = {
  environment: baseUrl, workload, scenario, configuredConcurrency: concurrency, configuredRps: rps,
  peakClientInFlight,
  configuredDurationSeconds: durationSeconds, actualDurationSeconds: Number(elapsedSeconds.toFixed(2)),
  delayMs: delayMs ?? null, requests: outcomes.length, rps: Number((outcomes.length / elapsedSeconds).toFixed(2)),
  successPercent: percent(count((item) => item.status >= 200 && item.status < 300), outcomes.length),
  http2xx: count((item) => item.status >= 200 && item.status < 300),
  http4xx: count((item) => item.status >= 400 && item.status < 500),
  http429: count((item) => item.status === 429),
  http5xx: count((item) => item.status >= 500),
  statusCounts: Object.fromEntries([...new Set(outcomes.map((item) => item.status))].sort((a, b) => a - b)
    .map((status) => [status, count((item) => item.status === status)])),
  errorCodes: Object.fromEntries([...new Set(outcomes.map((item) => item.code).filter(Boolean))].sort()
    .map((code) => [code, count((item) => item.code === code)])),
  timeouts: count((item) => item.timeout),
  latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99), max: latencies.at(-1) ?? null },
  healthLatencyP95Ms: percentile(healthLatencies.sort((a, b) => a - b), 0.95),
  recoveryMs: Number(recoveryMs.toFixed(2)),
  peakRssBytes, peakMockProviderConcurrency: peakProviderConcurrency,
  cpuMicros: { user: (after.cpuUsageMicros?.user ?? 0) - (before.cpuUsageMicros?.user ?? 0), system: (after.cpuUsageMicros?.system ?? 0) - (before.cpuUsageMicros?.system ?? 0) },
  duplicateRequests: duplicates, duplicateMismatches, stoppedReason,
  maxErrorRate, observedFailureRate: Number(failureRate.toFixed(4)),
  database: 'not configured in isolated local mock', queue: 'no durable queue in current API',
  analytics: 'disabled', realAiRequests: 0,
};
if (args.output) await writeFile(resolve(args.output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (stoppedReason || duplicateMismatches > 0) process.exitCode = 1;

function integer(value, fallback, min, max) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < min || result > max) throw new Error(`Expected integer ${min}–${max}.`);
  return result;
}
function number(value, fallback, min, max) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`Expected number ${min}–${max}.`);
  return result;
}
function percentile(values, q) { return values.length ? Number(values[Math.ceil(values.length * q) - 1].toFixed(2)) : null; }
function percent(part, total) { return total ? Number((part * 100 / total).toFixed(2)) : null; }
