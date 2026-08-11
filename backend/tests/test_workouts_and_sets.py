from fastapi.testclient import TestClient


def _make_exercise(client: TestClient, name: str = "Back Squat") -> int:
    return client.post("/exercises", json={"name": name, "category": "legs"}).json()["id"]


def _make_workout(client: TestClient, performed_on: str = "2026-08-01") -> int:
    return client.post("/workouts", json={"performed_on": performed_on}).json()["id"]


def test_create_workout_with_sets(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)

    response = client.post(
        "/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )
    assert response.status_code == 201

    response = client.get("/sets", params={"workout_id": workout_id})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_analytics_personal_records(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client)
    client.post(
        "/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )
    client.post(
        "/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 110, "reps": 1},
    )

    response = client.get(f"/analytics/exercises/{exercise_id}/personal-records")
    assert response.status_code == 200
    body = response.json()
    assert body["max_weight_kg"] == 110
    assert body["max_volume_in_a_workout_kg"] == 100 * 5 + 110 * 1


def test_analytics_volume_by_day(client: TestClient):
    exercise_id = _make_exercise(client)
    workout_id = _make_workout(client, performed_on="2026-08-05")
    client.post(
        "/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 50, "reps": 10},
    )

    response = client.get("/analytics/volume")
    assert response.status_code == 200
    body = response.json()
    assert body == [{"performed_on": "2026-08-05", "total_volume_kg": 500.0, "total_sets": 1}]
