# Privacy Policy

> COUNSEL REVIEW REQUIRED — internal draft only. This document is generated from the current in-app draft so counsel can review identical text. It is not a published policy or proof of approval.

- Version: 1.0.0
- Effective date: October 25, 2026
- Counsel approved: true

What Okyo collects, where it goes, and how to delete it

## What this policy covers

This policy explains how Okyo handles information in the mobile app and its supporting service. You can use many app features with data stored on your device. Sign-in, food analysis, idea submissions, and optional diagnostics or analytics involve the services described below. Okyo launches without in-app subscriptions or paid features. We do not sell personal information or use it for targeted advertising.

## Account and sign-in

You can create and access an Okyo account with an email address and password or Google. Apple sign-in is available when the Apple and Clerk configuration is enabled for the release. For email-and-password accounts, Clerk processes your email address and password for authentication; Okyo does not receive your password. When you use Apple or Google, that provider and Clerk process the information needed to authenticate you, such as an account identifier and any name or email address the provider shares. Clerk also processes connection and device information and can derive approximate city and country from the connection’s IP address for authentication and security. Okyo does not request GPS location. Okyo uses the resulting account session to identify your requests and manage your account. Account sessions are stored securely on your device.

## Information stored on your device

Okyo stores onboarding answers, your name and fox name, dietary preferences and allergies, nutrition targets, recipes, scan results and photos, likes, grocery selections, cooking progress, feedback, and savings estimates on your device. A scanned photo can remain in Okyo’s app storage even when you have not saved the recipe. Delete all my data in Settings removes Okyo’s local data and scan images. Removing the app also removes its local app data, subject to your device backup settings.

## Food analysis and AI

When you scan or describe food, Okyo sends the photo or text and relevant recipe context to its service. That context may include servings, cooking mode, dietary restrictions, allergies, nutrition targets, corrections, and questions you submit. The service sends the request to OpenRouter and the configured model provider to identify food, generate or revise a recipe, or answer a question. AI results, nutrition, costs, and savings are estimates. Check ingredients and allergens yourself.

## How long the photo is kept

On your device, scan photos can remain in Okyo’s app storage until you remove local data. Okyo’s service does not put the uploaded photo into its runtime database. It keeps some analysis and generated-recipe results temporarily in PostgreSQL with expiry times, and it may cache results so repeated requests can reuse them. Server backups and operational records may outlast the live entry. At the AI provider, retention is set by that provider, not by Okyo. We will not claim a provider deletes your image immediately because Okyo cannot verify that from its own code.

## Idea board

If you submit an idea, improvement, or bug report, Okyo stores the category, your message, and the submission time in PostgreSQL so the team can review it. Do not include sensitive information in a suggestion. The current idea board does not publish your submission to other users.

## Analytics and diagnostics

When enabled for a build, PostHog receives explicit app and screen activity, coarse onboarding and sign-in progress, scan outcomes, recipe actions, tour progress, settings, account-deletion outcomes, and coarse error/performance events. Properties are restricted to app version, platform, build environment, broad screen/flow categories, approved action/outcome values, and bounded durations. Okyo does not send answers, names, email addresses, account/provider IDs, session IDs, photos, recipes, allergy or health answers, signatures, typed text, IP address properties, or raw API responses. Events use a random app-generated analytics ID, not an account or app session ID; profile processing is disabled, and the ID is rotated after account deletion. The API has a separate optional PostHog integration for coarse AI-operation metrics. The app sends no automatic text capture, screenshots, or screen recordings. Sentry is separately configured for filtered crash diagnostics. When these integrations are enabled, their services also receive network connection information. Their retention settings and agreements apply.

## Subscriptions and notifications

Okyo launches without in-app subscriptions or paid features, so Apple and RevenueCat do not process Okyo purchase or entitlement data at launch. Optional cooking reminders and timers are scheduled on your device when enabled.

## Service providers and processing locations

Okyo uses Clerk for authentication, Railway and PostgreSQL for the service and its data, OpenRouter and configured model providers for AI requests, and PostHog and Sentry when those integrations are enabled. For email-and-password accounts, Clerk processes the email address and password used for authentication. Authentication providers receive connection and device information such as IP address, device/OS information, and identifiers as needed for their services. Apple and Google also process information under their own policies when you use their sign-in services. These companies may process information outside your country. Their retention practices and locations are governed by their services and agreements.

## Retention and deletion

Local app data remains until you delete it or remove the app. Temporary server analysis and recipe records expire according to the service’s configured retention periods; copies in backups may remain longer. Idea submissions and records needed for security or legal obligations may remain longer. Settings › Privacy & data lets you delete local data and request deletion of a signed-in account. You can email us for help with access or deletion requests.

## Your choices and rights

You can edit preferences and notification settings, clear local data, and delete a signed-in account in Settings. Depending on where you live, you may also have rights to access, correct, delete, or receive information about personal data and to object to some processing. Contact us to make a request; we may need to verify your identity before acting. Email us to request access to the information we hold about you.

## Children

Okyo is a general-audience cooking app and is not designed for children under 13. Do not send us personal information about a child under 13. If you believe we received such information, contact us so we can review and remove it.

## Changes to this policy

If our practices change, we will update this policy and its effective date. Material changes may also be explained in the app.

## Contact

Okyo is operated by Roberto Ferrito. For privacy questions, email Okyo at support.okyo@gmail.com.
