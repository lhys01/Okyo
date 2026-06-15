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
};

export function getCostControlConfig(): CostControlConfig {
  return {
    scanRateLimitWindowMs: getPositiveInteger(process.env.SCAN_RATE_LIMIT_WINDOW_MS, 60_000),
    scanRateLimitMax: getPositiveInteger(process.env.SCAN_RATE_LIMIT_MAX, 10),
    aiDailyRequestCap: getPositiveInteger(process.env.AI_DAILY_REQUEST_CAP, 200),
    maxScanImageBytes: getPositiveInteger(process.env.MAX_SCAN_IMAGE_BYTES, 10_000_000),
    imageGenEnabled: process.env.IMAGE_GEN_ENABLED === 'true',
    imageGenDailyRequestCap: getPositiveInteger(process.env.IMAGE_GEN_DAILY_REQUEST_CAP, 0),
  };
}

function getPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
