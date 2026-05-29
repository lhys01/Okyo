# Known Issues

This page tracks current Okyo testing limitations so QA stays realistic and beginner-friendly.

Related QA docs:

- [Beta Testing Checklist](./BETA_TESTING_CHECKLIST.md)
- [AI Scan Testing Checklist](./AI_SCAN_TESTING_CHECKLIST.md)

## Local Simulator Setup

- Expo tunnel mode is currently the reliable simulator run method.
- `localhost` and `127.0.0.1` were unreliable for simulator testing, so use tunnel mode for the mobile app.
- LAN mode is not the recommended beginner QA path right now.
- Start the API separately on `localhost:8081`:

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
npm run dev
```

- Start the mobile app with Expo tunnel mode on port `8082`:

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npx expo start -c --tunnel --port 8082
```

- Then press `i` for the iOS Simulator.

## Simulator Choice

- The iPhone 17 Pro external display simulator caused confusion during testing.
- Prefer a normal iPhone simulator, such as iPhone 17e, when available.
- If the simulator looks unusual, opens an external display, or does not match normal phone behavior, switch to a standard iPhone simulator before filing app bugs.

## Camera And Upload Testing

- Camera may not work in the iOS Simulator.
- Upload From Photos is the main test path for simulator QA.
- Real-device camera testing may behave differently from simulator testing.
- Use safe food photos only for real AI testing.
- Avoid faces, receipts with personal info, private backgrounds, addresses, payment details, order numbers, and other personal data.

## AI Scan Behavior

- The OpenRouter free model can be inconsistent.
- Recipe generation can return partial or fallback results.
- AI food identification, confidence, ingredients, cost, savings, and recipes are approximate.
- AI estimates are for beta product testing only and should not be treated as nutrition, budget, or restaurant facts.
- Recipes should be treated as copycat-style or inspired-by, not official restaurant recipes.
- Real uploaded image failures should never show mock Spicy Vodka Rigatoni.
- Mock Spicy Vodka Rigatoni should only appear in explicit demo/mock mode.
- If a real scan is unclear, an honest unclear/partial state is better than a confident wrong result.

## Core Loop Risks

The main beta path is:

```text
Upload Photo -> Result -> View Recipe -> Share -> Save -> Grocery List
```

Known things to watch:

- Share/export can be limited by simulator behavior.
- Saved recipes and grocery items are local-only for now.
- Local state can reset after simulator reinstalls, app data deletion, or reset actions.
- Grocery list data should be checked against the recipe because there is no backend account state yet.

## Product And Data Limitations

- There is no database yet.
- There is no auth/login system yet.
- There are no payments or subscriptions yet.
- Images are not permanently stored yet.
- Local state can reset or differ between simulator installs.

These are known limitations, not beta blockers, unless the app copy suggests those features already exist.

## Reporting Notes

When filing bugs, include:

- The simulator/device used.
- Whether the test used Upload From Photos or camera.
- The image category, without attaching private or sensitive images.
- The scan status: success, rejected, failed, partial, or mock.
- The AI source if visible: OpenRouter, Fallback, Mock, Partial, or unknown.
- Screenshots or screen recordings with personal information removed.
