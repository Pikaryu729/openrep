from fastapi.testclient import TestClient


def _make_exercise(client: TestClient, name: str = "Back Squat") -> int:
    return client.post("/api/exercises", json={"name": name, "category": "legs"}).json()["id"]


def _make_workout(client: TestClient, performed_on: str = "2026-08-01") -> int:
    return client.post("/api/workouts", json={"performed_on": performed_on}).json()["id"]


def test_create_workout_with_sets(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)

    response = client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )
    assert response.status_code == 201

    response = client.get("/api/sets", params={"workout_id": workout_id})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_set_by_id(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)
    created = client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    ).json()

    response = client.get(f"/api/sets/{created['id']}")
    assert response.status_code == 200
    assert response.json()["weight_kg"] == 100

    assert client.get("/api/sets/999").status_code == 404


def test_sets_with_equal_order_fall_back_to_insertion_order(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)
    # set_order is client-assigned and defaults to 0, so direct API writes and
    # imported backups collide on it routinely. Without an id tiebreaker the
    # order among equal keys is unspecified and rows shuffle between refetches.
    ids = [
        client.post(
            "/api/sets",
            json={
                "workout_id": workout_id,
                "exercise_id": exercise_id,
                "weight_kg": weight,
                "reps": 5,
            },
        ).json()["id"]
        for weight in (100, 105, 110)
    ]

    listed = client.get("/api/sets", params={"workout_id": workout_id}).json()
    assert [entry["id"] for entry in listed] == ids


def test_create_set_with_missing_refs_404(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)

    response = client.post(
        "/api/sets",
        json={"workout_id": 999, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )
    assert response.status_code == 404

    response = client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": 999, "weight_kg": 100, "reps": 5},
    )
    assert response.status_code == 404


def test_delete_workout_cascades_sets(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)
    client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )

    assert client.delete(f"/api/workouts/{workout_id}").status_code == 204
    response = client.get("/api/sets", params={"workout_id": workout_id})
    assert response.json() == []


def test_analytics_personal_records(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)
    client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )
    client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 110, "reps": 1},
    )

    response = client.get(f"/api/analytics/exercises/{exercise_id}/personal-records")
    assert response.status_code == 200
    body = response.json()
    assert body["max_weight_kg"] == 110
    assert body["max_volume_in_a_workout_kg"] == 100 * 5 + 110 * 1


def test_analytics_volume_by_day(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client, performed_on="2026-08-05")
    client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 50, "reps": 10},
    )

    response = client.get("/api/analytics/volume")
    assert response.status_code == 200
    body = response.json()
    assert body == [{"performed_on": "2026-08-05", "total_volume_kg": 500.0, "total_sets": 1}]
