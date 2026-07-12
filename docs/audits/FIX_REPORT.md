# Fix Report

Branch: `scan-realism-v2`
Fixes applied after: BREAK_REPORT.md

---

## HIGH Fix — Scan image cleanup on session end

**Issue**: Every camera/upload scan permanently wrote a file to `NSDocumentDirectory/okyo-scan-images/`. If the user scanned but didn't save, the file was never deleted. Storage grew unboundedly.

**Fix**

Two changes in `apps/mobile/src/state/useOkyoStore.ts`:

1. `beginLatestScanSession()` — before replacing the active session, captures the outgoing `selectedScanImage.uri` and calls `deleteUnusedScanImage()` after the state update.

2. `clearLatestScan()` — same pattern. Captures the outgoing URI and deletes it if no saved recipe references it.

Two new helper functions added (private, no exports):

- `getScanImageUriForCleanup(state)` — extracts the Documents-dir scan image URI from state. Returns `undefined` if no URI, if the image is a placeholder, or if the URI is not in `/okyo-scan-images/` (i.e., not our file).

- `deleteUnusedScanImage(uri, savedRecipes)` — checks all saved recipes; if any has `imageUri === uri`, skips deletion (the user saved the scan and still needs it). Otherwise deletes asynchronously with `FileSystem.deleteAsync(..., { idempotent: true })`.

**Triggers**

Cleanup fires when:
- User taps "Scan Again" or "Back to Scan" → `clearLatestScan()`
- User starts a new scan → `beginLatestScanSession()` replaces the old session

Cleanup does NOT fire for:
- `writeSavedRecipeContext()` — opening a saved recipe does not abandon a new scan image
- `removeSavedRecipe()` — existing cleanup for saved recipe deletion is unchanged
- `clearSavedData()` — deletes the entire `/okyo-scan-images/` directory, which covers everything

**Verified safe edge cases**

| Scenario | Outcome |
|----------|---------|
| User saves recipe, then scans again | First scan's `imageUri` in savedRecipes → NOT deleted |
| User scans, taps "Scan Again" | No saved recipe references URI → file deleted ✓ |
| User scans, backgrounds app, returns, scans again | `beginLatestScanSession` triggers cleanup of first scan URI ✓ |
| Demo scan (placeholder) | `getScanImageUriForCleanup` returns `undefined` → no-op ✓ |
| Non-Documents URI (remote URL, cache URI) | `includes('/okyo-scan-images/')` fails → no-op ✓ |
| `FileSystem.deleteAsync` fails | Caught, logged as `okyo_scan_image_cleanup_failed`, no crash ✓ |

**Files changed**

- `apps/mobile/src/state/useOkyoStore.ts`

---

## MEDIUM Fix — Non-deterministic starter recipe IDs

**Issue**: `createStarterRecipesFromScan()` generated recipe IDs from `dishName + mode` only (e.g., `scan-starter-chicken-tikka-masala-restaurant-copy`). Scanning the same dish twice produced the same ID. The second save silently replaced the first scan's photo URI on the saved recipe.

**Fix**

`createStarterRecipesFromScan()` now accepts `scanSessionId` as a parameter and passes it to `createStarterRecipeFromScan()`. The recipe ID becomes:

```js
id: `scan-starter-${slugify(dishName)}-${slugify(mode)}-${scanSessionId.slice(-8)}`
```

The 8-char suffix is the random component of the scan session ID (`scan-camera-{timestamp}-{random6}`). Two scans of the same dish produce different IDs, so each starter recipe is treated as a distinct save.

**Files changed**

- `apps/mobile/src/screens/ScanScreen.tsx`

---

## TypeScript

```
cd apps/mobile && npx tsc --noEmit
```

Exit code 0. No errors after both fixes.
