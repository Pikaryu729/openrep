from fastapi.testclient import TestClient

# Two exercises in two categories, across three days, so every grouping has
# something to say. Weights are round numbers to keep expected volumes exact.
SETS = [
    # (day, exercise, weight_kg, reps, rpe)
    ("2026-01-05", "Back Squat", 100.0, 5, 8.0),
    ("2026-01-05", "Back Squat", 100.0, 5, 9.0),
    ("2026-01-05", "Bench Press", 60.0, 10, None),
    ("2026-01-12", "Back Squat", 110.0, 3, 9.0),
    ("2026-01-12", "Bench Press", 65.0, 8, 7.0),
    ("2026-02-02", "Back Squat", 120.0, 1, 10.0),
]

CATEGORIES = {"Back Squat": "legs", "Bench Press": "push"}


def seed(client: TestClient) -> dict[str, int]:
    """Build the fixture through the API, per the house rule in conftest."""
    exercise_ids: dict[str, int] = {}
    for name, category in CATEGORIES.items():
        response = client.post("/api/exercises", json={"name": name, "category": category})
        exercise_ids[name] = response.json()["id"]

    workout_ids: dict[str, int] = {}
    for day, exercise, weight, reps, rpe in SETS:
        if day not in workout_ids:
            workout_ids[day] = client.post("/api/workouts", json={"performed_on": day}).json()["id"]
        client.post(
            "/api/sets",
            json={
                "workout_id": workout_ids[day],
                "exercise_id": exercise_ids[exercise],
                "weight_kg": weight,
                "reps": reps,
                **({"rpe": rpe} if rpe is not None else {}),
            },
        )
    return exercise_ids


def query(**overrides) -> dict:
    base = {
        "source": "sets",
        "filters": [],
        "group_by": "day",
        "metrics": [{"key": "vol", "agg": "sum", "field": "volume"}],
        "sort": {"by": "group", "direction": "asc"},
    }
    return {**base, **overrides}


def preview(client: TestClient, spec: dict, **params) -> dict:
    response = client.post("/api/widgets/preview", json=spec, params=params)
    assert response.status_code == 200, response.text
    return response.json()


# --- catalog ---------------------------------------------------------------


def test_catalog_describes_the_query_language(client: TestClient):
    body = client.get("/api/widgets/fields").json()

    keys = {field["key"] for field in body["fields"]}
    assert {"volume", "estimated_1rm", "reps", "rpe", "category", "performed_on"} <= keys

    by_key = {field["key"]: field for field in body["fields"]}
    # Text fields get `contains` and no ordering comparisons; numbers the reverse.
    assert "contains" in by_key["category"]["ops"]
    assert "gt" not in by_key["category"]["ops"]
    assert "gt" in by_key["volume"]["ops"]
    # A name cannot be aggregated at all, and an id can only be counted.
    assert by_key["category"]["aggregatable"] is False
    assert by_key["workout_id"]["aggregates"] == ["count_distinct"]
    assert by_key["volume"]["aggregates"] == ["sum", "avg", "min", "max", "count_distinct"]

    assert {choice["value"] for choice in body["group_by"]} >= {"day", "week", "exercise"}
    assert body["max_metrics"] == 4


# --- query execution -------------------------------------------------------


def test_group_by_day_sums_volume(client: TestClient):
    seed(client)
    body = preview(client, query())

    assert body["group_by"] == "day"
    assert [column["key"] for column in body["columns"]] == ["group", "vol"]
    assert body["columns"][1]["unit"] == "weight"
    assert [(row["group"], row["vol"]) for row in body["rows"]] == [
        ("2026-01-05", 100 * 5 + 100 * 5 + 60 * 10),
        ("2026-01-12", 110 * 3 + 65 * 8),
        ("2026-02-02", 120 * 1),
    ]


def test_group_by_none_returns_one_total_row(client: TestClient):
    seed(client)
    body = preview(client, query(group_by="none"))

    assert len(body["rows"]) == 1
    assert body["rows"][0]["group"] is None
    assert body["rows"][0]["vol"] == sum(weight * reps for _d, _e, weight, reps, _r in SETS)


def test_group_by_none_still_answers_when_nothing_matches(client: TestClient):
    """An empty chart and "you have logged 0 sets" are different messages."""
    body = preview(client, query(group_by="none", metrics=[{"key": "n", "agg": "count"}]))
    assert body["rows"] == [{"group": None, "n": 0.0}]


def test_group_by_exercise_and_category(client: TestClient):
    seed(client)
    by_exercise = preview(client, query(group_by="exercise"))
    assert [row["group"] for row in by_exercise["rows"]] == ["Back Squat", "Bench Press"]

    by_category = preview(client, query(group_by="category"))
    assert [row["group"] for row in by_category["rows"]] == ["legs", "push"]


def test_group_by_week_and_month(client: TestClient):
    seed(client)
    weeks = preview(client, query(group_by="week"))
    assert [row["group"] for row in weeks["rows"]] == ["2026-W02", "2026-W03", "2026-W06"]

    months = preview(client, query(group_by="month"))
    assert [row["group"] for row in months["rows"]] == ["2026-01", "2026-02"]


def test_rep_range_groups_sort_numerically_not_alphabetically(client: TestClient):
    seed(client)
    body = preview(client, query(group_by="rep_range"))
    # Alphabetically "1-3" < "16+" < "4-6" < "7-10"; the fixed bucket order wins.
    assert [row["group"] for row in body["rows"]] == ["1-3", "4-6", "7-10"]


def test_weekday_groups_sort_by_weekday(client: TestClient):
    seed(client)
    body = preview(client, query(group_by="weekday"))
    # 2026-01-05 and 2026-01-12 are Mondays, 2026-02-02 is also a Monday.
    assert [row["group"] for row in body["rows"]] == ["Mon"]


def test_metrics_cover_every_aggregate(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            metrics=[
                {"key": "sets", "agg": "count"},
                {"key": "sessions", "agg": "count_distinct", "field": "workout_id"},
                {"key": "best", "agg": "max", "field": "weight_kg"},
                {"key": "avg_reps", "agg": "avg", "field": "reps"},
            ],
        ),
    )
    row = body["rows"][0]
    assert row["sets"] == 6.0
    assert row["sessions"] == 3.0
    assert row["best"] == 120.0
    assert row["avg_reps"] == round(sum(s[3] for s in SETS) / 6, 2)


def test_estimated_1rm_metric_uses_the_epley_formula(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            metrics=[{"key": "e1rm", "agg": "max", "field": "estimated_1rm"}],
        ),
    )
    # 110kg x 3 → 110 * (1 + 3/30) = 121, the best in the fixture.
    assert body["rows"][0]["e1rm"] == 121.0


def test_missing_values_aggregate_to_null_not_zero(client: TestClient):
    """Bench Press has one set with no RPE; an average must not treat it as 0."""
    seed(client)
    body = preview(
        client,
        query(group_by="exercise", metrics=[{"key": "rpe", "agg": "avg", "field": "rpe"}]),
    )
    values = {row["group"]: row["rpe"] for row in body["rows"]}
    assert values["Bench Press"] == 7.0  # the blank one is excluded, not averaged in
    assert values["Back Squat"] == round((8 + 9 + 9 + 10) / 4, 2)


def test_group_with_no_values_at_all_is_null(client: TestClient):
    seed(client)
    # Only the RPE-less Bench Press set has 10 reps, so its group has nothing
    # to average.
    body = preview(
        client,
        query(
            group_by="exercise",
            filters=[{"field": "reps", "op": "eq", "value": 10}],
            metrics=[{"key": "rpe", "agg": "avg", "field": "rpe"}],
        ),
    )
    assert body["rows"] == [{"group": "Bench Press", "rpe": None}]


# --- filters ---------------------------------------------------------------


def test_filters_combine_with_and(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            filters=[
                {"field": "category", "op": "eq", "value": "legs"},
                {"field": "reps", "op": "gte", "value": 5},
            ],
            metrics=[{"key": "n", "agg": "count"}],
        ),
    )
    assert body["rows"][0]["n"] == 2.0


def test_contains_is_case_insensitive(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            filters=[{"field": "exercise_name", "op": "contains", "value": "squat"}],
            metrics=[{"key": "n", "agg": "count"}],
        ),
    )
    assert body["rows"][0]["n"] == 4.0  # every Back Squat set, despite the lowercase


def test_in_filter_matches_any_listed_value(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            filters=[{"field": "reps", "op": "in", "value": [1, 3]}],
            metrics=[{"key": "n", "agg": "count"}],
        ),
    )
    assert body["rows"][0]["n"] == 2.0


def test_null_never_satisfies_a_comparison(client: TestClient):
    """The blank RPE must not count as "RPE is not 8"."""
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            filters=[{"field": "rpe", "op": "ne", "value": 8}],
            metrics=[{"key": "n", "agg": "count"}],
        ),
    )
    assert body["rows"][0]["n"] == 4.0  # 6 sets, minus the 8.0 and minus the blank

    blanks = preview(
        client,
        query(
            group_by="none",
            filters=[{"field": "rpe", "op": "is_null"}],
            metrics=[{"key": "n", "agg": "count"}],
        ),
    )
    assert blanks["rows"][0]["n"] == 1.0


def test_date_filter_inside_the_query(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            filters=[{"field": "performed_on", "op": "gte", "value": "2026-01-12"}],
            metrics=[{"key": "n", "agg": "count"}],
        ),
    )
    assert body["rows"][0]["n"] == 3.0


def test_start_and_end_params_narrow_the_window(client: TestClient):
    seed(client)
    body = preview(client, query(), start="2026-01-12", end="2026-01-12")
    assert [row["group"] for row in body["rows"]] == ["2026-01-12"]


def test_window_and_query_filters_both_apply(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(
            group_by="none",
            filters=[{"field": "category", "op": "eq", "value": "legs"}],
            metrics=[{"key": "n", "agg": "count"}],
        ),
        start="2026-01-12",
    )
    assert body["rows"][0]["n"] == 2.0


def test_reversed_window_is_rejected(client: TestClient):
    response = client.post(
        "/api/widgets/preview",
        json=query(),
        params={"start": "2026-02-01", "end": "2026-01-01"},
    )
    assert response.status_code == 422


# --- sorting and limits ----------------------------------------------------


def test_sort_by_metric_descending_with_limit(client: TestClient):
    seed(client)
    body = preview(
        client,
        query(group_by="day", sort={"by": "vol", "direction": "desc"}, limit=2),
    )
    assert [row["group"] for row in body["rows"]] == ["2026-01-05", "2026-01-12"]


def test_null_metrics_sort_last_in_both_directions(client: TestClient):
    """A group with no data is absence, not a minimum — it must never top a chart."""
    seed(client)
    # Bench Press's only surviving set has no RPE; Back Squat's has 9.
    spec = query(
        group_by="exercise",
        metrics=[{"key": "rpe", "agg": "avg", "field": "rpe"}],
        filters=[{"field": "reps", "op": "in", "value": [10, 3]}],
    )

    for direction in ("asc", "desc"):
        body = preview(client, {**spec, "sort": {"by": "rpe", "direction": direction}})
        assert body["rows"][-1]["group"] == "Bench Press", direction


def test_ungrouped_query_ignores_sort_and_limit(client: TestClient):
    """There is one row, so a sort or limit could only confuse the reader."""
    seed(client)
    body = preview(client, query(group_by="none", sort={"by": "vol", "direction": "desc"}, limit=1))
    assert len(body["rows"]) == 1


# --- validation ------------------------------------------------------------


def test_unknown_field_is_rejected(client: TestClient):
    response = client.post(
        "/api/widgets/preview",
        json=query(filters=[{"field": "bodyweight", "op": "eq", "value": 80}]),
    )
    assert response.status_code == 422


def test_cannot_sum_a_name(client: TestClient):
    response = client.post(
        "/api/widgets/preview",
        json=query(metrics=[{"key": "x", "agg": "sum", "field": "category"}]),
    )
    assert response.status_code == 422


def test_cannot_sum_an_identifier(client: TestClient):
    """The total of a column of primary keys is a number with no meaning."""
    response = client.post(
        "/api/widgets/preview",
        json=query(metrics=[{"key": "x", "agg": "sum", "field": "workout_id"}]),
    )
    assert response.status_code == 422


def test_cannot_order_compare_text(client: TestClient):
    response = client.post(
        "/api/widgets/preview",
        json=query(filters=[{"field": "category", "op": "gt", "value": "legs"}]),
    )
    assert response.status_code == 422


def test_cannot_aggregate_a_date(client: TestClient):
    response = client.post(
        "/api/widgets/preview",
        json=query(metrics=[{"key": "x", "agg": "max", "field": "performed_on"}]),
    )
    assert response.status_code == 422


def test_duplicate_metric_keys_are_rejected(client: TestClient):
    response = client.post(
        "/api/widgets/preview",
        json=query(
            metrics=[
                {"key": "vol", "agg": "sum", "field": "volume"},
                {"key": "vol", "agg": "avg", "field": "volume"},
            ]
        ),
    )
    assert response.status_code == 422


def test_sort_by_unknown_metric_is_rejected(client: TestClient):
    response = client.post(
        "/api/widgets/preview", json=query(sort={"by": "nope", "direction": "asc"})
    )
    assert response.status_code == 422


def test_at_least_one_metric_is_required(client: TestClient):
    response = client.post("/api/widgets/preview", json=query(metrics=[]))
    assert response.status_code == 422


def test_too_many_metrics_are_rejected(client: TestClient):
    metrics = [{"key": f"m{index}", "agg": "count"} for index in range(5)]
    response = client.post("/api/widgets/preview", json=query(metrics=metrics))
    assert response.status_code == 422


# --- CRUD ------------------------------------------------------------------


def widget_body(name: str = "Weekly tonnage", **overrides) -> dict:
    return {
        "name": name,
        "description": "Total volume per week",
        "visualization": "line",
        "query": query(group_by="week"),
        **overrides,
    }


def test_create_and_read_round_trips(client: TestClient):
    created = client.post("/api/widgets", json=widget_body())
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Weekly tonnage"
    assert body["visualization"] == "line"
    assert body["query"]["group_by"] == "week"
    assert body["query"]["metrics"][0]["field"] == "volume"

    fetched = client.get(f"/api/widgets/{body['id']}").json()
    assert fetched == body


def test_list_is_ordered_by_name(client: TestClient):
    for name in ("Zebra", "Alpha", "Mango"):
        client.post("/api/widgets", json=widget_body(name))
    names = [widget["name"] for widget in client.get("/api/widgets").json()]
    assert names == ["Alpha", "Mango", "Zebra"]


def test_duplicate_name_conflicts(client: TestClient):
    client.post("/api/widgets", json=widget_body())
    response = client.post("/api/widgets", json=widget_body())
    assert response.status_code == 409


def test_patch_updates_query_and_bumps_updated_at(client: TestClient):
    created = client.post("/api/widgets", json=widget_body()).json()
    response = client.patch(
        f"/api/widgets/{created['id']}",
        json={"name": "Monthly tonnage", "query": query(group_by="month")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Monthly tonnage"
    assert body["query"]["group_by"] == "month"
    assert body["updated_at"] >= created["updated_at"]
    # Untouched fields survive a partial update.
    assert body["visualization"] == "line"


def test_patch_to_a_taken_name_conflicts(client: TestClient):
    client.post("/api/widgets", json=widget_body("Taken"))
    other = client.post("/api/widgets", json=widget_body("Mine")).json()
    response = client.patch(f"/api/widgets/{other['id']}", json={"name": "Taken"})
    assert response.status_code == 409


def test_patch_rejects_an_invalid_query(client: TestClient):
    created = client.post("/api/widgets", json=widget_body()).json()
    response = client.patch(
        f"/api/widgets/{created['id']}",
        json={"query": query(metrics=[{"key": "x", "agg": "sum", "field": "exercise_name"}])},
    )
    assert response.status_code == 422
    assert client.get(f"/api/widgets/{created['id']}").json()["query"]["group_by"] == "week"


def test_delete_removes_the_widget(client: TestClient):
    created = client.post("/api/widgets", json=widget_body()).json()
    assert client.delete(f"/api/widgets/{created['id']}").status_code == 204
    assert client.get(f"/api/widgets/{created['id']}").status_code == 404


def test_delete_is_not_blocked_by_a_dashboard_placement(client: TestClient):
    """Unlike an exercise with sets: the layout tolerates a dangling reference."""
    created = client.post("/api/widgets", json=widget_body()).json()
    client.put(
        "/api/dashboard/config",
        json={
            "version": 1,
            "widgets": [{"id": "a", "type": "custom", "options": {"widget_id": created["id"]}}],
        },
    )
    assert client.delete(f"/api/widgets/{created['id']}").status_code == 204


def test_missing_widget_is_404_everywhere(client: TestClient):
    assert client.get("/api/widgets/999").status_code == 404
    assert client.patch("/api/widgets/999", json={"name": "x"}).status_code == 404
    assert client.delete("/api/widgets/999").status_code == 404
    assert client.get("/api/widgets/999/data").status_code == 404


def test_saved_widget_data_matches_its_preview(client: TestClient):
    seed(client)
    spec = query(group_by="exercise", sort={"by": "vol", "direction": "desc"})
    created = client.post("/api/widgets", json=widget_body("Volume by lift", query=spec)).json()

    data = client.get(f"/api/widgets/{created['id']}/data")
    assert data.status_code == 200
    assert data.json() == preview(client, spec)


def test_saved_widget_data_honours_the_window(client: TestClient):
    seed(client)
    created = client.post("/api/widgets", json=widget_body(query=query())).json()
    body = client.get(f"/api/widgets/{created['id']}/data", params={"start": "2026-02-01"}).json()
    assert [row["group"] for row in body["rows"]] == ["2026-02-02"]


def test_range_days_is_stored_but_not_resolved_by_the_server(client: TestClient):
    """The client owns "today" — the server only ever sees explicit dates."""
    seed(client)
    created = client.post("/api/widgets", json=widget_body(query=query(range_days=30))).json()
    assert created["query"]["range_days"] == 30
    # No start param, so the stored window is *not* applied server-side.
    body = client.get(f"/api/widgets/{created['id']}/data").json()
    assert len(body["rows"]) == 3
