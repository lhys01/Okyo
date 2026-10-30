import { SUPPORT_EMAIL } from '../support/supportContact';

/**
 * The legal documents Okyo shows inside the app.
 *
 * These screens are the documents the user reads. Every statement below is limited
 * to behavior that exists in this repository; anything the code cannot prove
 * (how long an AI provider retains an upload, which company entity publishes
 * the app, which law governs a dispute) is either absent or explicitly named
 * as not-yet-decided rather than invented.
 *
 * The remaining draft documents have counsel-review copies under
 * `docs/legal/`, which additionally carries the `[COUNSEL REVIEW]` and
 * `[ACTION REQUIRED: ...]` markers. Those markers are deliberately NOT in the
 * user-facing text below — they are internal.
 *
 * The production screens use factual app descriptions. The release review has
 * been completed and the documents are presented as active at launch.
 */

export const LEGAL_DOCUMENTS_VERSION = '1.0.0';
export const LEGAL_DOCUMENTS_EFFECTIVE_DATE = 'October 25, 2026';

/**
 * This is true for the current launch package because counsel approval was
 * confirmed by the operator and the owner facts are filled in.
 */
export const LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED = true;

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
  status?: 'published' | 'draft';
  sections: LegalSection[];
};

const privacyPolicy: LegalDocument = {
  id: 'privacy-policy',
  title: 'Privacy Policy',
  summary: 'What Okyo collects, where it goes, and how to delete it',
  version: LEGAL_DOCUMENTS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  status: 'published',
  sections: [
    {
      heading: 'What this policy covers',
      body: 'This policy explains how Okyo handles information in the mobile app and its supporting service. You can use many app features with data stored on your device. Sign-in, food analysis, idea submissions, and optional diagnostics or analytics involve the services described below. Okyo launches without in-app subscriptions or paid features. We do not sell personal information or use it for targeted advertising.',
    },
    {
      heading: 'Account and sign-in',
      body: 'You can create and access an Okyo account with an email address and password or Google. Apple sign-in is available when the Apple and Clerk configuration is enabled for the release. For email-and-password accounts, Clerk processes your email address and password for authentication; Okyo does not receive your password. When you use Apple or Google, that provider and Clerk process the information needed to authenticate you, such as an account identifier and any name or email address the provider shares. Clerk also processes connection and device information and can derive approximate city and country from the connection’s IP address for authentication and security. Okyo does not request GPS location. Okyo uses the resulting account session to identify your requests and manage your account. Account sessions are stored securely on your device.',
    },
    {
      heading: 'Information stored on your device',
      body: 'Okyo stores onboarding answers, your name and fox name, dietary preferences and allergies, nutrition targets, recipes, scan results and photos, likes, grocery selections, cooking progress, feedback, and savings estimates on your device. A scanned photo can remain in Okyo’s app storage even when you have not saved the recipe. Delete all my data in Settings removes Okyo’s local data and scan images. Removing the app also removes its local app data, subject to your device backup settings.',
    },
    {
      heading: 'Food analysis and AI',
      body: 'When you scan or describe food, Okyo sends the photo or text and relevant recipe context to its service. That context may include servings, cooking mode, dietary restrictions, allergies, nutrition targets, corrections, and questions you submit. The service sends the request to OpenRouter and the configured model provider to identify food, generate or revise a recipe, or answer a question. AI results, nutrition, costs, and savings are estimates. Check ingredients and allergens yourself.',
    },
    {
      heading: 'How long the photo is kept',
      body: 'On your device, scan photos can remain in Okyo’s app storage until you remove local data. Okyo’s service does not put the uploaded photo into its runtime database. It keeps some analysis and generated-recipe results temporarily in PostgreSQL with expiry times, and it may cache results so repeated requests can reuse them. Server backups and operational records may outlast the live entry. At the AI provider, retention is set by that provider, not by Okyo. We will not claim a provider deletes your image immediately because Okyo cannot verify that from its own code.',
    },
    {
      heading: 'Idea board',
      body: 'If you submit an idea, improvement, or bug report, Okyo stores the category, your message, and the submission time in PostgreSQL so the team can review it. Do not include sensitive information in a suggestion. The current idea board does not publish your submission to other users.',
    },
    {
      heading: 'Analytics and diagnostics',
      body: 'When enabled for a build, PostHog receives explicit app and screen activity, coarse onboarding and sign-in progress, scan outcomes, recipe actions, tour progress, settings, account-deletion outcomes, and coarse error/performance events. Properties are restricted to app version, platform, build environment, broad screen/flow categories, approved action/outcome values, and bounded durations. Okyo does not send answers, names, email addresses, account/provider IDs, session IDs, photos, recipes, allergy or health answers, signatures, typed text, IP address properties, or raw API responses. Events use a random app-generated analytics ID, not an account or app session ID; profile processing is disabled, and the ID is rotated after account deletion. The API has a separate optional PostHog integration for coarse AI-operation metrics. The app sends no automatic text capture, screenshots, or screen recordings. Sentry is separately configured for filtered crash diagnostics. When these integrations are enabled, their services also receive network connection information. Their retention settings and agreements apply.',
    },
    {
      heading: 'Subscriptions and notifications',
      body: 'Okyo launches without in-app subscriptions or paid features, so Apple and RevenueCat do not process Okyo purchase or entitlement data at launch. Optional cooking reminders and timers are scheduled on your device when enabled.',
    },
    {
      heading: 'Service providers and processing locations',
      body: 'Okyo uses Clerk for authentication, Railway and PostgreSQL for the service and its data, OpenRouter and configured model providers for AI requests, and PostHog and Sentry when those integrations are enabled. For email-and-password accounts, Clerk processes the email address and password used for authentication. Authentication providers receive connection and device information such as IP address, device/OS information, and identifiers as needed for their services. Apple and Google also process information under their own policies when you use their sign-in services. These companies may process information outside your country. Their retention practices and locations are governed by their services and agreements.',
    },
    {
      heading: 'Retention and deletion',
      body: 'Local app data remains until you delete it or remove the app. Temporary server analysis and recipe records expire according to the service’s configured retention periods; copies in backups may remain longer. Idea submissions and records needed for security or legal obligations may remain longer. Settings › Privacy & data lets you delete local data and request deletion of a signed-in account. You can email us for help with access or deletion requests.',
    },
    {
      heading: 'Your choices and rights',
      body: 'You can edit preferences and notification settings, clear local data, and delete a signed-in account in Settings. Depending on where you live, you may also have rights to access, correct, delete, or receive information about personal data and to object to some processing. Contact us to make a request; we may need to verify your identity before acting. Email us to request access to the information we hold about you.',
    },
    {
      heading: 'Children',
      body: 'Okyo is a general-audience cooking app and is not designed for children under 13. Do not send us personal information about a child under 13. If you believe we received such information, contact us so we can review and remove it.',
    },
    {
      heading: 'Changes to this policy',
      body: 'If our practices change, we will update this policy and its effective date. Material changes may also be explained in the app.',
    },
    {
      heading: 'Contact',
      body: `Okyo is operated by Roberto Ferrito. For privacy questions, email Okyo at ${SUPPORT_EMAIL}.`,
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
      body: 'You need to be old enough to form a binding agreement where you live, and to meet the minimum age stated in the app’s store listing. Okyo is not designed for children under 13.',
    },
    {
      heading: 'Acceptable use',
      body: 'Use Okyo lawfully. Do not upload content you have no right to use, do not attempt to break, overload or reverse-engineer the service, and do not use Okyo to produce unlawful or harmful material.',
    },
    {
      heading: 'Your photos and text',
      body: 'What you photograph and type stays yours. To make the feature work you give Okyo permission to process that content — send it to Okyo’s service and its AI provider, analyze it, and return a recipe to you. That permission goes no further than running the feature you asked for. Okyo does not use your photos to advertise, does not publish them, and does not make them visible to other people; Okyo has no feed, no public profiles and no messaging.',
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
      body: 'Okyo does not diagnose, treat, cure, prevent or monitor any disease, and nothing in the app is medical, nutritional or dietetic advice. If you have a medical condition, an allergy, or specific dietary needs, talk to a qualified professional.',
    },
    {
      heading: 'Subscriptions',
      body: 'Okyo launches with its current features available without an in-app subscription or paid plan. If paid features are introduced later, Okyo will update these Terms and the store disclosures before offering them.',
    },
    {
      heading: 'Cancelling and restoring',
      body: 'There is no subscription to cancel or restore at launch. If Okyo introduces paid features later, the applicable store terms and in-app guidance will explain cancellation and restoration.',
    },
    {
      heading: 'Ending your use of Okyo',
      body: 'You can stop using Okyo at any time. Delete your local data or a signed-in account from Settings, or remove the app. Okyo may suspend or discontinue the service, or parts of it.',
    },
    {
      heading: 'Third-party services',
      body: 'Okyo depends on Clerk, Railway and PostgreSQL, an AI provider, and the app stores for distribution. Their own terms govern what they do. Okyo is not responsible for a third-party service’s independent acts, and does not control the model output an AI provider returns.',
    },
    {
      heading: 'Warranties and liability',
      body: 'Okyo is provided as it is, and Okyo does not promise the service will be uninterrupted or that every result will be accurate. Nothing here removes rights you have under consumer law that cannot be given up — including, where they apply, statutory guarantees under Australian Consumer Law, rights under the UK Consumer Rights Act, and equivalent EU consumer protections. Where liability can lawfully be limited, it is limited; where it cannot, it is not.',
    },
    {
      heading: 'Governing law and disputes',
      body: 'These Terms do not remove rights you have under applicable law, including the right to bring a claim in your local courts where the law preserves it.',
    },
    {
      heading: 'Changes',
      body: 'If these Terms change in a way that matters, Okyo will show the new version in the app with a new effective date before the change takes effect.',
    },
    {
      heading: 'Contact',
      body: `Okyo is operated by Roberto Ferrito. For support, email Okyo at ${SUPPORT_EMAIL}.`,
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
      body: 'Okyo launches without paid plans, trials, purchases, or subscription entitlements. These Subscription Terms remain available for future use; Okyo will publish updated terms and store disclosures before offering a paid feature.',
    },
    {
      heading: 'Future billing',
      body: 'No billing or automatic renewal is active at launch. If Okyo later offers a subscription, the plan, price, renewal rules, and billing period shown before purchase will apply.',
    },
    {
      heading: 'Future trials and offers',
      body: 'No free trial or introductory offer is active at launch. Okyo will describe any future offer before purchase and will not advertise one it cannot deliver.',
    },
    {
      heading: 'Payment',
      body: 'No payment is taken at launch. If paid features are introduced later, Apple will process App Store payments and Okyo will not receive or store card details.',
    },
    {
      heading: 'Managing a future subscription',
      body: 'There is no subscription to manage at launch. Future store and in-app guidance will explain how to manage or cancel a paid plan.',
    },
    {
      heading: 'Restoring a future purchase',
      body: 'There are no purchases to restore at launch. If Okyo later offers paid features, the applicable store and in-app guidance will explain restoration.',
    },
    {
      heading: 'Deleting data',
      body: 'Using “Delete my data” erases what Okyo stores on this device. There is no subscription to cancel or refund at launch.',
    },
    {
      heading: 'Future price and plan changes',
      body: 'If Okyo introduces paid plans, it will show the applicable price and plan details before purchase and follow the store’s rules for later changes.',
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
      body: 'There is no subscription to cancel at launch. If Okyo introduces a paid plan later, the App Store account settings and in-app guidance will explain cancellation.',
    },
    {
      heading: 'Who issues refunds',
      body: 'There are no Okyo purchases to refund at launch. If paid features are introduced later, the applicable store refund process will apply.',
    },
    {
      heading: 'Your statutory rights',
      body: 'Consumer law in your country may give you a right to cancel or to a refund that no policy can take away. In the EU and UK, for example, a consumer normally has a 14-day right to withdraw from a distance purchase, subject to the rules that apply when digital content starts immediately. In Australia, the consumer guarantees under Australian Consumer Law apply. Where those rights exist, they apply regardless of anything written here, and Okyo will not treat a sale as final in a way that overrides them.',
    },
    {
      heading: 'If something goes wrong',
      body: 'If an Okyo feature does not work as described, tell Okyo through the support contact in the app. Okyo will look into it.',
    },
    {
      heading: 'Cancelling does not delete your data',
      body: 'Your recipes, groceries and progress stay on this device until you delete them. To remove them, use “Delete my data”.',
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
      body: 'Okyo does not diagnose, treat, cure, prevent or monitor any disease, and does not provide medical, nutritional or dietetic advice. If you have a medical condition, an allergy, or particular dietary needs — including during pregnancy, or for a child — speak to a doctor or a registered dietitian.',
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
      body: 'These notes add region-specific detail. They do not all apply to everyone — each section says who it is for. Availability depends on the countries listed in the App Store.',
    },
    {
      heading: 'A note that changes everything below',
      body: 'Most recipe, scan, grocery, cooking and preference data is stored on this device. Okyo supports optional email-and-password, Apple, and Google sign-in through Clerk; Clerk holds account and authentication records, including email addresses and passwords for password accounts, and Okyo’s service processes requests sent for AI features. No subscription entitlement records are collected by Okyo at launch. The in-app controls cover Okyo data on this device and signed-in account deletion; provider records may have to be handled under those providers’ own processes. Provider-controlled records are also subject to the provider’s retention and privacy practices.',
    },
    {
      heading: 'Europe and the United Kingdom (GDPR / UK GDPR)',
      body: 'If you are in the EEA, Switzerland or the UK you have rights to access, rectify, erase, restrict and port your personal data, to object to processing, and to complain to your data protection authority. Okyo does not use your data for automated decisions with legal effects.',
    },
    {
      heading: 'California and other US states',
      body: 'If you are a resident of California, Colorado, Connecticut, Virginia or another US state with a consumer privacy law, you may have rights to know, delete, correct and port your personal information, and to opt out of sale, sharing for cross-context behavioural advertising, and profiling. Okyo does not sell personal information, does not share it for targeted advertising, and does not profile you for those purposes, so there is no opt-out to offer — if that ever changes, an opt-out will be added before it does. Okyo will not discriminate against you for exercising a right.',
    },
    {
      heading: 'Washington State (My Health My Data)',
      body: 'Dietary restrictions, allergies and nutrition targets can count as consumer health data under Washington law. Okyo stores that information on your device and sends relevant preferences with recipe and AI requests. It does not sell this information or use it for advertising. Contact us about access or deletion.',
    },
    {
      heading: 'Canada, including Quebec',
      body: 'If you are in Canada you may have rights of access and correction under PIPEDA, and Quebec’s Law 25 adds further rights including portability. Contact us to exercise applicable privacy rights.',
    },
    {
      heading: 'Australia',
      body: 'If you are in Australia, the Australian Privacy Principles may give you rights of access and correction, and the Australian Consumer Law gives you consumer guarantees that cannot be excluded. Contact us about applicable access or correction rights.',
    },
    {
      heading: 'How to raise a request',
      body: `See “Privacy requests and deletion” or contact Okyo at ${SUPPORT_EMAIL}. For account and service data, Okyo will need to verify the request using the available account and service records. Records controlled by Apple, Clerk or the AI provider may also be subject to those providers’ request processes. We may need to verify your identity before completing a request.`,
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
      body: 'A photo you scan is copied into Okyo’s app storage and can remain there even when the recipe is not saved. Okyo may remove an uncommitted scan when it can identify that scan session, but this is not the retention guarantee. “Delete all my data” removes the whole scan-image folder.',
    },
    {
      heading: 'On the Okyo service',
      body: 'The service keeps temporary analysis context for up to 15 minutes, generated-recipe working records for up to 24 hours, result caches for up to 24 hours, and rejected-image result caches for up to 1 hour. Production working records use PostgreSQL with expiry times; expired records are no longer served and are removed by cleanup. The runtime database excludes uploaded image bytes. Operational records and backups may remain longer.',
    },
    {
      heading: 'Logs',
      body: 'Operational log entries record what happened — sizes, models, outcomes — with image data, meal descriptions and correction text stripped out. Hosting providers retain operational records under their configured retention settings and agreements.',
    },
    {
      heading: 'At the AI provider',
      body: 'AI-provider retention depends on the provider and the applicable service agreements. Okyo does not promise immediate deletion by an external provider.',
    },
    {
      heading: 'Purchases',
      body: 'Okyo does not collect subscription or purchase records at launch. If paid features are introduced later, the store and any enabled entitlement provider will have their own retention rules.',
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
      body: 'Clerk handles account authentication, including passwords for email-and-password accounts; Okyo does not receive your password. The app stores session tokens in the device’s secure storage. Okyo’s service keeps scoped working records for food analysis and recipes. Most app preferences and saved content remain on your device.',
    },
    {
      heading: 'On the device',
      body: 'Your content sits in Okyo’s own app storage, which the operating system keeps separate from other apps and protects with the device’s own encryption when the device is locked with a passcode. Okyo stores authentication session tokens using the platform’s secure storage facilities; passwords are handled by Clerk and are not stored by Okyo.',
    },
    {
      heading: 'In transit',
      body: 'Okyo sends requests to its service over HTTPS. The app’s release checks reject insecure or local service addresses.',
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
      heading: 'App Store distribution — Apple',
      body: 'Apple distributes Okyo through the App Store. No Okyo payment or subscription processing is enabled at launch. Apple is an independent party with its own privacy policy.',
    },
    {
      heading: 'Future entitlement checks — RevenueCat',
      body: 'RevenueCat is not enabled for Okyo at launch. If subscriptions are introduced later, Okyo may enable it to check store entitlements without receiving your recipes, photos or dietary information.',
    },
    {
      heading: 'Authentication and optional diagnostics',
      body: 'Clerk processes account, sign-in, connection and device information, including approximate location derived from IP address. PostHog receives limited product events when enabled; Sentry receives sanitized error reports when enabled. Their handling is described in the Privacy Policy.',
    },
    {
      heading: 'What is not here',
      body: 'No advertising network, marketing or email platform, or data broker is integrated. Analytics transmission is disabled unless the publisher deliberately enables the PostHog configuration for the app build or API service. The event limits and data types are described in the Privacy Policy.',
    },
    {
      heading: 'Hosting',
      body: 'Railway hosts Okyo’s API and PostgreSQL working records. Hosting, backup and operational retention follow the service configuration and provider agreements. Processing may occur outside your country.',
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
      body: 'You can view your local profile and goal in Settings, preferences in Dietary preferences and Nutrition targets, recipes in Liked, lists in Grocery, and totals in Stats & progress. Account providers and Okyo’s service also process the information described in the Privacy Policy. Contact support for access to information held by Okyo.',
    },
    {
      heading: 'Correction',
      body: 'Edit anything directly: your name and fox name, your goal, your dietary preferences and nutrition targets, and any generated recipe. A wrong dish result can be corrected in place without rescanning.',
    },
    {
      heading: 'Deletion',
      body: 'Settings › Privacy & data › Delete all my data removes every Okyo record on this device: profile and fox name, goal and onboarding answers, dietary preferences and nutrition targets, saved and generated recipes, grocery lists and checked items, Cook Mode progress, completed meals, savings and macro totals, notification preferences, your recorded permission choices, and the stored scan images. A signed-in user can also choose Delete account from that screen to remove the Clerk account record. The app prevents duplicate account-deletion requests while a request is in progress.\n\nOkyo has no purchase records to remove at launch. Uninstalling Okyo also removes the app’s stored data.',
    },
    {
      heading: 'Export',
      body: 'For a copy of information held by Okyo, contact the support email in this policy. We may need to verify your identity. Provider-controlled records may require a request to that provider.',
    },
    {
      heading: 'Objection and consent withdrawal',
      body: 'You can turn notifications, camera access and photo access off in your device Settings, or turn notification categories off inside Okyo. Analytics is controlled by the publisher’s build configuration, not by an in-app toggle; it sends events only when the PostHog integration is enabled. Okyo does not use analytics for advertising or cross-app tracking.',
    },
    {
      heading: 'Opting out of sale or targeted advertising',
      body: 'There is nothing to opt out of. Okyo does not sell personal information and does not share it for targeted advertising.',
    },
    {
      heading: 'If you would rather talk to a person',
      body: `For privacy questions, email Okyo at ${SUPPORT_EMAIL}. Signed-in accounts can be deleted in the app. A person requesting help with a third-party account record may need to contact that provider directly.`,
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
