# Cold Restart Report

## Simulation: scan → save → kill app → restart → open library

### Before fix

```
1. User scans burger photo
2. ImageManipulator writes JPEG to:
   file:///var/mobile/.../Caches/ExponentExperienceData/{appId}/scan-1234.jpg
3. URI stored in recipe.imageUri via Zustand → AsyncStorage
4. User saves recipe → savedRecipes[0].imageUri = cache URI
5. User kills app
6. OS may or may not clear NSCachesDirectory under storage pressure
7. App restarts → AsyncStorage rehydrated → recipe.imageUri = cache URI (string intact)
8. LibraryScreen: getRecipeImageUrl(recipe) = cache URI
9. FoodImage source={{ uri: cache URI }} → file not found → renders Spark fallback
10. User sees blank image with no explanation
```

**Failure point**: step 9. The URI string survived but the file it points to did not.

### After fix

```
1. User scans burger photo
2. ImageManipulator writes JPEG to:
   file:///var/mobile/.../Caches/ExponentExperienceData/{appId}/scan-1234.jpg
3. copyToDocuments() copies file to:
   file:///var/mobile/.../Documents/okyo-scan-images/scan-1718000000000.jpg
4. ScanImageMetadata.uri = permanent URI
5. URI stored in recipe.imageUri via Zustand → AsyncStorage
6. User saves recipe → savedRecipes[0].imageUri = permanent URI
7. User kills app
8. NSDocumentDirectory is NEVER cleared by the OS
9. App restarts → AsyncStorage rehydrated → recipe.imageUri = permanent URI
10. LibraryScreen: getRecipeImageUrl(recipe) = permanent URI
11. FoodImage source={{ uri: permanent URI }} → file found → renders user's food photo
```

**Failure point**: eliminated.

## Failure modes (remaining)

| Scenario | Behavior |
|----------|----------|
| User deletes app data manually | Files deleted, images lost. Expected behavior. |
| User uninstalls and reinstalls app | All data lost including images. Expected behavior. |
| `copyToDocuments` fails (device full) | Falls back to original cache URI. Logs error. Session works, cold restart may not. |
| iOS storage pressure BEFORE save | Original cache file could be deleted before copy completes. Race condition is extremely narrow (milliseconds). |

## File path example

```
Permanent: file:///var/mobile/Containers/Data/Application/{UUID}/Documents/okyo-scan-images/scan-1718000000000.jpg
Cache:     file:///var/mobile/Containers/Data/Application/{UUID}/Library/Caches/ExponentExperienceData/{appId}/scan-1234.jpg
```

The Documents path is backed up by iCloud (if enabled) and never cleared by the OS.
