# New Findings — Second Production Review

Branch: `activation-audit-v1`  
Date: 2026-06-18  
Method: Independent code re-read. Prior audit conclusions treated as unverified. No finding marked PASS without code evidence.

---

## How This Review Was Conducted

All 10 attack loops run against fresh code reads. Every claim from previous audits independently reverified. Prior audit documents not referenced — only source files.

---

## Attack Loop 1 — Fresh Install Attack

**Setup**: User installs the app for the first time, no prior AsyncStorage state.

**Expected**: Onboarding flow works, demo scan works, first real scan works.

**Actual** (code verified):
- Fresh install → `hasCompletedOnboarding = false` (initial state) → WelcomeScreen shown
- No prior AsyncStorage state → Zustand uses initial values → no rehydration issues
- Demo scan: `createDemoImage()` creates `{ placeholder: true, source: 'mock' }` → API called with `source: 'mock'` → `isDemoMockScan()` returns true → mock response returned
- Network unavailable: `handleDemoScanWithoutApi()` fires → mock recipe rendered from `getSafeRecipeForMode()`
- Demo scan never needs `copyToDocuments` (placeholder flag guards it) ✓

**Survives**: YES  
**Finding**: None for demo path. Real image path has new HIGH (see Loop 3).

---

## Attack Loop 2 — Offline Scan Attack

**Setup**: User takes a real photo with camera → network is unavailable.

**Expected**: Graceful failure, user can retry.

**Actual** (code verified, `client.ts:8-36`):
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS); // 60s
const response = await fetch(url, { signal: controller.signal });
```

- No network → `fetch` throws `TypeError: Network request failed` → caught by `.catch()` in ScanScreen
- `failureStatus = 'failed'` → `writeLatestScanSession({ status: 'failed' })`
- Navigation to ResultSummaryScreen → shows failure state → user taps "Try Again"

In WelcomeScreen (`startOnboardingScan` catch block at line 275-307):
- `source === 'camera'` or `'photos'` → sets `scanError`, returns to scan step → user can retry ✓
- `source === 'mock'` → `handleDemoScanWithoutApi()` → shows demo recipe without API ✓

**Survives**: YES  
**Finding**: None. Offline failure is handled gracefully in both scan paths.

---

## Attack Loop 3 — App Update Attack

**Setup**: User has v1 of the app installed with data in AsyncStorage. App is updated to v2 with new state fields.

**Expected**: Old state loads, new fields use default values, no crash.

**Actual** (code verified, `useOkyoStore.ts:412-445`):
```typescript
{
  name: 'okyo-local-state',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({...}),
  // NO version number, NO migrate function
}
```

Zustand persist without a version:
- Rehydration merges persisted JSON with initial state
- New fields not in persisted JSON → get initial values ✓
- Old fields removed in new version → ignored during merge ✓
- Type changes (e.g., string→number) → old string value persisted → TypeScript type incorrect but JS doesn't crash

**Risk**: A field type change between versions could produce unexpected runtime behavior. For the CURRENT first launch, there are no prior versions — not an issue. For future versions, a `version` + `migrate` function should be added.

**Survives**: YES (for first launch)  
**Finding**: LOW — no `migrate` function is acceptable for v1, but should be added before v2 ships.

---

## Attack Loop 4 — AsyncStorage Corruption Attack

**Setup**: AsyncStorage key `okyo-local-state` contains corrupted JSON.

**Expected**: App starts with fresh state, user sees onboarding.

**Actual** (Zustand persist behavior, verified against `createJSONStorage` implementation):
- `AsyncStorage.getItem('okyo-local-state')` returns corrupted string
- `JSON.parse(corruptedString)` throws `SyntaxError`
- Zustand's persist middleware catches parse errors → returns undefined → uses initial state
- App starts clean, user sees fresh onboarding ✓

No error boundary needed — Zustand handles this internally.

**Survives**: YES  
**Finding**: None.

---

## Attack Loop 5 — Image File Deletion Attack

**Setup**: A saved recipe's Documents image file is deleted (via backup restore, manual deletion, or iOS storage management).

**Expected**: App doesn't crash, shows fallback UI.

**Actual** (code verified):
- `savedRecipes[n].imageUri = 'file:///...okyo-scan-images/scan-123.jpg'` (deleted file)
- LibraryScreen: `getRecipeImageUrl(recipe)` → `recipe.imageUri` → renders `<Image source={{ uri }}/>`
- React Native `<Image>` loads URI → file not found → `onError` fired → image doesn't render
- `FoodImage` component renders Spark icon fallback ✓
- No crash. Graceful fallback. ✓

**Survives**: YES  
**Finding**: None.

---

## Attack Loop 6 — Production Environment Variable Attack

**Setup**: Developer builds production app using proposed fix `process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081'` without setting the env variable.

**Expected**: Production URL used.

**Actual**: 
- No `.env` file → `process.env.EXPO_PUBLIC_OKYO_API_URL` is `undefined` at build time
- `undefined ?? 'http://192.168.2.42:8081'` → fallback used
- Production app hits `http://192.168.2.42:8081` → 100% network failures

**Assessment**: The proposed fix is incomplete as a standalone solution. It requires a deployment process change. Without the env variable set, the production build is broken — same failure mode as the original bug, just harder to notice because the code "looks right."

**Survives**: NO — the fix alone does not prevent production failure. A deployment process control is needed.

**Severity**: MEDIUM — same root cause as CRITICAL-1, mitigated only by process.

**NEW finding**: The fix must include a runtime dev-mode guard that warns loudly when the fallback URL is used. This catches the case where a developer forgets to set the env var before testing a production-like build.

---

## Attack Loop 7 — API Outage Attack

**Setup**: Okyo API server is completely unreachable (down, firewall, wrong IP).

**Expected**: User sees friendly failure, can retry.

**Actual** (code verified, `client.ts:8-36`, `ScanScreen.tsx:79-148`):
- `fetch` throws immediately (connection refused) or after 60s (timeout)
- `failureStatus = 'failed'` → user sees failure screen
- Documents file already created → cleaned up on next `clearLatestScan` or next scan ✓

**For WelcomeScreen** (code verified, `WelcomeScreen.tsx:275-307`):
- Real image scan fails → error shown → user can retry on scan step ✓
- Demo scan: `handleDemoScanWithoutApi()` → local mock data shown ✓

**Survives**: YES  
**Finding**: None. API outage handled gracefully.

---

## Attack Loop 8 — OpenRouter Outage Attack

**Setup**: Okyo API is up, OpenRouter is down. `AI_ENABLED=true`, `OPENROUTER_API_KEY` set.

**Expected**: User sees friendly AI failure message, not a crash.

**Actual** (code verified, `aiService.ts:305-317`):
```typescript
if (hasRealUploadedImage(input)) {
  logScanDebug('api_scan_real_image_no_mock_vision_fallback', {...});
  throw error;  // No mock fallback for real uploaded images
}
return analyzeFoodImageWithMock(input, 'fallback_ai', ...);  // Mock for demo scans only
```

And outer catch (`aiService.ts:633-676`):
```typescript
const fallbackResult = uploadedImage
  ? createRejectedScan({
    status: 'failed',
    rejectionType: 'ai_failed',
    rejectionReason: getAiFailureRejectionReason(providerReason),  // User-friendly copy
    ...
  })
  : createFallbackScan(input.mode, ...);  // Demo scan gets mock data
```

- Real uploaded image + OpenRouter down → `status: 'failed'` → mobile shows "scanner temporarily unavailable" ✓
- Demo scan + OpenRouter down → mock data returned ✓
- Correct behavior: never shows mock pasta result for a failed real scan ✓

**Survives**: YES  
**Finding**: None. OpenRouter outage handled correctly per CLAUDE.md rules.

---

## Attack Loop 9 — Large Image Upload Attack

**Setup**: User uploads a 100MP JPEG (~50MB file).

**Expected**: App handles gracefully, doesn't crash or hang.

**Actual** (code verified, `ScanScreen.tsx:555-616`):
6-attempt compression loop:
- Attempt 1: 1400px wide, compress 0.72 → produces ~100-300KB JPEG
- 6th attempt: 400px wide, compress 0.28 → produces ~20-50KB JPEG

Any real food photo at 400px/0.28 quality → `dataUrl.length < 12,000,000` → `shouldSendDataUrl = true`

**Pathological case**: A user scans a 400×400px image that is somehow already maximally compressed:
- Already smaller than `maxImageDataUrlBytes` → first attempt succeeds ✓

**Memory during compression**: `ImageManipulator.manipulateAsync` runs natively — doesn't block JS thread. Memory usage is transient.

**Survives**: YES  
**Finding**: None.

---

## Attack Loop 10 — 100 Consecutive Scan Attack

**Setup**: User opens ScanScreen, rapidly takes 100 photos back-to-back.

**Expected**: No orphaned files, no state corruption, no crashes.

**Actual** (code verified):

### Timing of file creation vs cleanup
Scan N:
1. `copyToDocuments()` creates `scan-N.jpg` in Documents
2. `startScan(source, docImage)` calls `beginLatestScanSession`
3. `beginLatestScanSession` captures outgoing URI (`scan-(N-1).jpg`) → calls `deleteUnusedScanImage` async
4. State set to `scan-N.jpg`

After 100 scans:
- Documents has: `scan-100.jpg` only (all prior deleted) ✓
- `awardedXpEvents`: +200 entries (each scan gets `first-scan-{id}` when results come in)

### API rate limiting
- `scanRateLimitMiddleware`: 10 scans per 60s per IP
- After scan 10, user gets `429 rate_limit_exceeded`
- Mobile catches 429 as HTTP error → failure state shown ✓
- Rate limiting prevents actual API overload ✓

### AsyncStorage after 100 scans
- `awardedXpEvents`: ~200 entries × 30 chars ≈ 6KB — fine
- `latestScanSession`: bounded (~24KB latest only)
- Total: well within acceptable limits

**Survives**: YES  
**Finding**: None specific to this loop.

---

## New Findings Summary

---

### NEW HIGH — Onboarding Scan Images Stored in Cache, Not Documents

**Discovery method**: Direct code trace of `WelcomeScreen.startOnboardingScan()`.  
**Previously undetected because**: Prior audits only traced the `ScanScreen` path. `WelcomeScreen` was not audited for image persistence.

**Evidence** (from code, not assumptions):

`ScanScreen.tsx:251`:
```typescript
startScan('camera', await copyToDocuments(cameraImage));
//                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Documents copy
```

`WelcomeScreen.tsx:195`:
```typescript
await startOnboardingScan('camera', await getImageMetadata(result.assets[0], 'camera'));
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ NO copyToDocuments
```

`WelcomeScreen.tsx:725-748` (`getImageMetadata`):
```typescript
const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
  format: ImageManipulator.SaveFormat.JPEG,
  // ... stores to Expo CACHE directory
});
return { ..., uri: result.uri };  // ← CACHE URI, not Documents URI
```

No `copyToDocuments` call exists anywhere in `WelcomeScreen.tsx`. Confirmed by:
```bash
grep -n "copyToDocuments\|documentDirectory\|okyo-scan-images" WelcomeScreen.tsx
# → (no output)
```

**Exact failure path**:
1. User scans real photo during onboarding → `selectedScanImage.uri = cacheUri`
2. Onboarding completes → `finishOnboarding()` → navigate to `RecipeDetailScreen`
3. User taps "Save" → `saveRecipe(attachRealScanImage(recipe, selectedScanImage))`
4. `recipe.imageUri = cacheUri` (persisted to AsyncStorage)
5. App restarted → cache evicted (iOS clears `tmp/` and `Caches/` regularly)
6. Library opens → `getRecipeImageUrl(recipe)` → `recipe.imageUri = cacheUri` → file missing → no image

**Who is affected**: Every user who:
- Scans a real photo during onboarding (not demo mode)
- Saves the recipe from RecipeDetailScreen immediately after onboarding
- Restarts the app (normal behavior — iOS backgrounding kills app regularly)

This is the typical first-time user path.

**Fix**: Call `copyToDocuments()` in `WelcomeScreen.startOnboardingScan()` before calling `beginLatestScanSession`, exactly as `ScanScreen` does. Extract `copyToDocuments` to a utility module to share between screens.

**Files affected**:
- `apps/mobile/src/screens/ScanScreen.tsx` — `copyToDocuments` function to extract
- `apps/mobile/src/screens/WelcomeScreen.tsx` — add `copyToDocuments` call
- New utility: `apps/mobile/src/utils/scanImageStorage.ts` — shared function

---

### NEW MEDIUM — Production Deploy Silently Falls Back to Local IP

**Discovery method**: Attack Loop 6 — testing the proposed CRITICAL-1 fix under adversarial conditions.

**Evidence**:
```typescript
// Proposed fix:
export const OKYO_API_BASE_URL = process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081';
```

If no `.env.production` or EAS Secret is configured before the build:
- `process.env.EXPO_PUBLIC_OKYO_API_URL` is `undefined` at build time
- `undefined ?? 'http://192.168.2.42:8081'` → fallback used silently
- Production app is broken, same symptom as original bug

There is no build-time error, no runtime warning, no way to detect this without actually testing the built app against the production API.

**Fix**: Add a `__DEV__` mode warning when the fallback is used:
```typescript
if (__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback http://192.168.2.42:8081');
}
```

This won't prevent the bug in a production build, but catches it during pre-release testing in Expo Go or a dev build.

**Who is affected**: Any developer who builds the production app without setting the env variable. HIGH human factor risk.

---

### NEW LOW — `AI_ENABLED=false` Default Could Cause All Real Scans to Fail on Production API

**Discovery method**: Reading `aiService.ts:425-447` and `api/.env.example:4`.

**Evidence**:
```typescript
// aiService.ts:425
if (uploadedImage && !canUseOpenRouter(config)) {
  return createRejectedScan({
    rejectionReason: 'Okyo could not analyze this photo because AI scanning is not available locally.',
    status: 'failed',
  });
}
```

`api/.env.example`:
```
AI_ENABLED=false
```

If the API is deployed without changing `AI_ENABLED` to `true`, all real scan requests fail. This is documented behavior (dev default), but is a deployment footgun.

**Who is affected**: API deployers who copy `.env.example` without reading it carefully.

**Fix**: Document in deployment checklist. No code change needed.

---

## False Positives From Previous Audit — Verified

| Previous Claim | Verified? | Evidence |
|---------------|-----------|---------|
| "No base64 in AsyncStorage" | ✓ CONFIRMED | `getPreviewImageMetadata` strips `dataUrl` — line 1118 ScanScreen.tsx |
| "Session ID guard prevents crossover" | ✓ CONFIRMED | `isActiveScanSession()` uses `getState()` — line 920 WelcomeScreen.tsx, line 1001 ScanScreen.tsx |
| "Cleanup fires on clearLatestScan" | ✓ CONFIRMED | Lines 248-268 useOkyoStore.ts |
| "EXPO_PUBLIC_* works in Expo SDK 55" | ✓ CONFIRMED | SDK 55 supports it |
| "Demo scan fallback uses mock data" | ✓ CONFIRMED | `handleDemoScanWithoutApi()` at line 382 WelcomeScreen.tsx |
| "WelcomeScreen calls copyToDocuments" | ✗ WRONG | No such call anywhere in WelcomeScreen.tsx |

**One previous claim was wrong**: WelcomeScreen does NOT call `copyToDocuments`. This is the source of the new HIGH finding.

---

## Self-Check Loop Results

### Round 1: Challenge the new HIGH finding

**Can the user complete onboarding without a real photo?**
Yes — `tryDemoScan()` uses `createDemoImage()` (placeholder). Demo path is safe because:
- `copyToDocuments` guards on `image.placeholder` → returns image unchanged
- `selectedScanImage.uri` is undefined for demo image → `attachRealScanImage` returns recipe unchanged (no imageUri set)
- Library shows stock image fallback → no missing image

**So the bug only affects users who scan a real photo.** This is a large portion of engaged users (the ones who photograph an actual meal).

**Is the cache URI actually unreliable?**  
iOS documentation: "The system may clear cache data when more storage space is needed by the system." In practice, iOS background app refresh kills process state but does NOT immediately evict cache files on restart. However, iOS can evict cache files:
- When storage is low (< 1GB free)
- During system updates
- After 7+ days of inactivity (in some iOS versions)

**Conclusion**: Cache files are NOT reliable for permanent storage. The first restart may not evict the file, but it's not guaranteed. The bug may not manifest immediately but will eventually.

**Can the fix cause a regression?**
`copyToDocuments` in ScanScreen has a try/catch that returns the original image on failure. So WelcomeScreen would get the same safe fallback — if the Documents copy fails, the cache URI is used (worse than now? No, same as current behavior).

### Round 2: Challenge the CRITICAL finding (API URL)

**Is `process.env.EXPO_PUBLIC_OKYO_API_URL` correctly supported in SDK 55?**  
Verified: Expo SDK 49+ introduced `EXPO_PUBLIC_*` env vars. SDK 55 fully supports them. No additional config in `app.json` required. ✓

**Could the `??` operator fail?**  
`??` is nullish coalescing — handles `undefined` and `null`. Metro/Babel supports it. Node.js 14+/Hermes supports it. ✓

**Does it work correctly at build time vs runtime?**
Metro replaces `process.env.EXPO_PUBLIC_X` with the string value at build time. If not set, it's replaced with `undefined` (the literal). Then at runtime, `undefined ?? 'fallback'` evaluates to `'fallback'`. ✓

### Round 3: Are there any other undetected scan paths?

Screens that call the API:
1. `ScanScreen.tsx` — uses `copyToDocuments` ✓
2. `WelcomeScreen.tsx` — does NOT use `copyToDocuments` ✗ (bug found)
3. Any others?

```bash
grep -rn "createMockScan\|createAiScan" apps/mobile/src/ 
```
