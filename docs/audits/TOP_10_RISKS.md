# Top 10 Production Risks

Branch: `activation-audit-v1`
Date: 2026-06-17
Method: Code inspection only. Previous reports not trusted.

---

## Risk Ranking

| Rank | ID | Severity | Impact | Breaks At |
|------|----|----------|--------|-----------|
| 1 | C1 | CRITICAL | All scans fail | User 1 |
| 2 | H1 | HIGH | Cost exposure after restart | Deploy day |
| 3 | H2 | HIGH | Unauthenticated API | Any time |
| 4 | M1 | MEDIUM | AsyncStorage degrades | ~10K scans |
| 5 | M2 | MEDIUM | Misleading weekly count | Day 8+ |
| 6 | M3 | MEDIUM | Duplicate scan data in AsyncStorage | Year 1+ |
| 7 | M4 | MEDIUM | Open CORS | Any time |
| 8 | L1 | LOW | Leaderboard shows mock data | Always |
| 9 | L2 | LOW | Pending scan state survives kill | Kill+restart |
| 10 | L3 | LOW | API store lost on restart | Any restart |

---

## Risk Details

---

### CRITICAL-1: Hardcoded local IP as API base URL

**File**: `apps/mobile/src/api/config.ts:1`

```typescript
export const OKYO_API_BASE_URL = 'http://192.168.2.42:8081';
```

**Root Cause**
The API URL is a literal string pointing to a developer's local LAN IP address. This value is compiled directly into the app bundle. No environment variable injection exists in `app.json` or `config.ts`.

**Reproduction**
1. Build any production/TestFlight/App Store build.
2. Run on any device not on the developer's home network.
3. ALL `/v1/scans` requests fail immediately with `Network request failed`.

**Impact**
100% of production users cannot scan. No fallback to mock mode for real image uploads. Users see only the generic failure screen.

**Affected Files**
- `apps/mobile/src/api/config.ts`

**Fix**
Replace with `process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081'` and create `apps/mobile/.env.example`.

---

### HIGH-1: In-memory rate limiter and AI cap reset on server restart

**File**: `apps/api/src/middleware/costControls.ts`

```typescript
const ipWindowMap = new Map<string, RateLimitEntry>();  // resets on restart
let globalDailyAiRequests = 0;                          // resets on restart
```

**Root Cause**
Both the per-IP rate limiter and the global daily AI cap are stored in process memory. Any server restart, crash, deploy, or auto-scaling event resets both counters to zero.

**Impact**
An attacker or burst traffic event could exhaust the AI daily cap (200 calls) or bypass per-IP rate limiting within seconds of a server restart. Real cost exposure risk.

**Note**: The code already comments: "Replace with Redis before public launch." This is a known accepted risk for development.

**Affected Files**
- `apps/api/src/middleware/costControls.ts`

**Fix** (out of current scope — requires Redis or persistent store)
For launch: ensure the server is stable and restarts are infrequent.

---

### HIGH-2: No authentication on any API endpoint

**File**: `apps/api/src/server.ts`

**Root Cause**
All API endpoints accept requests without any credentials. There is no API key, JWT, session token, or device ID check. The only protection on `/v1/scans` is IP-based rate limiting.

**Impact**
- Anyone who discovers the production API URL can call all endpoints freely.
- `/v1/xp-events`, `/v1/challenges`, `/v1/library` are fully open.
- Mock-mode scans (`source: 'mock'`) bypass the AI daily cap entirely — unlimited mock scan calls possible.

**Affected Files**
- `apps/api/src/server.ts`

**Fix** (out of scope for current task — requires auth infrastructure)
For launch: restrict access via network-level controls (private VPC, non-public IP), API key header validation, or device attestation.

---

### MEDIUM-1: `awardedXpEvents` array grows unboundedly

**File**: `apps/mobile/src/state/useOkyoStore.ts:358`

```typescript
awardedXpEvents: [...state.awardedXpEvents, eventId],
```

**Root Cause**
Every call to `awardXPOnce(eventId, points)` appends to `awardedXpEvents` with no cap. Event IDs include unique scan/recipe IDs (`first-scan-${scanResult.id}`, `save-recipe-${recipe.id}`), so entries never repeat and the array grows by ~2 entries per scan session.

**Impact at scale**
- 10,000 scans: ~20,000 entries × 30 chars ≈ 600KB
- Total AsyncStorage blob approaches ~17MB at extreme usage
- App startup JSON.parse() time: 200-400ms on older devices
- `includes()` deduplication check is O(n): ~5ms at 20K entries

**Does not cause crashes.** Gradual performance degradation only.

**Affected Files**
- `apps/mobile/src/state/useOkyoStore.ts`

**Fix**
Cap `awardedXpEvents` at 5,000 entries. Since event IDs include unique scan/recipe IDs that never repeat, truncation is safe.

---

### MEDIUM-2: `weeklyScanCount` never resets

**File**: `apps/mobile/src/state/useOkyoStore.ts:348`

```typescript
weeklyScanCount: state.weeklyScanCount + 1,
```

**Root Cause**
`weeklyScanCount` increments via `incrementWeeklyScanCount()` and is persisted to AsyncStorage. There is no reset logic, no `weeklyScanResetAt` timestamp, and no weekly reset on app launch or rehydration.

**Impact**
After the first week of use, `weeklyScanCount` becomes a lifetime count, not a weekly count. Any screen displaying it shows incorrect data indefinitely.

**Affected Files**
- `apps/mobile/src/state/useOkyoStore.ts`

**Fix**
Add `weeklyScanResetAt: string` field (ISO date). On increment, check if current date is ≥7 days past `weeklyScanResetAt`; if so, reset counter to 0 and update `weeklyScanResetAt`.

---

### MEDIUM-3: Redundant scan data in AsyncStorage (dual persistence)

**File**: `apps/mobile/src/state/useOkyoStore.ts:415`

**Root Cause**
`partialize` persists both `latestScanSession` (full object containing all recipes) AND separate flat fields (`latestScanRecipes`, `latestScanRecipe`, `latestScanResult`, `selectedScanImage`, `latestScanStatus`). The same data is stored twice per scan.

**Impact**
- Each scan session adds ~50-100KB to AsyncStorage (3 recipes × 2)
- Only a constant overhead (just the latest scan), not accumulating
- But it doubles the scan-related serialization cost

**Affected Files**
- `apps/mobile/src/state/useOkyoStore.ts`

**Fix**
Remove flat fields from `partialize` and derive them from `latestScanSession` on rehydration. Or remove `latestScanSession` from `partialize` if flat fields cover all needed data.

**Note**: Changing the persisted shape requires a Zustand persist migration to avoid stale/undefined state on upgrade.

---

### MEDIUM-4: Open CORS policy

**File**: `apps/api/src/server.ts:70`

```typescript
app.use(cors());
```

**Root Cause**
`cors()` with no options allows all origins (`Access-Control-Allow-Origin: *`). Any web page can make cross-origin requests to the API.

**Impact**
For a mobile-first API, CORS does not protect against mobile clients (React Native doesn't send `Origin` headers). However, it does allow browser-based CSRF and credential phishing if the API is ever accessed from web contexts.

**Low priority** for a mobile-only app at launch.

**Fix**
Restrict to known origins: `cors({ origin: ['https://okyo.app', 'https://staging.okyo.app'] })`.

---

### LOW-1: `leaderboardEntries` initialized with static mock data

**File**: `apps/mobile/src/state/useOkyoStore.ts:175`

```typescript
leaderboardEntries: mockLeaderboardEntries,
```

**Root Cause**
Leaderboard is seeded with fake data (e.g., "TopChef_NYC", "Foodie_London") and never updated from a real API. Every user sees the same fictional leaderboard indefinitely.

**Impact**
Users see a fake leaderboard. Not a reliability issue — a feature gap.

---

### LOW-2: `pending` scan status survives app kill

Previously documented in BREAK_REPORT.md. No normal navigation path reaches the stuck state. Cosmetic only.

---

### LOW-3: API in-memory store lost on restart

`apps/api/src/store.ts` uses in-memory arrays. Server restart loses all saved recipes, challenges, XP events, and rankings. The mobile app is local-first (saves to AsyncStorage), so this only affects the scaffolded API-side data. Not a mobile UX issue.

---

## Action Summary

| ID | Action | Priority |
|----|--------|----------|
| C1 | Replace hardcoded IP with `EXPO_PUBLIC_OKYO_API_URL` | **BEFORE LAUNCH** |
| M1 | Cap `awardedXpEvents` at 5,000 entries | Before launch (easy, safe) |
| M2 | Add weekly reset logic to `weeklyScanCount` | Nice to have |
| M3 | Remove dual persistence (requires migration) | Post-launch |
| H1/H2 | Redis rate limiting + API auth | Post-launch |
| M4 | CORS origin restriction | Post-launch |
| L1-L3 | Accepted as known limitations | Post-launch |
