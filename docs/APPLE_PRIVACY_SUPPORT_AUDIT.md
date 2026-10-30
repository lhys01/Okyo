# Okyo Apple privacy, support and legal audit

**Audit date:** 2026-10-18  
**Scope:** In-app Help & support, Terms & privacy, Privacy & data, related account/data flows, and the Apple requirements directly connected to those surfaces.  
**Status:** Code review complete; not an App Store approval or legal opinion. No release build, App Store Connect record, live support site, vendor contracts, or production retention settings were available to verify.

## Executive result

The app has working in-app entry points for help, legal documents, local data controls, and signed-in account deletion. The legal center is unusually broad and correctly identifies itself as draft material. That honesty is important, but also means these are not ready to be presented as the final published policies.

**Do not submit this build as a production App Store release yet.** The blocking release work is to publish a public privacy policy URL and support URL, verify the publisher and service-provider facts, reconcile App Store privacy disclosures with the shipped binary, complete the account deletion/vendor checks, and have counsel approve the final legal notices. The two URLs and several business/vendor facts cannot be supplied from repository code.

## What was inspected

- `apps/mobile/src/screens/SettingsScreen.tsx`: settings navigation to Privacy & data, Help & support, Terms & privacy, and Delete account.
- `apps/mobile/src/screens/HelpSupportScreen.tsx` and `apps/mobile/src/support/supportContact.ts`: FAQ coverage and support email link.
- `apps/mobile/src/screens/PrivacyDataScreen.tsx`, `apps/mobile/src/state/dietaryDeletion.ts`, `apps/mobile/src/screens/accountDeletionDeviceCleanup.ts`, and API account-deletion implementation: local deletion, signed-in deletion, confirmations, retry/failure states, Apple authorization cleanup, and subscription messaging.
- `apps/mobile/src/screens/LegalScreen.tsx`, `apps/mobile/src/legal/LegalDocumentView.tsx`, and `apps/mobile/src/legal/legalDocuments.ts`: legal center, draft warning, accessibility of the reader, and the in-app privacy/terms content.
- `apps/mobile/app.json`, analytics/privacy safeguards, and the API privacy-related implementation: permission purpose strings, integrations, scan processing, and privacy-manifest build configuration.
- The repository’s paired counsel-review drafts under `docs/legal/`.

## Apple requirements relevant to this audit

Apple’s current App Review Guidelines require an easily accessible in-app Privacy Policy and an App Store Connect Privacy Policy URL. The policy must say what data is collected, how it is collected and used, how third parties are protected, retention/deletion practices, and how consent can be revoked or deletion requested. Permission requests must explain their purpose, data collection must be minimized, and permission settings must be respected. Apps with account creation must offer in-app account deletion. See [App Review Guidelines, sections 5.1.1(i)–(v)](https://developer.apple.com/app-store/review/guidelines/uk/).

Apple says account deletion must be easy to find, delete the full account and associated personal data, explain any delay or retained records, and explain subscription billing. Requiring support email/phone/chat to finish deletion is generally not acceptable for a non-regulated app. See [Apple’s account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).

Apple requires a public privacy-policy URL for iOS apps, and App Store privacy responses must include the app and third-party partners and be kept accurate as practices change. The privacy-choices URL is optional. See [App Store Connect: Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/) and [App privacy reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy/).

The App Store Connect **Support URL** must lead to a support website with actual contact information; it is a required submission property. The in-app email contact does not itself fill this metadata field. See [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

Privacy manifests and required-reason API declarations also apply to apps and SDKs. Apple requires valid manifests for listed SDKs and expects developers to account for third-party code when preparing App Store privacy disclosures. See [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) and [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/).

## Current app coverage

| Area | Current implementation | Audit result |
|---|---|---|
| Find support | Settings has Help & support and Terms & privacy rows. | Present and easy to find. |
| Help content | FAQs cover scans, AI accuracy, nutrition/cost estimates, editing, dietary safety, preferences, deletion, notifications, and troubleshooting. | Strong coverage. Food/allergen uncertainty is stated. |
| Contact support | `support.okyo@gmail.com` is rendered as a link that opens the mail composer, with a fallback address alert. | In-app channel works in principle. Verify the mailbox is monitored, owned by the publisher, and suitable for privacy requests. |
| In-app privacy/terms | Legal center links 11 versioned documents. The reader uses selectable text, Dynamic Type, scroll, and an explicit draft/not-in-effect warning. | Accessible location and honest status. It is not a substitute for the required public Privacy Policy URL. |
| Data inventory and purposes | Privacy & data describes local profile/preferences/recipes/history, scan photo processing, dietary preference transmission, AI processing, and local retention. | Useful but needs provider/production fact verification and matching App Store disclosures. |
| Local data deletion | “Delete all my data” has a destructive confirmation and clears local profile, preferences, recipe/cooking state, and images, with failure feedback. | Present. Recheck the cleanup list whenever local stores are added. |
| Account deletion | Signed-in account deletion is in-app, requires a valid session and explicit confirmations, calls server deletion, clears device state, reports failures, and has retry/support handling. | Good Apple-aligned shape. Verify the full server/vendor deletion behavior in production (see blockers). |
| Subscription notice | Deletion messaging says account deletion does not cancel App Store billing and points users to Apple subscription settings. | Present. Apple recommends asking subscribers to cancel before continuing, while still allowing immediate deletion. Add an explicit manage-subscription action or decision to the flow. |
| Permission purpose | Camera and photo-picker strings explain that the dish image is sent to Okyo’s service and an AI provider for identification and recipe creation. Microphone access is disabled. | Clear purpose; confirm generated release `Info.plist` uses these exact strings and no unused access appears. |
| Privacy manifest | `app.json` enables Expo privacy-manifest aggregation. No app-level `PrivacyInfo.xcprivacy` was found in source. | Archive inspection remains required; generated SDK manifests and any required-reason APIs must be present/valid in the final archive. Do not infer compliance from the config flag alone. |

## Findings and required work

### P0 — before App Store submission

1. **Publish and enter a public Privacy Policy URL.** There is no public website in the repository. The in-app policy is explicitly draft (`LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED = false`, version `0.1.0-draft`) and the store URL cannot point to an in-app screen. Host a publicly accessible, stable privacy policy page and enter it in App Store Connect. The page must remain readable without sign-in and match the reviewed app.
2. **Publish and enter a real Support URL.** App Store Connect requires a support website with actual contact information. Create a public support page that includes the monitored email and any publisher contact details required in the target markets; enter it in the platform’s Support URL field. A `mailto:` deep link is not a website URL.
3. **Settle the publisher identity and legal facts.** The Terms do not identify the contracting publisher/entity, minimum age, governing-law approach, or contact address; the regional supplements say these obligations are still being assessed. Supply verified facts and obtain qualified legal review before marking documents effective. Keep the in-app draft banner until that happens.
4. **Complete a vendor and data-flow review, then update both disclosures.** Code names Clerk (identity), OpenRouter and a routed model provider (AI), RevenueCat (entitlements), Apple (sign-in/purchases), and Sentry (present but sanitized/configuration-dependent). Confirm production enablement, exact data each receives, region, retention, deletion API behavior, and contractual privacy terms. Update the in-app policy, hosted policy, App Store privacy answers, privacy manifests, and any optional privacy-choices page to agree.
5. **Verify App Store privacy answers from the release archive and live configuration.** Likely relevant data includes identifiers/account data, user content (food images, text, generated/edited recipes), health/fitness or sensitive dietary data depending on the actual collected fields and Apple’s category definitions, usage/diagnostics if transmitted, and purchase data through partners. Determine linkage to identity, purpose, tracking status, and whether each collection is optional. Do not submit “no data collected” based on local-first storage: scans go to a service/AI vendor and sign-in/subscription SDKs are integrated. Apple requires inclusive disclosure of third-party collection.
6. **Confirm deletion truly reaches every controllable account/vendor record.** Repository code requests Clerk account deletion and RevenueCat customer deletion and handles Apple token revocation states. Verify deployed production secrets/config, provider API responses, asynchronous completion, retries, and that a successful user-facing “Account deleted” means every controllable record was actually deleted or that any remaining data and timeline are disclosed. Apple/StoreKit records and legally required records may remain; clearly identify those exceptions. Test signed-in Apple and Google accounts in production-like sandbox.
7. **Review subscription deletion path.** Apple says users with auto-renewable subscriptions should be notified billing continues and asked to cancel before proceeding; deletion must remain available immediately. Provide an explicit “Manage subscription” route (Apple’s system sheet/link) and let the user continue deleting even if they do not cancel. Current text warns about billing, but the deletion confirmation does not appear to provide a direct cancellation choice.

### P1 — fix/verify before release

8. **Correct a factual privacy-document contradiction.** The “Regional privacy rights” document said Okyo had no accounts and could not identify a user or find any server data, despite optional Clerk sign-in, an authenticated API, account deletion, and RevenueCat-linked identity. I corrected the in-app draft wording to acknowledge these flows and avoid promising that all requests are device-only. The paired internal counsel draft must be reconciled before review/sign-off.
9. **Verify support operations.** Test mail composer success and fallback on a device without a configured mail app; ensure the email address is monitored, support can handle privacy/account-deletion requests, and the public support page gives a practical response route. Apple’s support URL guidance requires actual contact info.
10. **Audit data retention and privacy language against implementation.** The policy says the on-device scan image stays with saved recipes and is deleted by local-data deletion; the server says image bytes are memory-only while result/cache state persists. Confirm the scan-image cleanup on success, failure, unsaved scans, saved recipes, logout, reinstall, and account deletion. Confirm stated cache durations, diagnostic log retention, analytics-off behavior, and AI vendor retention against the production deployment rather than source assumptions.
11. **Audit the final iOS archive.** Inspect `PrivacyInfo.xcprivacy` and SDK manifests, required-reason API declarations, `Info.plist` permission strings, linked SDK list, ATT usage (only if tracking applies), and Apple privacy report. Expo aggregation is configured, but the final archive is the proof. Do not add an ATT prompt unless actual cross-company tracking as Apple defines it occurs.
12. **Keep account creation optional for the cooking core.** App Review says apps without significant account-based features should let users use the app without login. Current settings gates sign-in on auth availability and local recipe use remains the product baseline; confirm no release configuration forces sign-in before scan/cook flows.

### P2 — improve the actual support experience

13. Add a concise Help FAQ entry for privacy requests (where to find local exportable data, data deletion versus account deletion, third-party records, and support contact) once the final request channel and retention facts are known.
14. Consider providing a privacy choices URL (optional in App Store Connect) with the same deletion, preferences, consent revocation, and support instructions. The in-app controls already provide the primary mechanisms.
15. Add localization for the public privacy/support pages and App Store metadata for every storefront/language supported by the app.

## Immediate submission checklist

- [ ] Live public privacy policy URL entered in App Store Connect and linked inside the app.
- [ ] Live Support URL with working contact information entered in App Store Connect.
- [ ] Publisher, minimum-age, region, retention, and subprocessor facts filled and counsel-reviewed.
- [ ] In-app and hosted documents share a published version/effective date and no draft banner.
- [ ] App Store privacy label answers reconcile with release build, SDKs, vendor data use, and privacy report.
- [ ] Account deletion verified end to end for Apple and Google sign-in, including vendor cleanup and failure/retry cases.
- [ ] Subscription deletion UX offers direct subscription management and still permits immediate account deletion.
- [ ] Release archive confirms privacy manifests, required-reason API declarations, and purpose strings.
- [ ] Help contact and data deletion flows manually checked on a physical iOS device.

## Source links

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/uk/)
- [Account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)
- [Manage app privacy in App Store Connect](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [App privacy reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy/)
- [Support URL requirements and description](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
- [Privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- [Sign in with Apple token revocation guidance](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
