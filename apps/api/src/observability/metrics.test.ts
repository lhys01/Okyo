import assert from 'node:assert/strict';
import test from 'node:test';

import { metrics, recordAiRequest, recordHttpRequest, renderPrometheusMetrics } from './metrics.js';

test('renders bounded-label HTTP and AI Prometheus metrics', () => {
  metrics.resetForTests();
  recordHttpRequest('/v1/scans', 201, 123);
  recordAiRequest('vision', 'success', 456);
  const output = renderPrometheusMetrics();
  assert.match(output, /okyo_http_requests_total\{route="\/v1\/scans",status_code="201"\} 1/);
  assert.match(output, /okyo_ai_requests_total\{outcome="success",stage="vision"\} 1/);
  assert.match(output, /okyo_http_request_duration_ms_bucket/);
  assert.match(output, /okyo_database_pool_configured [01]/);
  assert.match(output, /okyo_database_pool_connections\{state="waiting"\} \d+/);
});
