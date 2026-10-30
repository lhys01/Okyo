# Onboarding A/B/C reporting

The pinned development dashboard is [Okyo Onboarding A/B/C — Development](https://us.posthog.com/project/584818/dashboard/2257926). It contains branch completion, time to account creation, successful account creation, and full onboarding completion funnels, each broken down by `experiment_variant`. Project 584818 is development-only; do not use it to assess production users.

The onboarding selector lives under **Settings → Admin Tools** and appears only for a signed-in account whose email is listed in `EXPO_PUBLIC_OKYO_ADMIN_EMAILS` in `apps/mobile/.env.local`. Use a comma-separated exact email allowlist. Leave it empty in public builds; ordinary users and development testers cannot choose or force a version. The allowlist controls client UI visibility and is not backend authorization. The admin selector can set A, B, or C for a local preview, or clear the override to return to random assignment.

When PostHog is configured, the app sends these privacy-filtered events with `experiment_name=branch_questions_v1` and `experiment_variant=A|B|C`:

- `onboarding_experiment_started` when a user enters their assigned branch.
- `onboarding_experiment_branch_completed` when they finish that branch.
- `account_creation_started` when the onboarding flow reaches the create-account screen.
- `onboarding_completed` when the full onboarding ends.
- `account_created` only when Apple or Google reports a new `sign_up` flow.

All events use the app's anonymous analytics ID. They do not include account IDs, answers, names, email addresses, photos, or free text.

In PostHog, create a Funnel insight with `onboarding_experiment_started` → `onboarding_experiment_branch_completed` or `onboarding_completed`, then break down by `experiment_variant`. For reaching signup fastest, use `onboarding_experiment_started` → `account_creation_started`; compare conversion rate and median time to convert by variant. For completed signups, use `account_creation_started` → `account_created`, also broken down by variant. A Trends insight on `onboarding_experiment_branch_completed` broken down by variant shows raw completion volume. These event pairs share the app's anonymous analytics ID. The app uses the configured project key in `EXPO_PUBLIC_POSTHOG_KEY`; `EXPO_PUBLIC_POSTHOG_PROJECT_ID` is shown in the local environment template for identifying the project in PostHog.
