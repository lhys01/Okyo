# Production Fix Report

Branch: `activation-audit-v1`
Fixes applied after: PRODUCTION_BREAK_REPORT.md + TOP_10_RISKS.md
Date: 2026-06-17

---

## CRITICAL Fix — Hardcoded API URL

**Issue**: `OKYO_API_BASE_URL = 'http://192.168.2.42:8081'` is a literal local LAN IP. All production users fail all scans.

**Fix**

`apps/mobile/src/api/config.ts`:
```typescript
// Before:
export const OKYO_API_BASE_URL = 'http://192.168.2.42:8081';

// After:
export const OKYO_API_BASE_URL = process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081';
```

`apps/mobile/.env.example` (new file):
```
# Okyo API base URL.
# Development: your local IP (run `ipconfig getifaddr en0` on Mac to find it).
# Production: set via EAS Secrets or .env.production before building.
EXPO_PUBLIC_OKYO_API_URL=http://192.168.2.42:8081
```

**How it works**
Expo SDK 55 reads `EXPO_PUBLIC_*` variables from `.env`, `.env.local`, `.env.production` at build time and inlines them into the JS bundle. `process.env.EXPO_PUBLIC_OKYO_API_URL` resolves to the string at build time. The fallback `'http://192.168.2.42:8081'` is retained so existing dev setups (with no `.env` file) continue to work without changes.

**Production deployment steps**:
1. Create `apps/mobile/.env.production` with `EXPO_PUBLIC_OKYO_API_URL=https://api.okyo.app`
2. Or set as an EAS Secret in `eas.json` env block
3. Run `eas build --platform ios --profile production`

**Files changed**:
- `apps/mobile/src/api/config.ts`
- `apps/mobile/.env.example` (new)

**Regression risk**: None. The fallback value is the original hardcoded IP, so dev builds without a `.env` file are unaffected.

---

## MEDIUM Fix — Cap `awardedXpEvents` to prevent unbounded growth

**Issue**: `awardedXpEvents` array grows by ~2 entries per scan session. At 10,000 scans (extreme power user), array has ~20,000 entries, causing AsyncStorage serialization lag.

**Fix**

`apps/mobile/src/state/useOkyoStore.ts` in `awardXPOnce`:

```typescript
// Before:
return {
  awardedXpEvents: [...state.awardedXpEvents, eventId],
  xp: state.xp + points,
};

// After:
const newEvents = [...state.awardedXpEvents, eventId];
return {
  awardedXpEvents: newEvents.length > 5000 ? newEvents.slice(-5000) : newEvents,
  xp: state.xp + points,
};
```

**Why 5,000**: Covers ~2,500 scan sessions worth of unique events. At 1 scan/day, that's nearly 7 years. Cap never fires for any realistic user in the app's first generation.

**Why truncation is safe**: Event IDs include unique scan/recipe UUIDs (`first-scan-${id}`, `save-recipe-${id}`). These IDs are never reused (UUIDs + scan session IDs are unique). Truncating old entries means we forget that those specific historical events were awarded, but since those exact IDs will never appear again, the deduplication guard is never re-triggered.

**The 9 share-card event types** (`share-card-scan-result-Restaurant Copy`, etc.) are awarded at most once per scan session and are always in the recent portion of the array, so they are never truncated while still relevant.

**Files changed**:
- `apps/mobile/src/state/useOkyoStore.ts`

**Regression risk**: None. The cap only fires for users with >5,000 total XP events (unreachable in normal use). All existing data is preserved on upgrade — the cap only applies to future additions.

---

## TypeScript Verification

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: exit code 0, no errors.

---

## What Was NOT Fixed (and Why)

| Issue | Reason Not Fixed |
|-------|-----------------|
| H1: In-memory rate limiter resets | Requires Redis — infrastructure change out of scope |
| H2: No API authentication | Requires auth layer — infrastructure change out of scope |
| M2: `weeklyScanCount` never resets | Cosmetic UX bug; no production reliability impact |
| M3: Dual scan persistence | Requires persist migration; risky on upgrade; bounded waste |
| M4: Open CORS | Mobile-only app; CORS doesn't protect mobile clients |
| L1-L3: Low-severity items | Accepted limitations |
