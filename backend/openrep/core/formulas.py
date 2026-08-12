"""Training formulas shared by the analytics routes and the widget query engine.

Extracted from `api/routes/analytics.py` so `core/widget_query.py` can reach it
without importing a route module. `analytics.py` still imports it from here, so
the formula has exactly one definition.
"""


def estimated_1rm(weight_kg: float, reps: int) -> float:
    """Epley formula. Reps of 1 return the weight itself."""
    if reps <= 1:
        return weight_kg
    return weight_kg * (1 + reps / 30)
