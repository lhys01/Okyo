# Updated Risk Ranking

Branch: `activation-audit-v1`
Date: 2026-06-18
Supersedes: TOP_10_RISKS.md

---

## What Changed

The second review found one new HIGH severity issue that was missed in the first audit:

- **NEW HIGH-3**: Onboarding scan images stored in cache directory, not Documents

All previous findings re-verified independently from code. No previous findings were disproven. One previous claim ("WelcomeScreen calls copyToDocuments") was found to be wrong — this is the source of the new HIGH finding.

---

## Full Risk Ranking

| Rank | ID | Severity | Issue | Breaks For |
|------|----|----------|-------|-----------|
| 1 | C1 | CRITICAL | Hardcoded local IP as API URL | 100% of users, scan 1 |
| 2 | H3 | HIGH | **NEW**: Onboarding scan image in cache, not Documents | Real-photo onboarding users after restart |
| 3 | H1 | HIGH | In-memory rate limiter resets on restart | After any server restart |
| 4 | H2 | HIGH | No API authentication | Anyone with API URL |
| 5 | M1 | MEDIUM | `awardedXpEvents` grows unboundedly | 10K+ scan power users |
| 6 | M5 | MEDIUM | **NEW**: Silent env var fallback to local IP | Developer who forgets env var at build time |
| 7 | M2 | MEDIUM | `weeklyScanCount` never resets | After first week |
| 8 | M3 | MEDIUM | Dual scan data in AsyncStorage | Future scale |
| 9 | M4 | MEDIUM | Open CORS policy | Security hardening |
| 10 | L1 | LOW | Leaderboard initialized with mock data | Always |
| 11 | L2 | LOW | `pending` status survives app kill | Post-kill restart |
| 12 | L3 | LOW | API in-memory store lost on restart | Any server restart |
| 13 | L4 | LOW | No Zustand persist `version`/`migrate` | Future schema changes |
| 14 | L5 | LOW | `AI_ENABLED=false` default in API .env | Naive API deployer |

---

## Critical Issues

### C1: Hardcoded local IP as API URL

**File**: `apps/mobile/src/api/config.ts:1`
**Code**: `export const OKYO_API_BASE_URL = 'http://192.168.2.42:8081';`
**Breaks**: All production scans for all users
**Fix**: `process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081'`

---

## High Issues

### H3: Onboarding scan images stored in cache, not Documents (NEW)

**Files**: `apps/mobile/src/screens/WelcomeScreen.tsx`

**Evidence**:
- `ScanScreen.tsx:251`: `startScan('camera', await copyToDocuments(cameraImage))` — copies to Documents
- `WelcomeScreen.tsx:195`: `await startOnboardingScan('camera', await getImageMetadata(...))` — NO `copyToDocuments`
- Confirmed by: `grep -n "copyToDocuments\|documentDirectory\|okyo-scan-images" WelcomeScreen.tsx` → no output

**Root cause**: `WelcomeScreen.getImageMetadata()` uses `ImageManipulator.manipulateAsync()` which saves to the Expo cache directory. Cache files are NOT permanent — iOS clears them when storage is low or after inactivity.

**Failure path**:
1. User scans real photo during onboarding
2. `selectedScanImage.uri` = `Caches/...` (cache file)
3. Recipe saved from RecipeDetailScreen → `recipe.imageUri = cacheUri`
4. App restarted → iOS may evict cache → image missing in Library

**Who is affected**: First-time users who scan a real food photo during onboarding (majority of engaged users). The first recipe ever saved will eventually lose its image.

**Why missed**: Previous audit only traced `ScanScreen`. `WelcomeScreen` has its own separate scan path with similar structure but missing the Documents copy step.

**Fix**:
1. Extract `copyToDocuments` from `ScanScreen.tsx` to `apps/mobile/src/utils/scanImageStorage.ts`
2. Import and call it in `WelcomeScreen.startOnboardingScan()` before `beginLatestScanSession`

### H1: In-memory rate limiter and AI cap reset on restart

**Status**: Known, accepted for MVP. Documented in code with "Replace with Redis before public launch."

### H2: No API authentication

**Status**: Known, accepted for MVP. Out of scope for current task.

---

## Medium Issues

### M5: Silent fallback to local IP when env var not set (NEW)

**Evidence**: `undefined ?? 'http://192.168.2.42:8081'` evaluates to fallback with no warning if `EXPO_PUBLIC_OKYO_API_URL` is not in `.env`.

**Fix**: Add `__DEV__` warning when fallback is used:
```typescript
if (__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set this before production builds.');
}
```

### M1, M2, M3, M4: Unchanged from previous ranking

---

## Issues Added vs Previous Ranking

| Finding | Previous | Updated |
|---------|----------|---------|
| Onboarding scan cache URI | Not found | **NEW HIGH-3** |
| Silent env var fallback | Not found | **NEW MEDIUM-5** |
| AI_ENABLED=false default | Not found | **NEW LOW-5** |
| All previous findings | Unchanged | Confirmed |

---

## Pre-Launch Fix Priority

| # | Fix | Priority | Effort |
|---|-----|----------|--------|
| 1 | Replace hardcoded API URL with env var | **MUST — before any production build** | 2 lines |
| 2 | `copyToDocuments` in WelcomeScreen | **MUST — affects first user experience** | ~20 lines |
| 3 | Dev warning when env var not set | Should — deployment safety | 3 lines |
| 4 | Cap `awardedXpEvents` at 5,000 | Should — long-term degradation prevention | 3 lines |
| 5 | `weeklyScanCount` reset logic | Nice-to-have | ~20 lines |
| 6+ | All other items | Post-launch | Various |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|-----------|-------|
| Scan ownership system (ScanScreen) | HIGH (95%) | 9 attack loops in prior audit + re-verified here |
| Onboarding scan persistence (WelcomeScreen) | HIGH (95%) | Confirmed no `copyToDocuments` call in 2 independent reads |
| API URL fix correctness | HIGH (90%) | Expo SDK 55 `EXPO_PUBLIC_*` mechanism confirmed |
| AsyncStorage scale | MEDIUM (85%) | Calculated from type sizes; actual device timings not measured |
| OpenRouter outage handling | HIGH (90%) | Code path traced to specific rejection types |
| Image file deletion resilience | HIGH (95%) | FoodImage fallback confirmed |
