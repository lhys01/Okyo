CREATE SCHEMA IF NOT EXISTS okyo_private;
REVOKE ALL ON SCHEMA okyo_private FROM PUBLIC;
-- Apply as the database owner/admin, then grant the runtime role only schema
-- USAGE, table DML, and EXECUTE on the two functions (see security setup docs).
CREATE TABLE IF NOT EXISTS okyo_private.okyo_quota (
  bucket text NOT NULL, period date NOT NULL, used bigint NOT NULL CHECK (used >= 0),
  PRIMARY KEY(bucket, period)
);
CREATE TABLE IF NOT EXISTS okyo_private.okyo_runtime (
  kind text NOT NULL, id text NOT NULL, owner text NOT NULL,
  payload jsonb NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(kind, id, owner)
);
CREATE INDEX IF NOT EXISTS okyo_runtime_expiry ON okyo_private.okyo_runtime(expires_at);
CREATE OR REPLACE FUNCTION okyo_private.okyo_cleanup_runtime()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE removed integer := 0; affected integer;
BEGIN
  DELETE FROM okyo_private.okyo_runtime WHERE expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  removed := removed + affected;
  DELETE FROM okyo_private.okyo_quota
    WHERE period < (now() AT TIME ZONE 'UTC')::date;
  GET DIAGNOSTICS affected = ROW_COUNT;
  removed := removed + affected;
  RETURN removed;
END $$;
CREATE OR REPLACE FUNCTION okyo_private.okyo_reserve_quota(buckets text[], caps integer[])
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE i integer; updated integer;
BEGIN
  IF cardinality(buckets) = 0 OR cardinality(buckets) <> cardinality(caps) THEN
    RAISE EXCEPTION 'invalid quota';
  END IF;
  -- Caller supplies sorted unique bucket names. Every reservation takes the
  -- global bucket lock first, serializing cross-instance cap decisions.
  FOR i IN 1..cardinality(buckets) LOOP
    IF caps[i] < 1 THEN RETURN false; END IF;
  END LOOP;
  BEGIN
    FOR i IN 1..cardinality(buckets) LOOP
      INSERT INTO okyo_private.okyo_quota(bucket, period, used)
      VALUES (buckets[i], (now() AT TIME ZONE 'UTC')::date, 1)
      ON CONFLICT(bucket, period) DO UPDATE SET used = okyo_private.okyo_quota.used + 1
      WHERE okyo_private.okyo_quota.used < caps[i];
      GET DIAGNOSTICS updated = ROW_COUNT;
      IF updated = 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0002'; END IF;
    END LOOP;
  EXCEPTION WHEN no_data_found THEN
    RETURN false; -- subtransaction rolls back ALL counters on any exhausted cap
  END;
  RETURN true;
END $$;
