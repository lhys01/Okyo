/**
 * The legal documents Okyo shows inside the app.
 *
 * Okyo has no public website yet, so there is no URL to link out to — these
 * screens ARE the documents the user reads. Every statement below is limited
 * to behavior that exists in this repository; anything the code cannot prove
 * (how long an AI provider retains an upload, which company entity publishes
 * the app, which law governs a dispute) is either absent or explicitly named
 * as not-yet-decided rather than invented.
 *
 * Each document here has a counsel-review draft of the same substance under
 * `docs/legal/`, which additionally carries the `[COUNSEL REVIEW]` and
 * `[ACTION REQUIRED: ...]` markers. Those markers are deliberately NOT in the
 * user-facing text below — they are internal. `legalDocuments.test.ts` asserts
 * the two stay paired and versioned together.
 *
 * Publishing blocker: until an owner supplies the entity name, contact address
 * and public policy URLs (see `docs/compliance/OKYO_OWNER_ACTIONS_REQUIRED.md`)
 * these remain drafts. `LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED` stays `false`,
 * which is what surfaces the in-app review banner.
 */

export const LEGAL_DOCUMENTS_VERSION = '0.1.0-draft';
export const LEGAL_DOCUMENTS_EFFECTIVE_DATE = 'Not yet in effect — draft of August 24, 2026';

/**
 * Flipped to `true` only once counsel has approved the drafts and the owner
 * facts are filled in. While `false`, every document screen shows the review
 * banner so no reader mistakes a draft for a published policy.
 */
export const LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED = false;

export type LegalDocumentId =
  | 'privacy-policy'
  | 'terms-of-service'
  | 'subscription-terms'
  | 'refund-and-cancellation'
  | 'ai-nutrition-recipe-disclaimer'
  | 'accessibility-statement'
  | 'regional-privacy'
  | 'data-retention'
  | 'security-overview'
  | 'vendors-and-subprocessors'
  | 'privacy-requests-and-deletion';

export type LegalSection = { heading: string; body: string };

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  /** One line shown on the Legal & Privacy list. */
  summary: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
};

const privacyPolicy: LegalDocument = {
  id: 'privacy-policy',
  title: 'Privacy Policy',
  summary: 'What Okyo collects, where it goes, and how to delete it',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'The short version',
      body: 'Okyo has no accounts and no sign-in. Everything you create — your profile, your recipes, your grocery lists, your cooking progress — is stored on this device, not on an Okyo server. Two things leave the device: the food photo or dish description you send for analysis, and the preferences needed to shape the recipe. Those are processed and returned; Okyo does not build a profile of you on a server.',
    },
    {
      heading: 'Your profile and onboarding answers',
      body: 'During onboarding Okyo asks for a first name, a name for your fox companion, a main goal, and — depending on that goal — answers about eating habits, weekly spending, or protein and calorie targets. These are saved on this device. They are used to personalize screens and to shape the recipes Okyo generates. They are not sold, and they are not sent anywhere except as described under “What is sent for analysis”.',
    },
    {
      heading: 'Food preferences, allergies and dietary restrictions',
      body: 'If you record allergies, restrictions, foods you avoid, or dislikes, they are stored on this device and included with a recipe request so the recipe can be adapted around them. Treat these as health-related information about you and share only what you want used.\n\nOkyo cannot guarantee that a generated recipe is free of an allergen. Always check ingredient labels yourself.',
    },
    {
      heading: 'Nutrition targets and progress',
      body: 'Calorie and macronutrient targets you set, the meals you mark completed, and the savings and macro totals Okyo shows you are calculated and stored on this device. They are estimates from recipe data, not a medical or dietetic record.',
    },
    {
      heading: 'What is sent for analysis',
      body: 'When you scan a dish, the photo you took or chose is sent to the Okyo service. The Okyo service passes it to an AI provider (OpenRouter, which routes the request to the model vendor Okyo has configured) so the dish can be identified and a recipe written. If you describe a dish in words instead, the text is sent the same way and no photo is involved.\n\nRelevant recipe context travels with the request: the cooking mode, servings, your dietary preferences and any nutrition targets, and — when you correct a result or ask a question — the text you typed and the recipe being corrected.',
    },
    {
      heading: 'How long the photo is kept',
      body: 'On this device: the photo is copied into Okyo’s own app storage so a saved recipe keeps its picture. It stays there until you delete the recipe or use “Delete my data”.\n\nOn the Okyo service: the photo is held in memory only for as long as the request takes. Okyo does not write it to a database or a log file. Okyo does keep a short-lived result cache keyed by a one-way fingerprint of the image, so scanning the same photo twice within a day reuses the earlier answer; the cache holds the recipe, not the picture.\n\nAt the AI provider: retention is set by that provider, not by Okyo. Okyo will not claim a provider deletes your image immediately, because Okyo cannot verify that from its own code.',
    },
    {
      heading: 'Recipes, groceries and cooking progress',
      body: 'Generated recipes, edits and corrections, the recipes you like, grocery selections and checked-off items, Cook Mode progress, completed meals, and the feedback you leave are all stored on this device so the app can restore them. They are not uploaded to an Okyo account, because there is no account.',
    },
    {
      heading: 'Analytics',
      body: 'This build ships no analytics service and no advertising service. Okyo has an internal event helper, but transmission is switched off in code and no event leaves the device. If that ever changes, this policy and the in-app privacy choices will change with it before any event is sent.',
    },
    {
      heading: 'Diagnostics and logs',
      body: 'The Okyo service records operational entries such as whether a request contained an image, its size, which model answered, and whether the result was rejected. Image contents, meal descriptions and correction text are stripped before anything is written. Development builds additionally print debugging detail to the developer’s own machine; release builds do not.',
    },
    {
      heading: 'Notifications',
      body: 'Notifications are optional and off unless you turn them on. Cooking timers and reminders are scheduled by this device. No notification content is sent to a server, and Okyo does not use a push service.',
    },
    {
      heading: 'Purchases',
      body: 'Subscriptions are sold and processed by the App Store, not by Okyo. Okyo uses RevenueCat to ask whether your subscription is currently active. Okyo never sees or handles your card details. Purchase identifiers and receipts are not placed into analytics or product logs.',
    },
    {
      heading: 'Who else receives data',
      body: 'Only the parties needed to run the features you use: the Okyo service itself, the AI provider that identifies dishes and writes recipes, and Apple plus RevenueCat for subscriptions. Okyo does not sell personal information and does not share it for targeted advertising.',
    },
    {
      heading: 'International processing',
      body: 'The AI provider and the subscription services operate internationally, so a request may be processed outside your country. The exact regions Okyo’s own service runs in are not yet fixed and will be stated here before launch.',
    },
    {
      heading: 'Children',
      body: 'Okyo is a general-audience cooking app and is not directed at children. A minimum age has not yet been set; it will be stated here and enforced in the store listing before launch.',
    },
    {
      heading: 'Your choices',
      body: 'You can edit or clear your dietary preferences and nutrition targets at any time, turn notifications on or off, and delete every piece of Okyo data on this device from Settings › Legal & Privacy › Delete my data. Deleting your data does not cancel a subscription — only the App Store can do that.',
    },
    {
      heading: 'Regional rights',
      body: 'Depending on where you live you may have rights to access, correct, delete or port your information, or to object to certain processing. Because Okyo keeps no server-side copy of your data and cannot identify you, most of these are exercised directly on the device: everything Okyo holds about you is in the app, and deletion is one tap. See “Regional privacy rights” for the detail, and “Privacy requests and deletion” for how to reach a human.',
    },
    {
      heading: 'Contact',
      body: 'A published privacy contact address is not yet available. It will appear here, and in the store listing, before Okyo is released.',
    },
  ],
};

const termsOfService: LegalDocument = {
  id: 'terms-of-service',
  title: 'Terms of Service',
  summary: 'The agreement between you and Okyo',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'What Okyo is',
      body: 'Okyo identifies a prepared dish from a photo or a description and writes an editable copycat-style recipe for it, along with estimates for cost, time, nutrition and savings. An Okyo recipe is Okyo’s own attempt to recreate a dish. It is not an official restaurant recipe, and no restaurant has endorsed or supplied it.',
    },
    {
      heading: 'Eligibility',
      body: 'You need to be old enough to form a binding agreement where you live, and to meet the minimum age stated in the app’s store listing. The final minimum age has not yet been set.',
    },
    {
      heading: 'Acceptable use',
      body: 'Use Okyo lawfully. Do not upload content you have no right to use, do not attempt to break, overload or reverse-engineer the service, and do not use Okyo to produce unlawful or harmful material.',
    },
    {
      heading: 'Your photos and text',
      body: 'What you photograph and type stays yours. To make the feature work you give Okyo permission to process that content — send it to Okyo’s service and its AI provider, analyze it, and return a recipe to you. That permission goes no further than running the feature you asked for. Okyo does not use your photos to advertise, does not publish them, and does not make them visible to other people; Okyo has no feed, no profiles and no messaging.',
    },
    {
      heading: 'AI-generated results',
      body: 'Dish recognition, recipes, substitutions, cooking times, nutrition figures, costs and savings are generated by an AI model and can be wrong or incomplete. Review anything before you rely on it. Okyo shows a confidence note and lets you correct a wrong result rather than presenting a guess as fact.',
    },
    {
      heading: 'Allergies, ingredients and food safety',
      body: 'Okyo cannot reliably detect every ingredient, additive or cross-contact from a photo. You are responsible for checking ingredient labels, confirming a recipe suits your diet and allergies, handling and storing food safely, and cooking to safe internal temperatures. Times and doneness cues in a recipe are guidance, not a guarantee.',
    },
    {
      heading: 'Not medical or dietetic advice',
      body: 'Okyo does not diagnose, treat, cure or prevent any disease, and nothing in the app is medical, nutritional or dietetic advice. If you have a medical condition, an allergy, or specific dietary needs, talk to a qualified professional.',
    },
    {
      heading: 'Subscriptions',
      body: 'Okyo offers an optional paid subscription through the App Store. The plan, price and billing period shown at purchase are the ones that apply. See “Subscription Terms” and “Refunds and cancellation” for the detail.',
    },
    {
      heading: 'Cancelling and restoring',
      body: 'You cancel a subscription through your App Store account, not inside Okyo. Cancelling stops future renewals; access continues to the end of the period you already paid for. “Restore purchases” on the paywall re-links an existing subscription to this device. Free features keep working after a subscription ends.',
    },
    {
      heading: 'Ending your use of Okyo',
      body: 'You can stop using Okyo at any time. Because there is no account, deleting your data or removing the app is what ends your side of this agreement. Okyo may suspend or discontinue the service, or parts of it, and will not take a paid feature away without honoring the period you have paid for.',
    },
    {
      heading: 'Third-party services',
      body: 'Okyo depends on the App Store, RevenueCat and an AI provider. Their own terms govern what they do. Okyo is not responsible for a third-party service’s independent acts, and does not control the model output an AI provider returns.',
    },
    {
      heading: 'Warranties and liability',
      body: 'Okyo is provided as it is, and Okyo does not promise the service will be uninterrupted or that every result will be accurate. Nothing here removes rights you have under consumer law that cannot be given up — including, where they apply, statutory guarantees under Australian Consumer Law, rights under the UK Consumer Rights Act, and equivalent EU consumer protections. Where liability can lawfully be limited, it is limited; where it cannot, it is not.',
    },
    {
      heading: 'Governing law and disputes',
      body: 'The governing law and the way disputes are resolved have not yet been settled, and will be stated here before release. Whatever is chosen will not remove your right to bring a claim in your local courts where the law preserves it, and will not impose a blanket worldwide arbitration requirement on consumers who cannot lawfully be bound by one.',
    },
    {
      heading: 'Changes',
      body: 'If these Terms change in a way that matters, Okyo will show the new version in the app with a new effective date before the change takes effect.',
    },
  ],
};

const subscriptionTerms: LegalDocument = {
  id: 'subscription-terms',
  title: 'Subscription Terms',
  summary: 'Plans, renewal, trials and how billing works',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'What you are buying',
      body: 'Okyo Pro is an auto-renewing subscription that unlocks Okyo’s paid features. The plans available to you, their prices, and their billing periods are the ones shown on the paywall — those come live from the App Store in your local currency. Okyo does not quote a price anywhere else, because the store’s price for your region is the only correct one.',
    },
    {
      heading: 'Automatic renewal',
      body: 'A subscription renews automatically at the end of each billing period, and your Apple ID is charged for the next period, unless you turn off auto-renew at least 24 hours before the current period ends. Renewal price and period are the ones shown at purchase.',
    },
    {
      heading: 'Free trials and introductory offers',
      body: 'If the store offers a free trial or an introductory price for a plan, its length and what it converts to are shown on that plan before you buy. When a trial ends it becomes a paid subscription at the standard price unless you cancel at least 24 hours before it ends. Okyo shows a trial only when the store actually returns one — it never advertises a trial it cannot deliver.',
    },
    {
      heading: 'Payment',
      body: 'Payment is taken by Apple through your App Store account. Okyo never receives or stores your card details.',
    },
    {
      heading: 'Managing your subscription',
      body: 'You manage, change or cancel a subscription in your App Store account settings — Okyo cannot do it for you. The paywall links you straight there.',
    },
    {
      heading: 'Restoring a purchase',
      body: 'If you reinstall Okyo or use a new device, “Restore purchases” re-links the subscription attached to your Apple ID. Okyo checks entitlement with RevenueCat before unlocking a paid feature, so a restored subscription takes effect immediately.',
    },
    {
      heading: 'Deleting data is not cancelling',
      body: 'Using “Delete my data” erases what Okyo stores on this device. It does not cancel or refund a subscription, and it cannot — only the App Store can. Cancel first if that is what you want.',
    },
    {
      heading: 'Price and plan changes',
      body: 'If a price changes, Apple notifies you and asks for your agreement before charging the new amount, in the way the App Store requires. You can decline by cancelling.',
    },
  ],
};

const refundAndCancellation: LegalDocument = {
  id: 'refund-and-cancellation',
  title: 'Refunds and cancellation',
  summary: 'How to cancel, and where refunds come from',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'How to cancel',
      body: 'Open your device Settings, tap your name, then Subscriptions, and select Okyo. Turn off auto-renew or cancel there. The paywall in Okyo links directly to that screen. Cancelling stops the next charge; you keep access until the period you already paid for runs out.',
    },
    {
      heading: 'Who issues refunds',
      body: 'Apple takes the payment, so Apple decides refunds for App Store purchases. Request one at reportaproblem.apple.com or through your App Store purchase history. Okyo cannot issue a refund for a purchase it never received money for directly.',
    },
    {
      heading: 'Your statutory rights',
      body: 'Consumer law in your country may give you a right to cancel or to a refund that no policy can take away. In the EU and UK, for example, a consumer normally has a 14-day right to withdraw from a distance purchase, subject to the rules that apply when digital content starts immediately. In Australia, the consumer guarantees under Australian Consumer Law apply. Where those rights exist, they apply regardless of anything written here, and Okyo will not treat a sale as final in a way that overrides them.',
    },
    {
      heading: 'If something goes wrong',
      body: 'If a paid feature does not work as described, tell Okyo through the support contact in the app. Okyo will look into it, and will support a refund request to Apple where one is warranted.',
    },
    {
      heading: 'Cancelling does not delete your data',
      body: 'Your recipes, groceries and progress stay on this device after a subscription ends, and free features keep working. To remove them, use “Delete my data”.',
    },
  ],
};

const aiDisclaimer: LegalDocument = {
  id: 'ai-nutrition-recipe-disclaimer',
  title: 'AI, nutrition and recipe disclaimer',
  summary: 'What Okyo’s estimates do and do not mean',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'Okyo’s results are generated by AI',
      body: 'The dish Okyo names, the recipe it writes, and the substitutions it suggests all come from an AI model reading your photo or description. They can be incomplete, or simply wrong. Okyo shows a confidence note and lets you correct a result rather than presenting a guess as certainty.',
    },
    {
      heading: 'Every number is an estimate',
      body: 'Calories, protein, carbohydrates, fat, ingredient cost, restaurant price, prep and cook time, and savings are all estimates calculated from generated recipe data. They are not laboratory measurements, not a record of what you actually ate, and not a quote from any restaurant.',
    },
    {
      heading: 'Estimated savings are not recorded savings',
      body: 'The savings figure on a recipe is a projection. It only becomes part of your recorded savings total when you mark that meal completed in Okyo. Nothing is counted for you in advance.',
    },
    {
      heading: 'Check ingredients and allergens yourself',
      body: 'A photo cannot reveal every ingredient, additive, oil, marinade or cross-contact in a dish. If you have an allergy or intolerance, read the label on every ingredient you buy and confirm the recipe is safe for you. Do not rely on Okyo to catch an allergen.',
    },
    {
      heading: 'Cook safely',
      body: 'Cooking times are guidance and vary with your equipment, portion size and starting temperature. Use visual cues and a food thermometer, especially for meat, poultry, seafood and eggs, and follow safe storage and reheating practice.',
    },
    {
      heading: 'Not medical or dietetic advice',
      body: 'Okyo does not diagnose, treat, cure or prevent any disease, and does not provide medical, nutritional or dietetic advice. If you have a medical condition, an allergy, or particular dietary needs — including during pregnancy, or for a child — speak to a doctor or a registered dietitian.',
    },
    {
      heading: 'Your rights are not affected',
      body: 'Nothing in this disclaimer removes rights you have under consumer law that cannot be given up.',
    },
  ],
};

const accessibilityStatement: LegalDocument = {
  id: 'accessibility-statement',
  title: 'Accessibility',
  summary: 'What has been tested, and what has not',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'What Okyo aims for',
      body: 'Okyo aims to meet WCAG 2.2 level AA and Apple’s accessibility guidance. That is the target, not a claim of completed conformance.',
    },
    {
      heading: 'What is in place today',
      body: 'Interactive controls carry accessibility labels and roles, selected and disabled states are exposed to assistive technology, alerts and status changes are announced as live regions, tap targets on the screens reviewed meet the 44pt minimum, and decorative motion is skipped when Reduce Motion is on. Legal and settings text scrolls and follows the system text size.',
    },
    {
      heading: 'What has not been fully verified',
      body: 'Okyo has not completed an end-to-end audit of every screen. Colour-contrast has not been measured across the whole app, external-keyboard navigation has not been tested, and the largest accessibility text sizes have not been verified on every screen. Okyo will not claim full WCAG 2.2 AA conformance until that work is finished and recorded.',
    },
    {
      heading: 'Tell us what is broken',
      body: 'If something in Okyo is hard or impossible to use with assistive technology, please report it through the support contact in the app. Accessibility defects are treated as defects, not as feature requests.',
    },
  ],
};

const regionalPrivacy: LegalDocument = {
  id: 'regional-privacy',
  title: 'Regional privacy rights',
  summary: 'Extra rights that may apply where you live',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'Read this alongside the Privacy Policy',
      body: 'These notes add region-specific detail. They do not all apply to everyone — each section says who it is for. The countries Okyo will actually be offered in have not been finalized, so this section will be narrowed to those markets before launch.',
    },
    {
      heading: 'A note that changes everything below',
      body: 'Okyo has no accounts and stores your information on your own device. Okyo cannot look you up, cannot connect a request to a person, and holds no server-side copy to hand over. That means most access, correction and portability requests are answered by the app itself: what Okyo holds about you is what is on your screen, and deletion is one tap in Settings.',
    },
    {
      heading: 'Europe and the United Kingdom (GDPR / UK GDPR)',
      body: 'If you are in the EEA, Switzerland or the UK you have rights to access, rectify, erase, restrict and port your personal data, to object to processing, and to complain to your data protection authority. The lawful bases Okyo relies on, and whether Okyo needs a representative in the EU or UK, are being assessed with counsel and will be stated here before Okyo is offered in those markets. Okyo does not use your data for automated decisions with legal effects.',
    },
    {
      heading: 'California and other US states',
      body: 'If you are a resident of California, Colorado, Connecticut, Virginia or another US state with a consumer privacy law, you may have rights to know, delete, correct and port your personal information, and to opt out of sale, sharing for cross-context behavioural advertising, and profiling. Okyo does not sell personal information, does not share it for targeted advertising, and does not profile you for those purposes, so there is no opt-out to offer — if that ever changes, an opt-out will be added before it does. Okyo will not discriminate against you for exercising a right.',
    },
    {
      heading: 'Washington State (My Health My Data)',
      body: 'Dietary restrictions, allergies and nutrition targets can count as consumer health data under Washington law. Okyo keeps that information on your device, does not sell it, and does not use it for advertising. Whether Okyo is a regulated entity under that law, and what a separate consumer-health-data notice must say, is being assessed with counsel.',
    },
    {
      heading: 'Canada, including Quebec',
      body: 'If you are in Canada you may have rights of access and correction under PIPEDA, and Quebec’s Law 25 adds further rights including portability. Okyo’s Canadian obligations are being confirmed with counsel.',
    },
    {
      heading: 'Australia',
      body: 'If you are in Australia, the Australian Privacy Principles may give you rights of access and correction, and the Australian Consumer Law gives you consumer guarantees that cannot be excluded. Whether Okyo is an APP entity depends on business facts not yet settled.',
    },
    {
      heading: 'How to raise a request',
      body: 'See “Privacy requests and deletion”. Because Okyo cannot identify you, a request that would require Okyo to find “your” data on a server cannot be fulfilled — there is no such data — and Okyo will tell you that plainly rather than pretending to search.',
    },
  ],
};

const dataRetention: LegalDocument = {
  id: 'data-retention',
  title: 'How long Okyo keeps things',
  summary: 'Retention for each kind of data',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'On this device',
      body: 'Your profile, preferences, nutrition targets, recipes, grocery lists, cooking progress, completed meals and totals stay on this device until you delete them or remove the app. Okyo does not expire them on a timer.',
    },
    {
      heading: 'Scan photos on this device',
      body: 'A photo you scan is copied into Okyo’s app storage. A photo not attached to any saved recipe is cleaned up when its scan session ends. “Delete my data” removes the whole folder.',
    },
    {
      heading: 'On the Okyo service',
      body: 'The Okyo service holds no long-term store of your data. During and shortly after a scan it keeps short-lived working state in memory only: analysis context for 15 minutes, a generated recipe for 24 hours so it can be enriched or corrected, a result cache for 24 hours, and a rejected-image result for 1 hour. All of it is lost when the service restarts. Image bytes are never written to disk.',
    },
    {
      heading: 'Logs',
      body: 'Operational log entries record what happened — sizes, models, outcomes — with image data, meal descriptions and correction text stripped out. A production log retention period has not yet been fixed and will be stated here before launch.',
    },
    {
      heading: 'At the AI provider',
      body: 'Okyo cannot state the AI provider’s retention period from its own code and will not guess. This will be filled in from the provider’s contract terms before launch.',
    },
    {
      heading: 'Purchases',
      body: 'Apple and RevenueCat keep subscription records under their own retention rules. Okyo does not control them, and cannot delete them on your behalf.',
    },
  ],
};

const securityOverview: LegalDocument = {
  id: 'security-overview',
  title: 'Security',
  summary: 'What protects your data, described honestly',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'The biggest protection is architectural',
      body: 'Okyo has no user accounts, no password to steal, and no central database of user profiles. There is no server-side pile of personal data to breach, because Okyo does not build one.',
    },
    {
      heading: 'On the device',
      body: 'Your data sits in Okyo’s own app storage, which the operating system keeps separate from other apps and protects with the device’s own encryption when the device is locked with a passcode. Okyo stores no passwords or access tokens, because it has none.',
    },
    {
      heading: 'In transit',
      body: 'Release builds send requests to the Okyo service over HTTPS. Plain HTTP is only ever used by a developer pointing the app at a machine on their own network, and a release build refuses such an address.',
    },
    {
      heading: 'On the service',
      body: 'Every request is validated against a strict schema before anything runs, image uploads are size-limited and restricted to real image types, scans are rate-limited per client, and daily caps bound AI usage. Errors returned to the app are generic; provider and model detail is not exposed to normal users.',
    },
    {
      heading: 'What is not claimed',
      body: 'Okyo has not been independently security-audited, holds no security certification, and does not claim end-to-end encryption. No service can promise perfect security, and Okyo will not.',
    },
    {
      heading: 'Reporting a problem',
      body: 'If you believe you have found a security issue, please report it through the support contact in the app rather than posting it publicly.',
    },
  ],
};

const vendors: LegalDocument = {
  id: 'vendors-and-subprocessors',
  title: 'Service providers',
  summary: 'Who else touches your data, and why',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'AI provider — OpenRouter',
      body: 'Receives the food photo or dish description, plus recipe context such as servings, cooking mode and your dietary preferences, and routes it to the model Okyo has configured so a dish can be identified and a recipe written. This is a service provider acting on Okyo’s instructions for that purpose. The model vendor behind the routing is a further processor in the same chain.',
    },
    {
      heading: 'Subscriptions — Apple',
      body: 'Sells the subscription, takes payment, and issues refunds. Apple is an independent party with its own privacy policy, not a service provider acting for Okyo. Okyo never sees your payment details.',
    },
    {
      heading: 'Entitlement checks — RevenueCat',
      body: 'Tells Okyo whether the subscription attached to your Apple ID is currently active, so the app can unlock paid features and restore a purchase. It receives purchase and device identifiers from the store, not your recipes, photos or dietary information.',
    },
    {
      heading: 'What is not here',
      body: 'No analytics provider, no advertising network, no crash-reporting service, no marketing or email platform, and no data broker. This build integrates none of them. If one is ever added it will be listed here before it ships.',
    },
    {
      heading: 'Hosting',
      body: 'Where Okyo’s own service will be hosted has not been finalized. The provider and region will be listed here before launch.',
    },
  ],
};

const privacyRequests: LegalDocument = {
  id: 'privacy-requests-and-deletion',
  title: 'Privacy requests and deletion',
  summary: 'How to see, correct, export or delete your data',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'Access — you already have it',
      body: 'Everything Okyo holds about you is in this app, on this device. Your profile and goal are in Settings, your preferences in Dietary preferences and Nutrition targets, your recipes in Liked, your lists in Grocery, and your totals in Stats & progress. There is no hidden server-side profile to request.',
    },
    {
      heading: 'Correction',
      body: 'Edit anything directly: your name and fox name, your goal, your dietary preferences and nutrition targets, and any generated recipe. A wrong dish result can be corrected in place without rescanning.',
    },
    {
      heading: 'Deletion',
      body: 'Settings › Legal & Privacy › Delete my data removes every Okyo record on this device: profile and fox name, goal and onboarding answers, dietary preferences and nutrition targets, saved and generated recipes, grocery lists and checked items, Cook Mode progress, completed meals, savings and macro totals, notification preferences, your recorded permission choices, and the stored scan images. It can be run as many times as you like.\n\nIt does not cancel your subscription, and it cannot remove records Apple or RevenueCat keep about a purchase — those are their records, under their retention rules. Uninstalling Okyo also removes the app’s stored data.',
    },
    {
      heading: 'Export',
      body: 'A data export file is not built yet, and Okyo will not pretend otherwise. Because the data is all on this device and visible in the app, there is nothing Okyo is holding back from you.',
    },
    {
      heading: 'Objection and consent withdrawal',
      body: 'Every optional processing in Okyo is something you switch on: notifications, camera access and photo access. Turn any of them off in your device Settings, or turn notification categories off inside Okyo, and the corresponding processing stops. Okyo runs no analytics, advertising or tracking to object to.',
    },
    {
      heading: 'Opting out of sale or targeted advertising',
      body: 'There is nothing to opt out of. Okyo does not sell personal information and does not share it for targeted advertising.',
    },
    {
      heading: 'If you would rather talk to a person',
      body: 'A published privacy contact address is not yet available and will be added before release. Because Okyo has no account system, Okyo cannot verify who you are or locate “your” records on a server — so a request that depends on that cannot be fulfilled, and Okyo will say so plainly rather than pretend to search.',
    },
  ],
};

export const legalDocuments: LegalDocument[] = [
  privacyPolicy,
  termsOfService,
  subscriptionTerms,
  refundAndCancellation,
  aiDisclaimer,
  accessibilityStatement,
  regionalPrivacy,
  dataRetention,
  securityOverview,
  vendors,
  privacyRequests,
];

export function getLegalDocument(id: LegalDocumentId): LegalDocument | undefined {
  return legalDocuments.find((document) => document.id === id);
}
