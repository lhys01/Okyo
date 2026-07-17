# Okyo V1 product contract

Okyo is a deliberately small AI cooking companion. A user starts from a food photo or written idea, gets an honest inspired-by recipe, saves it if useful, builds one grocery list, cooks with guidance, and shares the result.

## Primary product

The app has exactly four tabs, in order: Home, Grocery, Saved, Settings. Home begins with Take a photo, Upload a photo, and Write a food idea. Scan processing, recipe details, guided cooking, and sharing are internal steps—not additional product destinations.

Recommendations use only real generated or saved recipes. Empty states are preferable to fabricated personalization. Saved contains only recipes the user intentionally saved. Grocery combines ingredients only when names and units are safely compatible.

## Brand and experience

Okyo is cute, warm, clear, food-focused, and confident without feeling corporate. Kiko carries emotion at useful moments. The app prioritizes a fast first recipe and readable one-handed cooking controls.

AI behavior stays honest: non-food, unclear photos, timeouts, malformed output, and provider failures remain failures with a retry path. Recipes are inspired-by, never represented as official restaurant recipes. Nutrition is explicitly estimated and may be unavailable for legacy recipes.

## Not part of V1

No gamification, rewards, public profiles, social feed, discovery catalog, restaurant packs, meal planning, price comparison, savings claims, commerce, subscription UI, or placeholder settings. Future work must not appear until it has real data, a working destination, honest failure states, and validation.

## Accessibility

Use at least 44-point touch targets, resilient text layouts, meaningful accessibility roles/states, and system font scaling. Reduce Motion must suppress nonessential animation. Camera, photo-library, native-share, and large-text behavior require physical-device validation before release.
