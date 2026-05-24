# AI Pipeline

## Pipeline

1. User uploads image
2. Image compressed and stored temporarily
3. Vision model identifies dish
4. Structured dish object generated
5. User can correct low-confidence result
6. LLM generates recipes by mode
7. Cost engine calculates savings
8. Grocery list generated
9. Share card generated

## Rules

- Always include confidence.
- Never claim official restaurant recipe.
- Use copycat-style or inspired-by language.
- Validate model outputs with Zod.
- Add food safety notes.
