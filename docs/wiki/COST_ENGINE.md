# Cost Engine

## Formula

```text
homemade_total = sum(ingredient_quantity_used * estimated_unit_cost)
cost_per_serving = homemade_total / servings
money_saved = restaurant_price - cost_per_serving
percent_saved = money_saved / restaurant_price
```

## Rules

- Always say estimated.
- Pantry items should be separated.
- User can edit restaurant price.
- Cost should be deterministic, not only LLM-generated.
