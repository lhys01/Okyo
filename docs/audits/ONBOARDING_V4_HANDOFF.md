# Okyo Onboarding V4 — Release Handoff

## Release readiness

Conditionally ready. Not released. Automated TypeScript, migration, transaction, accessibility-source, deletion, and API checks pass within the approved baseline. Device, StoreKit/RevenueCat sandbox, camera permission, VoiceOver, and performance measurements still require release-candidate validation on real hardware or a configured simulator.

## Activation and rollback

`ONBOARDING_V4_ENABLED` is a build-time source boolean. It is neither remote configuration nor an instant production kill switch. A shipped build requires a new binary/release to change it.

Current activation selects exactly one engine before either controller mounts:

| Install state | Selected route |
| --- | --- |
| Completed onboarding | Main app |
| Flag off | retained V3 fallback |
| Sticky `v3` | retained V3 fallback |
| Sticky `v4` | V4 |
| Missing assignment + V4 evidence | V4 and persist `v4` |
| Missing assignment + V3 evidence | V3 and persist `v3` |
| New install | V4 and persist `v4` |
| Assignment/storage read failure | V3 fallback |

Rollback procedure: change `ONBOARDING_V4_ENABLED` to `false`, run mobile typecheck and the activation suite, build and distribute a replacement binary, then monitor the retained V3 flow. Do not clear the V4 draft, scan receipt, free-result receipt, or premium-action record; restoring the flag resumes the same V4 state.

## Verified product contracts

- All four goals reach a free usable canonical recipe before an explicit Cook or non-empty customization can show a paywall.
- `not_sure` retains history while its selected transformation resolves to the canonical real goal before plan, generation, and result rendering.
- Free-result consumption occurs only after canonical recipe commit and durable receipt persistence. In-flight scan recovery, receipt failure, and restart behavior are covered by transaction tests.
- Save, Groceries, Share, viewing, and reopening are paywall-free and do not record progress. Actual savings and macros require real Cook Mode completion.
- Cook and customization restore their exact durable actions. Local canonical application is idempotent; remote correction exactly-once remains bounded by the API's in-process, time-limited `correctionRequestId` cache.
- Allergies, restrictions, avoidances, and dislikes remain separate. Allergy reminders never claim automated matching is safety verification.
- User-facing cost copy uses “Eating out” and “Make at home.”

## Privacy and deletion

Delete-my-data clears canonical profile/dietary data, recipes/store data through the store reset, experiment assignment, V4 draft, in-flight scan, free-result receipt, premium action (including customization text), and onboarding completion. Bundled artwork remains intentionally outside user data. V4 analytics use an allow-list and reject names, dietary contents, body measurements, image URIs, free text, receipts, and purchase identifiers.

## Manual release-candidate checklist

- iOS simulator/device: fresh install; background/resume at questions, analysis, recipe, paywall, Cook, and customization; V3 assignment rollback; completed-user launch.
- Camera/photo library: grant, deny, limited access, cancel picker, cancel confirmation, and missing local photo after restart.
- RevenueCat/StoreKit sandbox: entitlement loading/error, existing subscriber, purchase cancellation/failure, purchase/restore success, localized long prices, and no real charge.
- Accessibility: VoiceOver traversal, Dynamic Type, Reduce Motion, keyboard avoidance, small and large supported iPhones, and loading/error announcements.
- Performance: launch-to-first-screen, result/large-recipe rendering, repeated hydration, and offline recovery.

No physical-device, StoreKit sandbox, network, memory, battery, or frame-rate result is asserted by this document; those checks need the configured release environment.
