# Okyo architecture

## Product flow

```text
Home photo/idea → provider processing → result → recipe checkpoint → guided cooking → share
                                          ├─ save
                                          └─ add to consolidated Grocery
```

The mobile app owns the four-tab presentation, local saved recipes/photo copies, bounded recent scan history, grocery interaction state, and cooking progress. The root stack owns scan, idea generation, loading, result, recipe, cooking, and share screens.

## Mobile

- Expo / React Native / TypeScript
- React Navigation root stack plus exactly four bottom tabs
- Zustand with AsyncStorage and a versioned defensive migration
- anonymous Supabase authentication for authenticated API access
- Expo Image Picker/Manipulator for camera, library, and finished-meal photos
- native sharing plus `react-native-view-shot`; generated temporary cards are deleted after use

## API

- Express / TypeScript / Zod
- OpenRouter vision and recipe generation for photos, plus recipe generation for written ideas
- Supabase JWT verification for every `/v1` route
- user-scoped scan/recipe persistence, provider quotas, and per-IP request throttling
- recipe schema, safety, ingredient-closure, platter-coverage, repair, and timeout gates

Fable remains private and opt-in. Both `FABLE_ENABLED=true` and `x-okyo-model: fable` are required; failures remain failures and the code-level daily cap cannot exceed 10.

## Data lifecycle

- Image payloads are transient API inputs and are not stored by the backend.
- Generated photo-scan recipes and scan lifecycle metadata are user-scoped in Supabase.
- Mobile copies a scan photo into app documents only when the recipe is saved.
- Removing a saved recipe or clearing local data removes unreferenced app-owned copies.
- Written ideas are sent to the authenticated provider endpoint and are not stored as a separate local product object.
- Logs must not contain credentials or complete base64 payloads.

See [V1_PRODUCT_MAP.md](V1_PRODUCT_MAP.md) for the before/after route, state, endpoint, flag, event, and asset map.
