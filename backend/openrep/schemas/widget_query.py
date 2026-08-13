"""The query language behind user-created widgets.

A custom widget is a *declarative* query, not code and not SQL: the user picks
a source, some filters, a grouping, and one or more aggregate metrics, and the
engine in `core/widget_query.py` runs it. Everything the user can name is drawn
from the whitelists below, so a stored query can never reach data or operations
this module has not enumerated.

Note the deliberate contrast with the dashboard *layout* (models/dashboard.py),
where the server has no widget catalog at all so a newer client's layout
survives a round trip. That freedom is only affordable because the server never
interprets a layout. Here it must: it executes the thing. So the catalog lives
on the server, and `GET /api/widgets/fields` publishes it to the editor — which
means adding a field or an aggregate stays a one-place change.
"""

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

# Caps. A personal query has no business being larger than this, and they are
# what bounds the size of the JSON column the query is stored in.
MAX_FILTERS = 8
MAX_METRICS = 4
MAX_RESULT_ROWS = 500

FilterOp = Literal["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "is_null", "not_null"]
Aggregate = Literal["sum", "avg", "min", "max", "count", "count_distinct"]
GroupBy = Literal["none", "day", "week", "month", "weekday", "exercise", "category", "rep_range"]
Visualization = Literal["bar", "line", "table", "stat"]
SortDirection = Literal["asc", "desc"]

FieldKind = Literal["number", "text", "date"]
# Drives display on the client: a "weight" column is converted to lb for an
# imperial user, the rest are shown as-is (see lib/units.ts).
Unit = Literal["weight", "reps", "rpe", "count", "none"]

# Operators that take no value at all, and the ones that take a list.
VALUELESS_OPS: frozenset[str] = frozenset({"is_null", "not_null"})
LIST_OPS: frozenset[str] = frozenset({"in"})
# Ordering comparisons are meaningless on free text and would silently compare
# lexicographically, which reads as a bug rather than a feature.
NUMERIC_ONLY_OPS: frozenset[str] = frozenset({"gt", "gte", "lt", "lte"})
TEXT_ONLY_OPS: frozenset[str] = frozenset({"contains"})

# `count` counts rows, so it is the one aggregate that needs no field.
FIELDLESS_AGGREGATES: frozenset[str] = frozenset({"count"})
# Averaging or summing a name is not a thing; distinct-counting one is.
NUMERIC_ONLY_AGGREGATES: frozenset[str] = frozenset({"sum", "avg"})


@dataclass(frozen=True)
class QueryField:
    """One column the user can filter, group, or aggregate on."""

    key: str
    label: str
    kind: FieldKind
    unit: Unit
    #: False for dates and names — there is nothing to compute over them.
    aggregatable: bool = True
    #: A row identifier. Countable, never summed or averaged: the total of a
    #: column of primary keys is a number with no meaning.
    identifier: bool = False
    description: str = ""


# The grain is one row per set, joined to its workout and exercise. Computed
# columns (volume, estimated_1rm) are first-class here precisely because they
# are what a lifter actually wants to chart — making the user multiply weight
# by reps themselves would defeat the point.
QUERY_FIELDS: tuple[QueryField, ...] = (
    QueryField("performed_on", "Date", "date", "none", aggregatable=False),
    QueryField("exercise_name", "Exercise name", "text", "none", aggregatable=False),
    QueryField("category", "Category", "text", "none", aggregatable=False),
    QueryField(
        "weight_kg", "Weight", "number", "weight", description="Weight on the bar, in kilograms."
    ),
    QueryField("reps", "Reps", "number", "reps"),
    QueryField("rpe", "RPE", "number", "rpe", description="Blank on sets logged without one."),
    QueryField("volume", "Volume", "number", "weight", description="Weight × reps, in kilograms."),
    QueryField(
        "estimated_1rm",
        "Estimated 1RM",
        "number",
        "weight",
        description="Epley estimate from this set's weight and reps.",
    ),
    QueryField("set_order", "Set number", "number", "count"),
    QueryField(
        "exercise_id",
        "Exercise",
        "number",
        "count",
        identifier=True,
        description="Distinct-count it to count exercises; filter on it to pin one.",
    ),
    QueryField(
        "workout_id",
        "Session",
        "number",
        "count",
        identifier=True,
        description="Distinct-count it to count training sessions.",
    ),
    QueryField(
        "set_id",
        "Set",
        "number",
        "count",
        identifier=True,
        description="Distinct-count it to count sets.",
    ),
)

FIELDS_BY_KEY: dict[str, QueryField] = {field.key: field for field in QUERY_FIELDS}

# Fixed buckets for `group_by: rep_range`. Upper bound is inclusive; the last
# bucket is open-ended.
REP_RANGES: tuple[tuple[str, int, int | None], ...] = (
    ("1-3", 1, 3),
    ("4-6", 4, 6),
    ("7-10", 7, 10),
    ("11-15", 11, 15),
    ("16+", 16, None),
)

GROUP_BY_LABELS: dict[str, str] = {
    "none": "No grouping (one total)",
    "day": "Day",
    "week": "Week",
    "month": "Month",
    "weekday": "Day of the week",
    "exercise": "Exercise",
    "category": "Category",
    "rep_range": "Rep range",
}

AGGREGATE_LABELS: dict[str, str] = {
    "sum": "Total",
    "avg": "Average",
    "min": "Lowest",
    "max": "Highest",
    "count": "Count of sets",
    "count_distinct": "Distinct count",
}

FILTER_OP_LABELS: dict[str, str] = {
    "eq": "is",
    "ne": "is not",
    "gt": "is more than",
    "gte": "is at least",
    "lt": "is less than",
    "lte": "is at most",
    "in": "is one of",
    "contains": "contains",
    "is_null": "is blank",
    "not_null": "is not blank",
}

# Ranges the editor offers, mirroring RangeDays in lib/dashboard.ts. Resolved to
# a start date on the *client* — see the note on WidgetQuery.range_days.
RANGE_DAY_CHOICES: tuple[int, ...] = (30, 90, 365)


class QueryFilter(BaseModel):
    """One condition. `value` is a scalar, or a list when the operator is `in`."""

    field: str
    op: FilterOp
    value: Any = None

    @model_validator(mode="after")
    def check_field_and_value(self) -> "QueryFilter":
        spec = FIELDS_BY_KEY.get(self.field)
        if spec is None:
            raise ValueError(f"Unknown field {self.field!r}")

        if self.op in NUMERIC_ONLY_OPS and spec.kind == "text":
            raise ValueError(f"{spec.label} cannot be compared with {FILTER_OP_LABELS[self.op]}")
        if self.op in TEXT_ONLY_OPS and spec.kind != "text":
            raise ValueError(f"{spec.label} is not text, so it cannot use 'contains'")

        if self.op in VALUELESS_OPS:
            self.value = None
        elif self.op in LIST_OPS:
            if not isinstance(self.value, list) or not self.value:
                raise ValueError("'is one of' needs a non-empty list of values")
            if len(self.value) > 50:
                raise ValueError("'is one of' takes at most 50 values")
        elif self.value is None:
            raise ValueError(f"{FILTER_OP_LABELS[self.op]} needs a value")

        return self


class QueryMetric(BaseModel):
    """One aggregated column. `key` names it in every result row."""

    key: str = Field(min_length=1, max_length=32, pattern=r"^[a-z][a-z0-9_]*$")
    agg: Aggregate
    field: str | None = None
    label: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def check_field(self) -> "QueryMetric":
        if self.agg in FIELDLESS_AGGREGATES:
            self.field = None
            return self

        if self.field is None:
            raise ValueError(f"'{AGGREGATE_LABELS[self.agg]}' needs a field")
        spec = FIELDS_BY_KEY.get(self.field)
        if spec is None:
            raise ValueError(f"Unknown field {self.field!r}")
        if not spec.aggregatable:
            raise ValueError(f"{spec.label} cannot be aggregated")
        if spec.identifier and self.agg != "count_distinct":
            raise ValueError(f"{spec.label} can only be distinct-counted")
        if self.agg in NUMERIC_ONLY_AGGREGATES and spec.kind != "number":
            raise ValueError(f"{spec.label} is not a number, so it cannot be totalled or averaged")
        return self

    def resolved_label(self) -> str:
        if self.label:
            return self.label
        if self.agg in FIELDLESS_AGGREGATES:
            return AGGREGATE_LABELS[self.agg]
        field_label = FIELDS_BY_KEY[self.field].label if self.field else ""
        return f"{AGGREGATE_LABELS[self.agg]} {field_label.lower()}"

    def unit(self) -> Unit:
        if self.agg in {"count", "count_distinct"} or self.field is None:
            return "count"
        return FIELDS_BY_KEY[self.field].unit


class QuerySort(BaseModel):
    """`by` is either the literal "group" or one of the metric keys."""

    by: str = "group"
    direction: SortDirection = "asc"


class WidgetQuery(BaseModel):
    source: Literal["sets"] = "sets"
    filters: list[QueryFilter] = Field(default_factory=list, max_length=MAX_FILTERS)
    group_by: GroupBy = "none"
    metrics: list[QueryMetric] = Field(min_length=1, max_length=MAX_METRICS)
    sort: QuerySort = Field(default_factory=QuerySort)
    limit: int | None = Field(default=None, ge=1, le=MAX_RESULT_ROWS)
    #: A rolling window, resolved to an explicit start date by the *client* and
    #: passed back as the `start` query param. The server never resolves
    #: "today": it would use its own clock and timezone, while every date in
    #: this app is a local calendar day (see the note in widgetData.ts). Stored
    #: here so the window travels with the widget rather than with one
    #: placement of it on the dashboard.
    range_days: int | None = Field(default=None, ge=1, le=3650)

    @model_validator(mode="after")
    def check_sort_and_keys(self) -> "WidgetQuery":
        keys = [metric.key for metric in self.metrics]
        duplicates = {key for key in keys if keys.count(key) > 1}
        if duplicates:
            raise ValueError(f"Duplicate metric key {min(duplicates)!r}")

        if self.sort.by != "group" and self.sort.by not in keys:
            raise ValueError(f"Cannot sort by {self.sort.by!r}: no metric has that key")
        # "No grouping" produces exactly one row, so there is no group to sort
        # by. Rejecting would be pedantic about a choice the user cannot see.
        if self.group_by == "none":
            self.sort = QuerySort(by="group", direction="asc")
            self.limit = None
        return self


class QueryColumn(BaseModel):
    """A column in the result, in display order — the group first, then metrics."""

    key: str
    label: str
    kind: Literal["group", "metric"]
    unit: Unit


class QueryResult(BaseModel):
    columns: list[QueryColumn]
    #: `{"group": <str|null>, "<metric key>": <float|null>, ...}`. A metric is
    #: null when the group held no value to aggregate (every RPE blank, say) —
    #: which is not the same as zero, and the client renders it as "—".
    rows: list[dict[str, Any]]
    group_by: GroupBy
    #: True when the result hit MAX_RESULT_ROWS and the tail was cut.
    truncated: bool = False


class FieldInfo(BaseModel):
    key: str
    label: str
    kind: FieldKind
    unit: Unit
    aggregatable: bool
    description: str
    #: The operators that are legal for this field, precomputed so the editor
    #: does not have to re-derive the rules above.
    ops: list[FilterOp]
    aggregates: list[Aggregate]


class ChoiceInfo(BaseModel):
    value: str
    label: str


class QueryCatalog(BaseModel):
    """Everything the widget editor needs to render itself."""

    fields: list[FieldInfo]
    group_by: list[ChoiceInfo]
    aggregates: list[ChoiceInfo]
    visualizations: list[ChoiceInfo]
    range_days: list[int]
    rep_ranges: list[str]
    max_filters: int
    max_metrics: int
    max_rows: int


def _ops_for(field: QueryField) -> list[FilterOp]:
    ops: list[FilterOp] = ["eq", "ne"]
    if field.kind != "text":
        ops += ["gt", "gte", "lt", "lte"]
    else:
        ops.append("contains")
    ops.append("in")
    # Only RPE is actually nullable today, but offering blank-checks on every
    # field costs nothing and stays correct if another column becomes optional.
    ops += ["is_null", "not_null"]
    return ops


def _aggregates_for(field: QueryField) -> list[Aggregate]:
    if not field.aggregatable:
        return []
    if field.identifier:
        return ["count_distinct"]
    if field.kind == "number":
        return ["sum", "avg", "min", "max", "count_distinct"]
    return ["min", "max", "count_distinct"]


def build_catalog() -> QueryCatalog:
    return QueryCatalog(
        fields=[
            FieldInfo(
                key=field.key,
                label=field.label,
                kind=field.kind,
                unit=field.unit,
                aggregatable=field.aggregatable,
                description=field.description,
                ops=_ops_for(field),
                aggregates=_aggregates_for(field),
            )
            for field in QUERY_FIELDS
        ],
        group_by=[ChoiceInfo(value=key, label=label) for key, label in GROUP_BY_LABELS.items()],
        aggregates=[ChoiceInfo(value=key, label=label) for key, label in AGGREGATE_LABELS.items()],
        visualizations=[
            ChoiceInfo(value="bar", label="Bar chart"),
            ChoiceInfo(value="line", label="Line chart"),
            ChoiceInfo(value="table", label="Table"),
            ChoiceInfo(value="stat", label="Big number"),
        ],
        range_days=list(RANGE_DAY_CHOICES),
        rep_ranges=[label for label, _lo, _hi in REP_RANGES],
        max_filters=MAX_FILTERS,
        max_metrics=MAX_METRICS,
        max_rows=MAX_RESULT_ROWS,
    )
