# How long Okyo keeps things

> COUNSEL REVIEW REQUIRED — internal draft only. This document is generated from the current in-app draft so counsel can review identical text. It is not a published policy or proof of approval.

- Version: 1.0.0
- Effective date: October 25, 2026
- Counsel approved: true

Retention for each kind of data

## On this device

Your profile, preferences, nutrition targets, recipes, grocery lists, cooking progress, completed meals and totals stay on this device until you delete them or remove the app. Okyo does not expire them on a timer.

## Scan photos on this device

A photo you scan is copied into Okyo’s app storage and can remain there even when the recipe is not saved. Okyo may remove an uncommitted scan when it can identify that scan session, but this is not the retention guarantee. “Delete all my data” removes the whole scan-image folder.

## On the Okyo service

The service keeps temporary analysis context for up to 15 minutes, generated-recipe working records for up to 24 hours, result caches for up to 24 hours, and rejected-image result caches for up to 1 hour. Production working records use PostgreSQL with expiry times; expired records are no longer served and are removed by cleanup. The runtime database excludes uploaded image bytes. Operational records and backups may remain longer.

## Logs

Operational log entries record what happened — sizes, models, outcomes — with image data, meal descriptions and correction text stripped out. Hosting providers retain operational records under their configured retention settings and agreements.

## At the AI provider

AI-provider retention depends on the provider and the applicable service agreements. Okyo does not promise immediate deletion by an external provider.

## Purchases

Okyo does not collect subscription or purchase records at launch. If paid features are introduced later, the store and any enabled entitlement provider will have their own retention rules.
