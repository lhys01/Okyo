# Okyo architecture

## Product flow

```text
hero → scan photo → analyze → result → recipe
                                  ├─ save locally
                                  ├─ Make It Mine / Recipe Check
                                  ├─ grocery list
                                  ├─ guided cooking
                                  └─ share scan result
```

The mobile app owns presentation, local saved recipes and food ideas, saved photo copies, grocery interaction state, and lightweight XP. It does not contain a generic recipe catalog or silently substitute demo results for real scan failures.

## Mobile

- Expo / React Native / TypeScript
- React Navigation for the stack and bottom tabs
- Zustand with AsyncStorage for local durable state
- anonymous Supabase authentication for API access
- Expo Image Picker and Image Manipulator for camera/library preparation
- native sharing plus `react-native-view-shot` for scan-result cards

The main tabs are Home, Scan, Grocery, Saved, and Profile. Recipe and cooking-step screens are hidden navigation destinations reached from real recipe context.

## API

- Express / TypeScript / Zod
- OpenRouter for vision and recipe generation
- Supabase JWT verification on the complete `/v1` boundary
- Supabase service-role access for user-scoped scan sessions and generated recipes
- persistent global and per-user provider-attempt quotas
- in-process per-IP scan throttling as an additional development guard

Every generated recipe used for coaching is fetched with the verified user ID. Flexible Recipe Check and Make It Mine inputs have explicit size, item-count, and title bounds.

## AI routing and honesty

OpenRouter is the only always-on provider. The default vision and text model is `openai/gpt-4o-mini`. Provider output is schema validated and passes recipe-quality, ingredient-closure, and platter-coverage checks before delivery.

Fable is a private model route, not a fallback provider. It requires both the environment gate and request header, has a hard maximum of 10 requests per UTC day, and does not fall back to another model after failure.

Food outcomes are explicit:

- clear food: generate a recipe
- food present but uncertain: show an editable best guess
- partial food: explain that the recipe is based on visible evidence
- non-food: reject clearly
- too unclear: request a better photo
- provider/persistence failure: show a friendly retry state

Savings for real scans require a restaurant price entered by the user. Photo-derived restaurant prices are discarded.

## Data lifecycle

- Image data reaches the API only as transient request input and is omitted from API responses and database rows.
- Generated recipes and scan-session metadata are stored in Supabase with user ownership and expiry.
- The mobile app copies a scan photo into its documents directory only when saving a recipe.
- Removing the saved recipe or clearing local data removes app-owned photo copies when no saved recipe references them.
- Logs must never contain API keys or complete base64 images.

## Deferred on purpose

Subscriptions, paywalls, rankings, challenges, restaurant packs, generic recommendations, social feeds, calorie tracking, and image generation are not current product surfaces. Curated discovery, quiet completion rewards, and real post-value subscriptions remain documented product bets rather than rejected ideas. Reintroduce one only with a gated real user flow, data owner, failure state, measurement, and validation plan.
