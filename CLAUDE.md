# CLAUDE.md - Okyo Routing Notes

Okyo is an AI food companion for turning restaurant or takeout food photos into honest inspired-by recipes, grocery lists, and savings estimates. It is not a calorie tracker, not a generic recipe app, and not a meal planner.

Read `AGENTS.md` for full repository working rules. Use this file as the short routing index for deeper docs.

Important model rules:
- OpenRouter with `openai/gpt-4o-mini` remains the default model path unless explicitly changed.
- Fable is opt-in only.
- Fable requires both `FABLE_ENABLED=true` and request header `x-okyo-model: fable`.
- Fable must fail closed with no silent Gemini or default-model fallback.
- Do not change AI defaults casually; scan and recipe outputs must stay honest, uncertain, retry-friendly, and never official restaurant recipes.

Generated/runtime files should not be edited or committed. Avoid `.swarm/`, `ruvector.db`, `node_modules/`, `__pycache__/`, generated skill mirrors, local `.env` files, analytics logs, build outputs, and generated assets unless the task explicitly targets them.

Start here:
- Wiki index: `docs/wiki/README.md`
- Onboarding: `docs/wiki/ONBOARDING.md`
- Scan flow: `docs/wiki/SCAN_FLOW.md`
- AI model routing: `docs/wiki/AI_MODEL_ROUTING.md`
- Fable routing: `docs/wiki/FABLE_ROUTING.md`
- Local setup: `docs/wiki/LOCAL_DEVELOPMENT.md`
- Security and cost controls: `docs/wiki/SECURITY.md`, `docs/wiki/COST_CONTROLS.md`
