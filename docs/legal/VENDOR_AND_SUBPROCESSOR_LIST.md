# Service providers

> COUNSEL REVIEW REQUIRED — internal draft only. This document is generated from the current in-app draft so counsel can review identical text. It is not a published policy or proof of approval.

- Version: 1.0.0
- Effective date: October 25, 2026
- Counsel approved: true

Who else touches your data, and why

## AI provider — OpenRouter

Receives the food photo or dish description, plus recipe context such as servings, cooking mode and your dietary preferences, and routes it to the model Okyo has configured so a dish can be identified and a recipe written. This is a service provider acting on Okyo’s instructions for that purpose. The model vendor behind the routing is a further processor in the same chain.

## App Store distribution — Apple

Apple distributes Okyo through the App Store. No Okyo payment or subscription processing is enabled at launch. Apple is an independent party with its own privacy policy.

## Future entitlement checks — RevenueCat

RevenueCat is not enabled for Okyo at launch. If subscriptions are introduced later, Okyo may enable it to check store entitlements without receiving your recipes, photos or dietary information.

## Authentication and optional diagnostics

Clerk processes account, sign-in, connection and device information, including approximate location derived from IP address. PostHog receives limited product events when enabled; Sentry receives sanitized error reports when enabled. Their handling is described in the Privacy Policy.

## What is not here

No advertising network, marketing or email platform, or data broker is integrated. Analytics transmission is disabled unless the publisher deliberately enables the PostHog configuration for the app build or API service. The event limits and data types are described in the Privacy Policy.

## Hosting

Railway hosts Okyo’s API and PostgreSQL working records. Hosting, backup and operational retention follow the service configuration and provider agreements. Processing may occur outside your country.
