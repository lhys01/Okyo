# Onboarding question experiment

The `branch_questions_v1` experiment randomly assigns each install to a sticky
arm. The assignment is stored locally, so the same install stays in its version
when the app is reopened.

| Arm | Flow |
|---|---|
| A | Current questions and screens. |
| B | Removes questions scored 3 in the onboarding review. Skipped answers use neutral defaults where the plan still needs a value. |
| C | Shortest flow: no more than four user-facing branch screens, counting the intro. It keeps the highest-value inputs and supplies defaults for omitted optional personalization. |

For the health branch, C asks the problem, barrier, and goal questions. For
macros, C asks the main focus and target method, with the existing target-entry
screen when users choose known or estimated values. Savings C removes the
projection interstitial and the score-3 recipe-priority picker while retaining
the weekly snapshot and household-size question.

## Internal arm selection

Development builds show **Settings → Development → Onboarding test version**.
Force A, B, or C and then use **Reset onboarding** to preview that arm. Choosing
**Randomize onboarding version** clears the override and stored assignment, then
creates a new random arm for the next onboarding run. The selector is omitted
from release builds.

## Conversion events

- `onboarding_experiment_started`: a branch flow was entered.
- `onboarding_experiment_branch_completed`: the branch plan was saved and handed off.

Both events include only `experiment_name=branch_questions_v1` and the assigned
`experiment_variant`. No answer or selected goal branch is sent. Compare branch
completion event counts against start event counts by arm for an overall
branch-flow completion rate. Analytics must be enabled for the build through
the existing PostHog configuration; otherwise local assignment and the
development selector still work, but no remote conversion counts are sent.

The event's distinct ID is the app's current in-memory session ID, not a
persistent account identifier. This is suitable for aggregate event counts,
but not for following a person across sessions or de-duplicating repeated
onboarding attempts. Release analytics and privacy disclosures still need the
review described in `docs/security/ANALYTICS_PRIVACY_REVIEW_NOTES.md`.
