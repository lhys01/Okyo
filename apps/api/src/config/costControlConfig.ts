// Fable 5 pricing is ~60-80x gpt-4o-mini — this cap is never allowed above 10
// regardless of env value, so a misconfigured .env can't create a cost surprise.
const FABLE_DAILY_REQUEST_CAP_HARD_MAX = 10;

export type CostControlConfig = {
  // Per-IP scan rate limit: max requests per window
  scanRateLimitWindowMs: number;
  scanRateLimitMax: number;
  // Global daily AI request cap (in-memory, resets on restart — use DB before public launch)
  aiDailyRequestCap: number;
  // Maximum allowed image payload size for scan requests (bytes)
  maxScanImageBytes: number;
  // Image generation kill switch (scaffold — image gen not yet active)
  imageGenEnabled: boolean;
  imageGenDailyRequestCap: number;
  // Separate, stricter cap for opt-in Fable 5 traffic. Hard-clamped to
  // FABLE_DAILY_REQUEST_CAP_HARD_MAX regardless of env configuration.
  fableDailyRequestCap: number;
};

export function getCostControlConfig(): CostControlConfig {
  return {
    scanRateLimitWindowMs: getPositiveInteger(process.env.SCAN_RATE_LIMIT_WINDOW_MS, 60_000),
    scanRateLimitMax: getPositiveInteger(process.env.SCAN_RATE_LIMIT_MAX, 10),
    aiDailyRequestCap: getPositiveInteger(process.env.AI_DAILY_REQUEST_CAP, 200),
    maxScanImageBytes: getPositiveInteger(process.env.MAX_SCAN_IMAGE_BYTES, 10_000_000),
    imageGenEnabled: process.env.IMAGE_GEN_ENABLED === 'true',
    imageGenDailyRequestCap: getPositiveInteger(process.env.IMAGE_GEN_DAILY_REQUEST_CAP, 0),
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

// Same as getPositiveInteger but 0 is a valid, meaningful value (explicitly
// disables the cap) rather than falling back to the default.
function getNonNegativeCap(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
