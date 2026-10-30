import { getDatabasePoolSnapshot } from '../persistence/database.js';

/**
 * Dependency-free Prometheus exposition for the API's critical paths. Metrics
 * deliberately use route templates, never user IDs, request IDs, image names,
 * or provider response content, to avoid high-cardinality/PII labels.
 */
type Labels = Record<string, string | number>;

const requestDurationBucketsMs = [25, 50, 100, 250, 500, 750, 1_000, 2_500, 5_000, 10_000, 30_000, 60_000];
const aiDurationBucketsMs = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000, 60_000];

class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, { buckets: number[]; counts: number[]; count: number; sum: number }>();

  increment(name: string, labels: Labels = {}, value = 1) {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  setGauge(name: string, value: number, labels: Labels = {}) {
    this.gauges.set(metricKey(name, labels), value);
  }

  observe(name: string, value: number, buckets: number[], labels: Labels = {}) {
    const key = metricKey(name, labels);
    let histogram = this.histograms.get(key);
    if (!histogram) {
      histogram = { buckets, counts: buckets.map(() => 0), count: 0, sum: 0 };
      this.histograms.set(key, histogram);
    }
    histogram.count += 1;
    histogram.sum += value;
    histogram.buckets.forEach((bucket, index) => {
      if (value <= bucket) histogram!.counts[index] += 1;
    });
  }

  renderPrometheus(): string {
    const lines = [
      '# HELP okyo_http_request_duration_ms HTTP request duration in milliseconds.',
      '# TYPE okyo_http_request_duration_ms histogram',
      '# HELP okyo_http_requests_total Completed HTTP requests.',
      '# TYPE okyo_http_requests_total counter',
      '# HELP okyo_ai_request_duration_ms AI provider call duration in milliseconds.',
      '# TYPE okyo_ai_request_duration_ms histogram',
      '# HELP okyo_ai_requests_total AI provider call outcomes.',
      '# TYPE okyo_ai_requests_total counter',
      '# HELP okyo_in_flight_requests Current accepted HTTP requests.',
      '# TYPE okyo_in_flight_requests gauge',
      '# HELP okyo_ai_in_flight Current AI provider calls.',
      '# TYPE okyo_ai_in_flight gauge',
    ];

    for (const [key, counter] of this.counters) lines.push(`${key} ${counter}`);
    for (const [key, gauge] of this.gauges) lines.push(`${key} ${gauge}`);
    for (const [key, histogram] of this.histograms) {
      histogram.buckets.forEach((bucket, index) => lines.push(`${withLeLabel(key, bucket)} ${histogram.counts[index]}`));
      lines.push(`${withLeLabel(key, '+Inf')} ${histogram.count}`);
      lines.push(`${withMetricSuffix(key, '_sum')} ${histogram.sum}`);
      lines.push(`${withMetricSuffix(key, '_count')} ${histogram.count}`);
    }
    return `${lines.join('\n')}\n`;
  }

  resetForTests() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

function metricKey(name: string, labels: Labels): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return name;
  return `${name}{${entries.map(([key, value]) => `${key}="${String(value).replace(/\\|"|\n/g, '\\$&')}"`).join(',')}}`;
}

function withLeLabel(key: string, le: number | '+Inf'): string {
  const suffixed = withMetricSuffix(key, '_bucket');
  const brace = suffixed.lastIndexOf('{');
  if (brace === -1) return `${suffixed}{le="${le}"}`;
  return `${suffixed.slice(0, brace + 1)}le="${le}",${suffixed.slice(brace + 1)}`;
}

function withMetricSuffix(key: string, suffix: string): string {
  const brace = key.lastIndexOf('{');
  return brace === -1 ? `${key}${suffix}` : `${key.slice(0, brace)}${suffix}${key.slice(brace)}`;
}

export const metrics = new MetricsRegistry();

export function recordHttpRequest(route: string, statusCode: number, durationMs: number) {
  const labels = { route, status_code: statusCode };
  metrics.increment('okyo_http_requests_total', labels);
  metrics.observe('okyo_http_request_duration_ms', durationMs, requestDurationBucketsMs, labels);
}

export function recordAiRequest(stage: string, outcome: 'success' | 'failure' | 'rejected', durationMs: number) {
  const labels = { stage, outcome };
  metrics.increment('okyo_ai_requests_total', labels);
  metrics.observe('okyo_ai_request_duration_ms', durationMs, aiDurationBucketsMs, labels);
}

export function renderPrometheusMetrics(): string {
  const output = metrics.renderPrometheus();
  const pool = getDatabasePoolSnapshot();
  return `${output}# HELP okyo_database_pool_configured Whether a database connection string or test adapter is configured.\n` +
    `# TYPE okyo_database_pool_configured gauge\n` +
    `okyo_database_pool_configured ${pool.configured ? 1 : 0}\n` +
    `# HELP okyo_database_pool_initialized Whether the PostgreSQL connection pool has been opened.\n` +
    `# TYPE okyo_database_pool_initialized gauge\n` +
    `okyo_database_pool_initialized ${pool.initialized ? 1 : 0}\n` +
    `# HELP okyo_database_pool_connections Current PostgreSQL pool connections by state.\n` +
    `# TYPE okyo_database_pool_connections gauge\n` +
    `okyo_database_pool_connections{state="total"} ${pool.total}\n` +
    `okyo_database_pool_connections{state="idle"} ${pool.idle}\n` +
    `okyo_database_pool_connections{state="waiting"} ${pool.waiting}\n`;
}
