# Beta Testing Checklist

Use this checklist for a simple Okyo beta test pass. You do not need to be technical: tap through the app like a normal user, note anything confusing, and screenshot anything that looks wrong.

Related QA docs:

- [AI Scan Testing Checklist](./AI_SCAN_TESTING_CHECKLIST.md)
- [Known Issues](./KNOWN_ISSUES.md)

The most important beta loop is:

```text
Upload Photo -> Result -> View Recipe -> Share -> Save -> Grocery List
```

## Current Local Run Setup

Run Okyo in two terminals.

### Terminal 1: API

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
npm run dev
```

The API should run on `localhost:8081`.

### Terminal 2: Mobile

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npx expo start -c --tunnel --port 8082
```

Then press `i` to open the iOS Simulator.

Use Expo tunnel mode for beta QA. The simulator setup has been unreliable with `localhost`, `127.0.0.1`, and LAN mode.

## Before You Start

- [ ] Use safe test images only: food photos are best.
- [ ] Do not upload faces, receipts with personal info, payment details, addresses, phone numbers, or private backgrounds.
- [ ] In the simulator, use **Upload From Photos** as the main test path because the camera may not work.
- [ ] Remember that OpenRouter free model results can be inconsistent.
- [ ] Treat AI dish names, recipes, prices, savings, and confidence as approximate.
- [ ] Remember recipes should be copycat-style or inspired-by, never official restaurant recipes.

## Test Image Checklist

Use a small, safe image set:

- [ ] Clear restaurant-style food photo.
- [ ] Homemade food photo.
- [ ] Low-light or messy food photo.
- [ ] Close-up food photo.
- [ ] Drink or smoothie.
- [ ] Dessert.
- [ ] Obvious non-food object.
- [ ] Unclear image that might be food.

Avoid photos with faces, receipts, addresses, order numbers, payment cards, private backgrounds, or anything you would not want in a bug report.

## Core Loop Checklist

Complete this exact path at least once:

- [ ] Upload Photo: choose a safe food image from Photos.
- [ ] Result: confirm the result screen shows a dish name, confidence, estimated savings, and clear actions.
- [ ] View Recipe: open the recipe and confirm it matches the scanned food.
- [ ] Share: open the share card/share flow and confirm the dish/result is correct.
- [ ] Save: save the recipe and confirm it appears in the library or saved state.
- [ ] Grocery List: open the grocery list and confirm ingredients match the recipe.
- [ ] Return path: go back or switch tabs without losing track of what happened.

## First-Run Onboarding Checklist

- [ ] App opens without crashing.
- [ ] First screen feels cute, friendly, and easy to understand.
- [ ] Onboarding explains what Okyo does in simple language.
- [ ] Buttons are easy to find and tap.
- [ ] You can finish onboarding quickly.
- [ ] After onboarding, you know how to start a scan.

## Scan Flow Checklist

- [ ] Upload From Photos opens correctly.
- [ ] A clear food photo can be selected.
- [ ] Loading state appears while Okyo scans.
- [ ] Successful food scan shows a dish name, confidence, estimated savings, and a recipe path.
- [ ] Non-food images reject clearly and do not generate a fake recipe.
- [ ] Real uploaded image failures never show fake mock pasta.
- [ ] Mock Spicy Vodka Rigatoni appears only in explicit demo/mock mode.
- [ ] Partial scans show the recognized dish or likely food category plus a useful retry/starter state.
- [ ] Error messages are friendly and do not show technical provider details.

## What Counts As Pass / Fail

Pass:

- [ ] The core loop can be completed without a crash or stuck loading state.
- [ ] The result, recipe, share card, saved recipe, and grocery list all refer to the same tested food.
- [ ] Non-food and unclear images are handled honestly.
- [ ] Real uploaded image failures do not show fake mock pasta.
- [ ] AI estimates are shown as approximate and feel plausible enough for beta testing.

Fail:

- [ ] The app crashes, freezes, or cannot recover.
- [ ] A real uploaded image failure shows Spicy Vodka Rigatoni or another fake successful mock result.
- [ ] A non-food image gets a confident food recipe.
- [ ] View Recipe, Share, Save, or Grocery List shows unrelated content.
- [ ] Technical provider errors are shown directly to a normal tester.
- [ ] Savings, nutrition, or cost data is presented as exact.

## Recipe Detail Checklist

- [ ] View Recipe opens from a scan result.
- [ ] Recipe matches the scanned dish.
- [ ] Recipe is labeled or written like a copycat-style/inspired-by recipe, not an official restaurant recipe.
- [ ] Ingredients are readable and realistic.
- [ ] Steps are clear enough for a beginner cook.
- [ ] Prep/cook time and servings feel reasonable.
- [ ] Save action works if available.
- [ ] Back navigation works without losing the main result.

## Grocery List Checklist

- [ ] Grocery list opens from a recipe or tab.
- [ ] Ingredients appear in a useful grocery-list format.
- [ ] Checked/unchecked item behavior works if available.
- [ ] Empty state is clear if no groceries are saved.
- [ ] Grocery list content matches the recipe you tested.

## Share Card Checklist

- [ ] Share card opens from the scan or recipe result.
- [ ] Card shows the right dish/result.
- [ ] Card image matches the uploaded image or expected result when available.
- [ ] Text is readable and share-friendly.
- [ ] Share/export behavior is clear, even if limited in the simulator.

## Library / Saved Recipes Checklist

- [ ] Saved recipe appears in the library.
- [ ] Opening a saved recipe shows the correct details.
- [ ] Removing or unsaving works if available.
- [ ] Empty library state is friendly and tells you what to do next.
- [ ] Saved data may be local only because there is no database or login yet.

## Savings Dashboard Checklist

- [ ] Savings dashboard opens without crashing.
- [ ] Savings numbers are easy to understand.
- [ ] Savings are presented as estimates, not exact totals.
- [ ] Dashboard updates or stays consistent after saving/testing recipes.
- [ ] Empty or low-data state is friendly.

## Rankings / Packs / Settings Quick Checklist

- [ ] Rankings screen opens and is easy to understand.
- [ ] Restaurant packs or static packs open correctly.
- [ ] Pack detail screens show useful food/recipe content.
- [ ] Settings screen opens.
- [ ] Reset Onboarding works if you intentionally test it.
- [ ] Delete Saved Data works if you intentionally test it.
- [ ] No screen feels broken, overly technical, or confusing.

## What Beta Testers Should Screenshot / Report

Please screenshot or screen record:

- [ ] Crashes, frozen loading states, or blank screens.
- [ ] Food scans with very wrong dish names.
- [ ] Non-food images that do not reject.
- [ ] Real uploaded image failures that show mock pasta or a fake success result.
- [ ] Partial scans that do not provide a helpful retry/starter state.
- [ ] Recipe details that do not match the scan.
- [ ] Share cards with the wrong image or result.
- [ ] Grocery lists with missing or unrelated ingredients.
- [ ] Savings that look wildly unrealistic.
- [ ] Any confusing copy, button, or navigation moment.

Do not share screenshots that contain private information.

## Current Limitations To Keep In Mind

- [ ] There is no database yet.
- [ ] There is no auth/login yet.
- [ ] There are no payments/subscriptions yet.
- [ ] Images are not permanently stored yet.
- [ ] Camera may not work in the simulator.
- [ ] Upload From Photos is the main simulator test path.
- [ ] OpenRouter free model can be inconsistent.
- [ ] AI estimates are approximate.

## Bug Report Format

Copy and fill this out when reporting a bug.

```text
Title:

What were you testing?

Device or simulator:
Upload From Photos or camera?
Image type: food / non-food / unclear

Expected result:
Actual result:

Steps to reproduce:
1.
2.
3.

Did this involve a real uploaded image? yes / no
Did mock Spicy Vodka Rigatoni appear? yes / no
Did a non-food image reject? yes / no / not applicable
Was the scan partial? yes / no / unsure

Screenshot or screen recording attached? yes / no
Private info removed from screenshot? yes / no
Notes:
```
