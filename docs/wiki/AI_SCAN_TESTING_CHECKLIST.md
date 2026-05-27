# AI Scan Testing Checklist

Use this checklist for a lightweight manual pass with 10 real food images. The API writes development-only scan summaries to `apps/api/logs/scan-evals.jsonl`; that file is local and ignored by Git.

Do not use confidential, private, or personally identifying images. AI dish names, costs, ingredients, and recipes are approximate estimates. Recipes should read as copycat-style or inspired-by, never official restaurant recipes.

## Setup

- Start the API from `apps/api`.
- Start the mobile app with `run`.
- Confirm `GET /debug/ai-config` shows `aiEnabled: true`, `provider: openrouter`, and `hasOpenRouterKey: true`.
- Use varied images: pasta, rice/noodle bowl, burger/sandwich, salad, plated protein, soup, dessert, low-light image, partially cropped image, and one ambiguous image.

## Per-image Notes

Copy this block once per image.

```text
Image #:
Food shown:
API aiSource:
Fallback reason, if any:
Dish name returned:
Confidence:
Restaurant price:
Homemade cost:
Savings:

Dish accuracy, 1-5:
Recipe usefulness, 1-5:
Cost believability, 1-5:
Confidence accuracy, 1-5:
Share-card appeal, 1-5:
Would-pay likelihood, 1-5:

What felt good:
What felt wrong:
Prompt/schema follow-up:
```

## Pass/Fail Guidance

- Dish accuracy passes when the name is specific enough to be useful and cautious when uncertain.
- Recipe usefulness passes when all three modes feel cookable, compact, and safe.
- Cost believability passes when restaurant price, homemade cost, and savings look realistic.
- Confidence accuracy passes when blurry or ambiguous images produce lower confidence.
- Share-card appeal passes when the result is easy to understand and worth sharing.
- Would-pay likelihood passes when the overall result feels valuable enough for a premium Okyo flow.

## After 10 Images

- Count how many scans used `openrouter_ai`, `mock_ai`, or `fallback_ai`.
- List the top 3 recurring model mistakes.
- List the top 3 prompt or normalization improvements to make next.
- Keep any screenshots or notes local unless they contain no personal data.
