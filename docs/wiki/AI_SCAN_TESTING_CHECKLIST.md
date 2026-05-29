# AI Scan Testing Checklist

Use this checklist when testing Okyo's real food image upload, OpenRouter AI scanning, generated recipes, rejected/non-food states, partial scan states, mock/demo scan behavior, share cards, saved recipes, grocery lists, and local state.

Keep testing safe and honest: real uploaded image failures should never show fake mock pasta, and the mock Spicy Vodka Rigatoni result should only appear in explicit demo/mock mode.

Related QA docs:

- [Beta Testing Checklist](./BETA_TESTING_CHECKLIST.md)
- [Known Issues](./KNOWN_ISSUES.md)

The main beta loop to prove is:

```text
Upload Photo -> Result -> View Recipe -> Share -> Save -> Grocery List
```

## Local Setup

Run the API and mobile app in two separate terminals.

### Terminal 1: API

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
npm run dev
```

The API runs separately on `localhost:8081`.

### Terminal 2: Mobile

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npx expo start -c --tunnel --port 8082
```

Then press `i` to open the iOS Simulator.

Okyo currently uses Expo tunnel mode for simulator testing because `localhost` and `127.0.0.1` were unreliable in the simulator setup.

If Expo asks for a connection mode, keep tunnel mode. Do not switch beginner QA back to LAN or localhost unless you are intentionally debugging networking.

## Safe Image Rules

For real AI testing:

- Use food photos only.
- Avoid faces, receipts, private backgrounds, home addresses, payment cards, names, order numbers, emails, phone numbers, or any other personal information.
- Do not upload confidential, private, or sensitive images.
- Prefer images you are comfortable using for local QA notes.
- Remember that AI dish names, ingredients, cost estimates, savings estimates, and recipes are approximate.
- Recipes should be treated as copycat-style or inspired-by, never official restaurant recipes.

## Food Image Categories To Test

Run at least one image from each category:

1. Pasta/noodles
2. Pizza
3. Burger/sandwich
4. Salad/bowl
5. Tacos/burrito
6. Sushi
7. Chicken/rice plate
8. Dessert
9. Drink/smoothie
10. Unclear/low-light food photo

## Core Loop Checklist

Run this once with a clear food image and once with a harder image.

- [ ] Upload Photo opens the photo picker and lets you choose a safe food image.
- [ ] Result appears with a dish name, confidence, estimated cost/savings, and clear next actions.
- [ ] View Recipe opens a recipe that matches the result.
- [ ] Share opens a share card or native share path with the correct dish/result.
- [ ] Save adds the recipe to the saved recipe/library state.
- [ ] Grocery List opens with ingredients from the tested recipe.
- [ ] Back navigation keeps the flow understandable.
- [ ] Any failure or partial state gives a friendly retry path.

## Non-Food Tests

Run these tests to confirm Okyo rejects or handles non-food images clearly:

- Flower/leaf
- Object
- Receipt/menu

Do not use receipts or menus that include personal information, payment details, order numbers, names, addresses, phone numbers, or QR codes.

## What To Record For Each Scan

Copy this block once per test image.

```text
Date/time:
Tester:
Device/simulator:
Image type/category:
Food or non-food test:

Status: success / rejected / failed / partial / mock
AI source: OpenRouter / Fallback / Mock / Partial
Dish name:
Confidence:
Recipe generated? yes / no / partial
Savings seemed believable? yes / no / unsure
View Recipe matched the scan? yes / no / not tested
Share Card showed the right image/result? yes / no / not tested
Saved recipe worked? yes / no / not tested
Grocery list worked? yes / no / not tested
Core loop completed? yes / no / partial

What felt good:
What felt confusing or wrong:
Notes/issues:
Screenshot or screen recording saved? yes / no
```

## Pass/Fail Criteria

A test pass means the app behavior is clear, honest, and useful for the tester.

A test fails if the app crashes, gets stuck loading, shows the wrong saved/shared/grocery content, presents estimates as exact, or pretends a failed real image scan succeeded.

### Food Scan Passes When

- A successful food scan shows a generated recipe.
- The dish name is specific enough to be useful and cautious when uncertain.
- The confidence feels reasonable for the image quality.
- The recipe feels cookable and matches the scanned dish.
- Savings and cost estimates feel believable, not exact or overconfident.
- View Recipe opens a recipe that matches the scan result.
- Share Card shows the right scan result and image when available.
- Save and Grocery List use the same recipe from the scan flow.

### Non-Food Scan Passes When

- Non-food images reject clearly instead of pretending to identify food.
- The user sees a friendly retry path.
- The app does not generate a fake food recipe for obvious non-food.

### Failure State Passes When

- A real uploaded image failure does not show mock Spicy Vodka Rigatoni or any other fake successful mock result.
- The app shows a clear friendly failure state.
- Technical provider errors are not shown directly to normal users.
- The tester can retry without restarting the app.

### Partial State Passes When

- A partial result shows the recognized dish or likely food category if available.
- The app is honest that the scan was incomplete or uncertain.
- The user gets a useful retry or starter-recipe path.

### Mock/Demo State Passes When

- Mock Spicy Vodka Rigatoni appears only in explicit demo/mock mode.
- The result is not presented as a real scan of a newly uploaded image.

## Bug Report Format

Use this format when reporting an issue.

```text
Title:

Environment:
- Repo path: /Users/rober/Documents/Okyo-1
- API command: cd /Users/rober/Documents/Okyo-1/apps/api && npm run dev
- Mobile command: cd /Users/rober/Documents/Okyo-1/apps/mobile && npx expo start -c --tunnel --port 8082
- Simulator/device:

Image/test type:
Expected result:
Actual result:
Status shown: success / rejected / failed / partial / mock
AI source shown: OpenRouter / Fallback / Mock / Partial / unknown
Dish name shown:
Confidence shown:

Steps to reproduce:
1.
2.
3.

Screenshots/screen recording attached? yes / no
Personal info removed from screenshots? yes / no
Notes:
```

## After A Test Pass

- Count how many scans were success, rejected, failed, partial, and mock.
- List the top recurring AI mistakes.
- List the top confusing UI moments.
- Confirm no real uploaded image failure showed mock pasta.
- Confirm non-food images rejected clearly.
- Keep any screenshots or notes local unless they contain no personal data.
