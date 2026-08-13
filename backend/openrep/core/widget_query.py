"""Executes a user-authored `WidgetQuery` against the training tables.

Shape of the thing: one SQL statement fetches the set grain (set ⋈ workout ⋈
exercise) with the date window pushed down, and everything after that —
filtering, bucketing, aggregation, sorting — happens in Python.

That split is deliberate. `performed_on` is the indexed, high-selectivity
column and the one filter nearly every widget carries, so pushing it down is
most of the win. Translating the *rest* of the operators into SQL would mean
maintaining two implementations of what `contains` or `is one of` mean, one in
SQLAlchemy expressions and one in Python for the computed columns (`volume`,
`estimated_1rm`) that have no column to push down to. One implementation that
is always right beats two that can disagree. It is also how analytics.py
already works — `recent_personal_records` scans every set and aggregates in
Python — and this is a single-user database on the user's own laptop.
"""

from collections.abc import Callable, Iterable
from datetime import date
from typing import Any

from sqlmodel import Session, select

from openrep.core.formulas import estimated_1rm
from openrep.models.exercise import Exercise
from openrep.models.set import SetEntry
from openrep.models.workout import Workout
from openrep.schemas.widget_query import (
    FIELDS_BY_KEY,
    GROUP_BY_LABELS,
    MAX_RESULT_ROWS,
    REP_RANGES,
    QueryColumn,
    QueryFilter,
    QueryMetric,
    QueryResult,
    WidgetQuery,
)

#: One row of the set grain, keyed by the field keys in QUERY_FIELDS.
Row = dict[str, Any]

WEEKDAY_LABELS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def _fetch_rows(session: Session, start: date | None, end: date | None) -> list[Row]:
    query = (
        select(SetEntry, Workout.performed_on, Exercise.name, Exercise.category)
        .join(Workout, SetEntry.workout_id == Workout.id)
        .join(Exercise, SetEntry.exercise_id == Exercise.id)
    )
    if start is not None:
        query = query.where(Workout.performed_on >= start)
    if end is not None:
        query = query.where(Workout.performed_on <= end)

    return [
        {
            "set_id": entry.id,
            "workout_id": entry.workout_id,
            "exercise_id": entry.exercise_id,
            "exercise_name": exercise_name,
            "category": category,
            "performed_on": performed_on,
            "weight_kg": entry.weight_kg,
            "reps": entry.reps,
            "rpe": entry.rpe,
            "set_order": entry.set_order,
            "volume": entry.weight_kg * entry.reps,
            "estimated_1rm": estimated_1rm(entry.weight_kg, entry.reps),
        }
        for entry, performed_on, exercise_name, category in session.exec(query).all()
    ]


# --- filtering -------------------------------------------------------------


def _coerce(field_key: str, value: Any) -> Any:
    """JSON scalars → the type the row holds.

    Only dates need real work: they arrive as `YYYY-MM-DD` strings and would
    otherwise be compared against a `date` object and raise.
    """
    spec = FIELDS_BY_KEY[field_key]
    if spec.kind == "date" and isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    if spec.kind == "number" and isinstance(value, bool):
        # bool is an int in Python; comparing True to a weight is nonsense.
        return None
    return value


def _matches(row: Row, condition: QueryFilter) -> bool:
    left = row.get(condition.field)

    if condition.op == "is_null":
        return left is None
    if condition.op == "not_null":
        return left is not None
    # SQL semantics: a NULL never satisfies a comparison. Without this a blank
    # RPE would count as "RPE is not 8", which is not what the user asked.
    if left is None:
        return False

    if condition.op == "in":
        values = [_coerce(condition.field, item) for item in condition.value]
        return left in values

    right = _coerce(condition.field, condition.value)
    if right is None:
        return False

    if condition.op == "contains":
        return str(right).casefold() in str(left).casefold()

    try:
        match condition.op:
            case "eq":
                return left == right
            case "ne":
                return left != right
            case "gt":
                return left > right
            case "gte":
                return left >= right
            case "lt":
                return left < right
            case "lte":
                return left <= right
    except TypeError:
        # Mismatched types (a text value against a number field, say). Treat as
        # "no match" rather than 500-ing on a query the user can still fix.
        return False
    return False


# --- grouping --------------------------------------------------------------


def _rep_range_label(reps: int) -> str:
    for label, low, high in REP_RANGES:
        if reps >= low and (high is None or reps <= high):
            return label
    return REP_RANGES[0][0]


def _group_key(row: Row, group_by: str) -> str | None:
    match group_by:
        case "none":
            return None
        case "day":
            return row["performed_on"].isoformat()
        case "week":
            iso = row["performed_on"].isocalendar()
            return f"{iso.year}-W{iso.week:02d}"
        case "month":
            return row["performed_on"].strftime("%Y-%m")
        case "weekday":
            return WEEKDAY_LABELS[row["performed_on"].weekday()]
        case "exercise":
            return row["exercise_name"]
        case "category":
            return row["category"]
        case "rep_range":
            return _rep_range_label(row["reps"])
    return None


def _group_order(group_by: str) -> Callable[[str | None], Any]:
    """Sort key for group labels.

    Several groupings have an order that is not their alphabetical one:
    "16+" sorts before "4-6" as a string, and Friday before Monday.
    """
    if group_by == "rep_range":
        order = [label for label, _low, _high in REP_RANGES]
        return lambda label: order.index(label) if label in order else len(order)
    if group_by == "weekday":
        return lambda label: WEEKDAY_LABELS.index(label) if label in WEEKDAY_LABELS else 7
    return lambda label: label or ""


# --- aggregation -----------------------------------------------------------


def _aggregate(rows: list[Row], metric: QueryMetric) -> float | None:
    if metric.agg == "count":
        return float(len(rows))

    field_key = metric.field
    assert field_key is not None  # guaranteed by QueryMetric's validator
    values = [row[field_key] for row in rows if row.get(field_key) is not None]

    if metric.agg == "count_distinct":
        return float(len(set(values)))
    if not values:
        # No value to aggregate is not the same as zero — an exercise with every
        # RPE left blank has no average RPE, and charting 0 would be a lie.
        return None

    match metric.agg:
        case "sum":
            return sum(values)
        case "avg":
            return sum(values) / len(values)
        case "min":
            return min(values)
        case "max":
            return max(values)
    return None


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 2)


def _sorted_groups(
    grouped: Iterable[tuple[str | None, dict[str, Any]]], query: WidgetQuery
) -> list[tuple[str | None, dict[str, Any]]]:
    descending = query.sort.direction == "desc"

    if query.sort.by == "group":
        order = _group_order(query.group_by)
        return sorted(grouped, key=lambda item: order(item[0]), reverse=descending)

    metric_key = query.sort.by
    group_order = _group_order(query.group_by)

    def key(item: tuple[str | None, dict[str, Any]]) -> tuple[int, float, Any]:
        value = item[1].get(metric_key)
        # Null metrics sort last in both directions: they are absence of data,
        # not a smallest value, so they should never top a "best of" chart.
        missing = 1 if value is None else 0
        if descending:
            missing = -missing
        return (missing, value if value is not None else 0.0, group_order(item[0]))

    return sorted(grouped, key=key, reverse=descending)


# --- entry point -----------------------------------------------------------


def run_widget_query(
    session: Session,
    query: WidgetQuery,
    start: date | None = None,
    end: date | None = None,
) -> QueryResult:
    """Run `query`, optionally narrowed to a `performed_on` window.

    `start`/`end` come from the caller (the client resolves `range_days`
    against its own clock) and are ANDed with whatever date filters the query
    itself carries.
    """
    rows = [
        row
        for row in _fetch_rows(session, start, end)
        if all(_matches(row, condition) for condition in query.filters)
    ]

    buckets: dict[str | None, list[Row]] = {}
    for row in rows:
        buckets.setdefault(_group_key(row, query.group_by), []).append(row)

    # "No grouping" still owes the caller a row when nothing matched, so the
    # widget can render "0 sets" rather than an empty chart.
    if query.group_by == "none" and not buckets:
        buckets[None] = []

    aggregated = [
        (label, {metric.key: _round(_aggregate(bucket, metric)) for metric in query.metrics})
        for label, bucket in buckets.items()
    ]
    ordered = _sorted_groups(aggregated, query)

    if query.limit is not None:
        ordered = ordered[: query.limit]
    truncated = len(ordered) > MAX_RESULT_ROWS
    ordered = ordered[:MAX_RESULT_ROWS]

    group_label = "Total" if query.group_by == "none" else GROUP_BY_LABELS[query.group_by]
    columns = [QueryColumn(key="group", label=group_label, kind="group", unit="none")]
    columns += [
        QueryColumn(
            key=metric.key, label=metric.resolved_label(), kind="metric", unit=metric.unit()
        )
        for metric in query.metrics
    ]

    return QueryResult(
        columns=columns,
        rows=[{"group": label, **values} for label, values in ordered],
        group_by=query.group_by,
        truncated=truncated,
    )
