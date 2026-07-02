# Image Storage Strategy

Branch: `feature/scan-image-persistence-hardening`

## Storage Locations

| Location | iOS Path | Cleared by OS? | Backed up by iCloud? |
|----------|----------|----------------|----------------------|
| `expo-image-manipulator` output (before fix) | `NSCachesDirectory` | Yes, under pressure | No |
| `copyToDocuments()` output (after fix) | `NSDocumentDirectory/okyo-scan-images/` | Never | Yes (if enabled) |
| AsyncStorage (recipe.imageUri string) | `NSDocumentDirectory` (Expo managed) | Never | Yes |

## Write Path

```
expo-image-manipulator → NSCachesDirectory (temp)
    ↓
ScanScreen.copyToDocuments()
    ↓
NSDocumentDirectory/okyo-scan-images/scan-{timestamp}.{ext}
    ↓
ScanImageMetadata.uri = permanent URI
    ↓
Zustand state → AsyncStorage
```

## File Naming

```
Pattern: okyo-scan-images/scan-{Date.now()}.{ext}
Example: okyo-scan-images/scan-1718000000000.jpg
```

`Date.now()` gives millisecond precision. Two scans in the same millisecond would overwrite — but the picker/camera flow is synchronous before this call, so collision is not possible in normal use.

Extension is `png` if `image.mimeType === 'image/png'`, otherwise `jpg`.

## Copy Failure Handling

`copyToDocuments()` wraps all operations in try/catch:
- Directory creation failure → returns original URI (cache)
- File copy failure → returns original URI (cache)
- Logged as `okyo_scan_image_persist_failed` in `__DEV__`

The session proceeds with the cache URI. The scan works. Cold restart may not.

## Storage Growth

Scan images accumulate in `NSDocumentDirectory/okyo-scan-images/`. Files are never automatically deleted.

**Current cleanup**: none implemented.

**Known gap**: `removeSavedRecipe()` and `clearSavedData()` in `useOkyoStore.ts` do not delete image files. A separate task exists to add `FileSystem.deleteAsync` calls to those functions.

**Estimation**: a typical scan image after ImageManipulator processing is 150–400 KB. 100 scans = ~30 MB. Acceptable for most users but should be cleaned up.

## Demo / Mock Scans

`copyToDocuments()` checks `image.placeholder` first:
```typescript
if (image.placeholder || !image.uri || !FileSystem.documentDirectory) return image;
```

Demo scans (source='mock') use `createPlaceholderImage('mock')` which sets `placeholder: true`. The copy step is skipped entirely. Demo behavior is unchanged.

## Validation

`imageValidation.ts:getStorageLocation(uri)` classifies URIs:
- `/Documents/` → `'documents'` (durable)
- `/Caches/` → `'cache'` (not durable)
- `https://` → `'remote'` (not local)
- `file://` without known path → `'unknown'`

`imageValidation.ts:checkImageFileExists(uri)` calls `FileSystem.getInfoAsync()` to confirm the file is actually present on disk. Result is included in `imageTraceLog` output.
