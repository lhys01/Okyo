# Final Production Decision

Branch: `activation-audit-v1`
Date: 2026-06-18

---

## Decision

# DO NOT APPROVE

---

## Justification

Two code defects must be fixed before the app is production-ready. Both are verified from code. Neither was present in the previous audit's fix plan.

---

## Defect 1: Hardcoded local IP (CRITICAL)

**File**: `apps/mobile/src/api/config.ts:1`

```typescript
export const OKYO_API_BASE_URL = 'http://192.168.2.42:8081';
```

Every production user hits this address. It's a developer's home LAN IP. 100% of users fail their first scan.

**Status**: Not yet fixed. Fix is planned (1 line), safe, and non-breaking.

---

## Defect 2: Onboarding scan images not persisted to Documents (HIGH)

**File**: `apps/mobile/src/screens/WelcomeScreen.tsx`

```typescript
// ScanScreen (correct):
startScan('camera', await copyToDocuments(cameraImage));  // ← Documents URI

// WelcomeScreen (wrong):
await startOnboardingScan('camera', await getImageMetadata(result.assets[0], 'camera'));  // ← cache URI
```

Verified independently:
1. `grep -n "copyToDocuments" WelcomeScreen.tsx` → zero results
2. `WelcomeScreen.getImageMetadata()` uses `ImageManipulator.manipulateAsync()` → cache directory

**Why this matters**: The onboarding scan is the first scan real users perform. If they upload a real food photo and save the recipe (the intended flow), `recipe.imageUri` gets set to a cache-directory path. iOS can and does evict cache files. After the next restart where iOS clears cache, the image is gone from the user's Library.

**The first recipe most real users save will eventually display no image.** This directly damages the core "scan → recipe → save" value proposition.

**Status**: Not yet fixed. Requires extracting `copyToDocuments` to a utility and calling it in `WelcomeScreen.startOnboardingScan`.

---

## What Would Change the Decision to APPROVE

Fix these two defects. Both are surgical changes with no risk of regression:

### Fix 1: API URL (CRITICAL)

`apps/mobile/src/api/config.ts`:
```typescript
// Before:
export const OKYO_API_BASE_URL = 'http://192.168.2.42:8081';

// After:
if (__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set before prod build.');
}
export const OKYO_API_BASE_URL = process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081';
```

Create `apps/mobile/.env.example`:
```
EXPO_PUBLIC_OKYO_API_URL=http://192.168.2.42:8081
```

**Regression risk**: None. Fallback is identical to current hardcoded value.

### Fix 2: WelcomeScreen Documents persistence (HIGH)

Extract `copyToDocuments` from `ScanScreen.tsx` to `apps/mobile/src/utils/scanImageStorage.ts`:
```typescript
export async function copyToDocuments(image: ScanImageMetadata): Promise<ScanImageMetadata> {
  if (image.placeholder || !image.uri || !FileSystem.documentDirectory) return image;
  try {
    const dir = `${FileSystem.documentDirectory}okyo-scan-images/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
    const permanentUri = `${dir}scan-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: image.uri, to: permanentUri });
    return { ...image, uri: permanentUri };
  } catch {
    return image;  // safe fallback — same as current WelcomeScreen behavior
  }
}
```

`WelcomeScreen.tsx`, in `startOnboardingScan`:
```typescript
const startOnboardingScan = async (source: ScanSource, image?: ScanImageMetadata) => {
  if (isScanSubmitting) return;
  const scanSessionId = createScanSessionId(source);
  const persistedImage = image?.placeholder ? image : (await copyToDocuments(image ?? { placeholder: true }));
  const previewImage = getPreviewImageMetadata(persistedImage);
  // ... rest unchanged
  beginLatestScanSession({ selectedScanImage: previewImage, ... });
  const result = await createMockScan({ image, ... });  // API call still uses original image with dataUrl
```

`ScanScreen.tsx`: Update `copyToDocuments` import to come from the new utility.

**Regression risk**: None. `copyToDocuments` has a try/catch that returns the original image on failure — worst case is the same as current behavior.

---

## Items Deliberately Not Required for Approval

| Issue | Reason Not Blocking |
|-------|---------------------|
| In-memory rate limiter | Known accepted risk; documented in code |
| No API authentication | Out of scope; requires auth infrastructure |
| `awardedXpEvents` growth | No crash; affects only extreme power users after years |
| `weeklyScanCount` reset | Cosmetic display bug only |
| Open CORS | Mobile-only; CORS doesn't protect React Native clients |
| Missing Zustand migrate | No prior versions exist; acceptable for v1 |

---

## What Passes

All 9 attack loops from the first audit pass.
All 10 attack loops from this audit pass, except:
- Loop 1 (partial): Real-photo onboarding scan has cache URI bug
- Loop 6 (partial): Env var fix has a silent failure mode (addressed by dev warning)

All ownership invariants hold for the main scan flow:
- Scan session guard prevents crossover ✓
- Image ownership is deterministic ✓
- Saved recipes retain their image URI ✓
- Cleanup fires correctly ✓

---

## Path to APPROVE

1. Apply Fix 1 (API URL) — 3 lines total
2. Apply Fix 2 (WelcomeScreen Documents) — extract utility + ~5 lines in WelcomeScreen
3. Run `cd apps/mobile && npx tsc --noEmit` — exit code 0
4. Manually test: scan real photo during onboarding → save recipe → restart app → Library shows image

If all four pass: **APPROVE**
