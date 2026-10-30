# Okyo image-loading audit

## Scope and current pipeline

The mobile app has four image paths:

1. **Bundled static assets**: Metro-compatible literal `require()` calls in
   `assets/food/index.ts`, `src/assets/*`, and the onboarding registries. These
   cover recipe photos, Kiko artwork, meal icons, onboarding artwork, action
   icons, and app chrome.
2. **Remote recipe images**: recipe `imageUrl`/`imageUri` values are normalized
   by `src/utils/recipeImageSource.ts` and rendered by `FoodImage` on Home,
   category, Grocery, Liked, and recommendation cards.
3. **User/device files**: camera and photo-library URIs are persisted in the
   managed scan-image directory and rendered directly by scan, result, share,
   and onboarding screens.
4. **Generated/API recipe images**: API results may contain a remote URL or a
   persisted local URI. The canonical recipe state preserves both fields;
   there is no separate generated-image bundle.

## Findings

- A static scan of 538 TypeScript/TSX files found **zero missing relative
  `require()` targets**. The registries use literal paths, so the common
  dynamic-`require()` Metro failure is not present.
- The asset tree contains 427 image files. **All 64 files in
  `assets/food/recipes/` have JPEG bytes but a `.png` extension**. Metro and
  iOS therefore receive a PNG asset path with JPEG content. This is the primary
  deterministic cause of recipe-card failures and explains why the problem is
  especially visible on Home/category/Grocery/Library surfaces.
- `FoodImage` currently works around the mismatch by resolving every numeric
  recipe asset through Metro and asynchronously downloading it into the Expo
  cache with a `.jpg` name during render. That introduces an extra network
  request, a race with component unmounts, cache dependence, and a prolonged
  loading state. A stale or unavailable Metro response can leave the image
  invisible until the fallback path fires.
- Most onboarding and Kiko artwork is rendered directly with `expo-image`.
  Those call sites do not share an error handler, loading state, or fallback.
  A failed local or remote request can therefore leave a blank frame even
  though the surrounding layout rendered correctly.
- Scan previews, result previews, share cards, and a few profile/empty states
  render React Native `Image` directly from a URI or literal asset and also do
  not share failure diagnostics or a deterministic fallback.
- `src/utils/recipeImageSource.ts` rejects malformed/unsupported URI strings,
  which is good, but it does not validate URL structure, network reachability,
  HTTP responses, or loading completion. Remote failures are handled only by
  the current `FoodImage` primary-image `onError`.
- `apps/mobile/metro.config.js` is absent, so the app uses Expo's default Metro
  resolver. `babel.config.js` uses the standard Expo preset and Reanimated
  plugin; no asset resolver override is involved. Expo 55 / React Native 0.83
  dependencies are aligned in the lockfile.
- There is currently one Metro process listening on port 8081, with its
  working directory set to `apps/mobile`. The dev server reports healthy.
  Multiple Metro instances or a wrong working directory were not observed in
  this run, but stale Metro output can amplify the extension mismatch.
- No case-sensitive missing paths were found by the static resolver scan.
  The validator added with this fix will make that check repeatable in CI/dev.
- Static asset dimensions and decodability are not currently checked by an
  npm script. Existing image tests mostly inspect source wiring rather than
  exercising failure transitions.

## Reproduction matrix

Before editing, the running iPhone 17 Pro build was inspected with the single
Metro instance above. A fresh launch rendered the onboarding shell, while
static analysis reproduced the food-asset mismatch in all 64 recipe photos.
The remaining runtime matrix (cold Metro, cache-cleared Metro, Fast Refresh,
offline remote request, and web if enabled) is covered after the centralized
resolver and validator are implemented. The fix will preserve dimensions and
provide a visible fallback for every failure instead of leaving a blank frame.

## Recommended solution

Use one `ResilientImage` component and one source resolver for all app-owned
image surfaces. It should accept a literal local module or validated URI,
keep the frame mounted while loading, switch once to a deterministic bundled
fallback on error, and emit development-only diagnostics containing the asset
key/URL, component, reason, fallback, platform, and environment. Keep the
existing visual styles and `resizeMode`/`contentFit` values at each call site.

Add a development/test asset validator that extracts literal `require()`
references, resolves paths case-sensitively, checks supported image signatures,
detects duplicate/empty registry keys, and reports the food JPEG/PNG mismatch.
The validator should run as `npm run validate-assets` and fail before a broken
local asset can reach Metro.
