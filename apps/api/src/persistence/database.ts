import { Pool } from 'pg';

export type Database = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }> };
let pool: Pool | undefined;
let override: Database | undefined;

export function databaseConfigured(): boolean {
  return Boolean(override || process.env.DATABASE_URL?.trim());
}

export function database(): Database {
  if (override) return override;
  if (!process.env.DATABASE_URL?.trim()) throw new Error('Durable storage unavailable');
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database configuration');
    // TLS certificate verification is never disabled. Private Railway networking
    // can explicitly opt out of TLS; public connections must use verify-full.
    if (process.env.DATABASE_TRANSPORT !== 'private-network' && url.searchParams.get('sslmode') !== 'verify-full') {
      throw new Error('Database requires verified TLS or explicit private-network transport');
    }
    pool = new Pool({ connectionString: url.toString(), max: 10, connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000, statement_timeout: 3000, query_timeout: 4000 });
    pool.on('error', () => { /* requests and readiness fail closed on their own queries */ });
  }
  return pool;
}

/** Pool health counters for internal metrics; does not open a connection. */
export function getDatabasePoolSnapshot() {
  return {
    configured: databaseConfigured(),
    initialized: Boolean(pool),
    total: pool?.totalCount ?? 0,
    idle: pool?.idleCount ?? 0,
    waiting: pool?.waitingCount ?? 0,
  };
}

export async function databaseHealthy(): Promise<boolean> {
  try {
    // Readiness runs frequently. Check schema and grants without creating a
    // health row or competing with application writes on every probe.
    const result = await database().query(`SELECT
      has_function_privilege(current_user, 'okyo_private.okyo_reserve_quota(text[],integer[])', 'EXECUTE') AS quota,
      has_function_privilege(current_user, 'okyo_private.okyo_cleanup_runtime()', 'EXECUTE') AS cleanup,
      has_schema_privilege(current_user, 'okyo_private', 'USAGE') AS schema_usage,
      has_table_privilege(current_user, 'okyo_private.okyo_runtime', 'SELECT,INSERT,UPDATE,DELETE') AS runtime_dml,
      has_table_privilege(current_user, 'okyo_private.okyo_quota', 'SELECT,INSERT,UPDATE,DELETE') AS quota_dml,
      has_table_privilege(current_user, 'okyo_private.idea_submissions', 'INSERT') AS idea_insert`);
    return result.rows[0]?.quota === true && result.rows[0]?.cleanup === true && result.rows[0]?.schema_usage === true &&
      result.rows[0]?.runtime_dml === true && result.rows[0]?.quota_dml === true && result.rows[0]?.idea_insert === true;
  } catch { return false; }
}

export async function cleanupPersistentRuntime(): Promise<number> {
  const result = await database().query('SELECT okyo_private.okyo_cleanup_runtime() AS removed');
  return Number(result.rows[0]?.removed ?? 0);
}

export function useDatabaseForTests(db?: Database): void { override = db; }
