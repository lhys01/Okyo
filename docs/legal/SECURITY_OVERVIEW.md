# Security

> COUNSEL REVIEW REQUIRED — internal draft only. This document is generated from the current in-app draft so counsel can review identical text. It is not a published policy or proof of approval.

- Version: 1.0.0
- Effective date: October 25, 2026
- Counsel approved: true

What protects your data, described honestly

## The biggest protection is architectural

Clerk handles account authentication, including passwords for email-and-password accounts; Okyo does not receive your password. The app stores session tokens in the device’s secure storage. Okyo’s service keeps scoped working records for food analysis and recipes. Most app preferences and saved content remain on your device.

## On the device

Your content sits in Okyo’s own app storage, which the operating system keeps separate from other apps and protects with the device’s own encryption when the device is locked with a passcode. Okyo stores authentication session tokens using the platform’s secure storage facilities; passwords are handled by Clerk and are not stored by Okyo.

## In transit

Okyo sends requests to its service over HTTPS. The app’s release checks reject insecure or local service addresses.

## On the service

Every request is validated against a strict schema before anything runs, image uploads are size-limited and restricted to real image types, scans are rate-limited per client, and daily caps bound AI usage. Errors returned to the app are generic; provider and model detail is not exposed to normal users.

## What is not claimed

Okyo has not been independently security-audited, holds no security certification, and does not claim end-to-end encryption. No service can promise perfect security, and Okyo will not.

## Reporting a problem

If you believe you have found a security issue, please report it through the support contact in the app rather than posting it publicly.
