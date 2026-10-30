// Copied from the in-app Help & support screen
// (apps/mobile/src/screens/HelpSupportScreen.tsx) so the website and app give the
// same answers. Update both together.

export const SUPPORT_FAQ = [
  {
    group: 'Getting started',
    items: [
      ['How does Okyo work?', 'Scan or describe a prepared dish. Okyo uses AI to identify it and create an editable, copycat-style recipe.'],
      ['How do food scans work?', 'A selected food photo is sent through the Okyo API to its configured AI service. Clear photos with the full dish visible work best.'],
      ['How accurate are recipes?', 'Recipes are AI-generated interpretations and can be imperfect. Review ingredients, steps, and doneness before cooking.'],
      ['How does nutrition estimation work?', 'Nutrition values are recipe-level estimates based on generated ingredients and servings. They are not medical or laboratory measurements.'],
      ['How does savings estimation work?', 'Savings compare estimated homemade cost with an estimated restaurant or takeout price. Local prices vary. Only completed meals count toward realized progress in Okyo.'],
    ],
  },
  {
    group: 'Cooking',
    items: [
      ['How do I edit a recipe?', 'Open a recipe and choose Edit recipe or Customize. Okyo sends the requested change through the existing recipe-correction flow.'],
      ['How do substitutions work?', 'Suggested substitutions aim to preserve the dish, but you should confirm labels, quantities, and suitability for your needs.'],
      ['How does Ask Okyo work?', 'Ask Okyo sends your question, recipe context, and relevant dietary preferences to the Okyo API for an AI-generated answer.'],
      ['How do cooking timers work?', 'Timers are guidance. Always verify doneness with appearance, texture, and a food thermometer where appropriate.'],
      ['How do grocery lists work?', 'Adding a recipe to Grocery creates a local list from its ingredients. You can check items and pantry needs on the device.'],
    ],
  },
  {
    group: 'Dietary & safety',
    items: [
      ['How does Okyo use allergies?', 'Stored allergies are sent as hard recipe constraints and are checked against generated ingredient names for prominent warnings. Detection is not guaranteed.'],
      ['What if Okyo identifies an allergen?', 'Review every ingredient and product label. Use Make this work for me to request a revised recipe, but verify the revision yourself.'],
      ['Can Okyo guarantee allergen-free food?', 'No. Food recognition and generated recipes can be wrong, and cross-contact cannot be detected from a photo. Do not rely on Okyo alone for allergy-critical decisions.'],
    ],
  },
  {
    group: 'Account',
    items: [
      ['How do I change preferences?', 'Open Settings, then Dietary preferences. Changes are stored globally for future scans, corrections, and Ask Okyo.'],
      ['How do I delete my data?', 'Open Settings, Privacy & data, then Delete all my data. This removes Okyo data stored locally by this app.'],
      ['How do I delete my account?', 'Open Settings, Privacy & data, then Delete account. Confirm twice to permanently delete your signed-in Okyo account and local data. This does not cancel an App Store subscription; manage that with Apple.'],
    ],
  },
  {
    group: 'Troubleshooting',
    items: [
      ['Scan failed', 'Try a brighter, sharper photo with the prepared dish filling the frame, or describe the meal instead.'],
      ['Wrong dish identified', 'Use the correction prompt on the result screen and describe what looks wrong.'],
      ['Recipe doesn’t look right', 'Use Edit recipe or Ask Okyo. If the result remains unreliable, generate it again rather than cooking from uncertain steps.'],
      ['Notification problem', 'Check the Notifications preference center and iOS Settings. Okyo cannot override a denied system permission.'],
      ['Recipe disappeared', 'Saved recipes remain local to this installation. Clearing app data or deleting the app removes local records.'],
    ],
  },
] as const;
