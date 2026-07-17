// Fable 5 pricing is ~60-80x gpt-4o-mini — this cap is never allowed above 10
// regardless of env value, so a misconfigured .env can't create a cost surprise.
const FABLE_DAILY_REQUEST_CAP_HARD_MAX = 10;

export type CostControlConfig = {
  // Per-IP scan rate limit: max requests per window
  scanRateLimitWindowMs: number;
  scanRateLimitMax: number;
  // Global daily provider-attempt cap, enforced persistently by Supabase.
  aiDailyRequestCap: number;
  // Per-user provider-attempt cap, enforced persistently by Supabase.
  aiUserDailyRequestCap: number;
  // Maximum allowed image payload size for scan requests (bytes)
  maxScanImageBytes: number;
  // Separate, stricter cap for opt-in Fable 5 traffic. Hard-clamped to
  // FABLE_DAILY_REQUEST_CAP_HARD_MAX regardless of env configuration.
  fableDailyRequestCap: number;
};

export function getCostControlConfig(): CostControlConfig {
  return {
    scanRateLimitWindowMs: getPositiveInteger(process.env.SCAN_RATE_LIMIT_WINDOW_MS, 60_000),
    scanRateLimitMax: getPositiveInteger(process.env.SCAN_RATE_LIMIT_MAX, 10),
    aiDailyRequestCap: getPersistentPositiveCap(process.env.AI_DAILY_REQUEST_CAP, 200),
    aiUserDailyRequestCap: getPersistentPositiveCap(process.env.AI_USER_DAILY_REQUEST_CAP, 20),
    maxScanImageBytes: getPositiveInteger(process.env.MAX_SCAN_IMAGE_BYTES, 10_000_000),
    fableDailyRequestCap: Math.min(
      getNonNegativeCap(process.env.FABLE_DAILY_REQUEST_CAP, FABLE_DAILY_REQUEST_CAP_HARD_MAX),
      FABLE_DAILY_REQUEST_CAP_HARD_MAX,
    ),
  };
}

function getPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Missing values use safe server defaults. Explicitly invalid persistent caps
// become zero so the quota service fails closed instead of silently widening.
function getPersistentPositiveCap(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

// Same as getPositiveInteger but 0 is a valid, meaningful value (explicitly
// disables the cap) rather than falling back to the default.
function getNonNegativeCap(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
