from fastapi.testclient import TestClient


def _seed(client: TestClient) -> None:
    exercise_id = client.post(
        "/api/exercises", json={"name": "Back Squat", "category": "legs"}
    ).json()["id"]
    workout_id = client.post("/api/workouts", json={"performed_on": "2026-08-01"}).json()["id"]
    client.post(
        "/api/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )


def _stripped(document: dict) -> dict:
    """Backup content without ids/timestamps, for equivalence checks."""
    return {
        "exercises": [{k: v for k, v in e.items() if k != "id"} for e in document["exercises"]],
        "workouts": [{k: v for k, v in w.items() if k != "id"} for w in document["workouts"]],
        "sets": [
            {k: v for k, v in s.items() if k not in ("id", "workout_id", "exercise_id")}
            for s in document["sets"]
        ],
    }


def test_export_shape(client: TestClient):
    _seed(client)
    response = client.get("/api/backup/export")
    assert response.status_code == 200
    body = response.json()
    assert body["app"] == "openrep"
    assert body["version"] == 1
    assert len(body["exercises"]) == 1
    assert len(body["workouts"]) == 1
    assert len(body["sets"]) == 1


def test_replace_import_round_trip(client: TestClient):
    _seed(client)
    exported = client.get("/api/backup/export").json()

    response = client.post("/api/backup/import", json={"mode": "replace", "data": exported})
    assert response.status_code == 200
    summary = response.json()
    assert summary["mode"] == "replace"
    assert summary["exercises_created"] == 1
    assert summary["workouts_created"] == 1
    assert summary["sets_created"] == 1

    re_exported = client.get("/api/backup/export").json()
    assert _stripped(re_exported) == _stripped(exported)


def test_merge_matches_exercises_by_name(client: TestClient):
    _seed(client)
    exported = client.get("/api/backup/export").json()

    response = client.post("/api/backup/import", json={"mode": "merge", "data": exported})
    assert response.status_code == 200
    summary = response.json()
    assert summary["exercises_created"] == 0
    assert summary["exercises_matched"] == 1
    assert summary["workouts_created"] == 1

    # no duplicate exercise row; workouts duplicated by design
    assert len(client.get("/api/exercises").json()) == 1
    assert len(client.get("/api/workouts").json()) == 2
    # imported set attached to the existing exercise
    existing_exercise_id = client.get("/api/exercises").json()[0]["id"]
    exported_after = client.get("/api/backup/export").json()
    assert all(s["exercise_id"] == existing_exercise_id for s in exported_after["sets"])


def test_replace_wipes_existing_data(client: TestClient):
    _seed(client)
    empty = {
        "app": "openrep",
        "version": 1,
        "exported_at": "2026-08-10T00:00:00Z",
        "exercises": [],
        "workouts": [],
        "sets": [],
    }
    response = client.post("/api/backup/import", json={"mode": "replace", "data": empty})
    assert response.status_code == 200
    assert client.get("/api/exercises").json() == []
    assert client.get("/api/workouts").json() == []
    assert client.get("/api/sets").json() == []


def test_unsupported_version_422(client: TestClient):
    document = client.get("/api/backup/export").json()
    document["version"] = 2
    response = client.post("/api/backup/import", json={"mode": "merge", "data": document})
    assert response.status_code == 422


def test_duplicate_exercise_name_422_and_db_unchanged(client: TestClient):
    _seed(client)
    document = client.get("/api/backup/export").json()
    duplicate = dict(document["exercises"][0])
    duplicate["id"] = 999
    document["exercises"].append(duplicate)

    # Without the up-front check this only failed at commit, as a 500 from the
    # unique index — after replace mode had already issued the wipe.
    response = client.post("/api/backup/import", json={"mode": "replace", "data": document})
    assert response.status_code == 422
    assert len(client.get("/api/exercises").json()) == 1
    assert len(client.get("/api/workouts").json()) == 1
    assert len(client.get("/api/sets").json()) == 1


def test_dangling_reference_422_and_db_unchanged(client: TestClient):
    _seed(client)
    document = client.get("/api/backup/export").json()
    document["sets"][0]["workout_id"] = 999

    response = client.post("/api/backup/import", json={"mode": "replace", "data": document})
    assert response.status_code == 422
    # nothing was wiped or inserted
    assert len(client.get("/api/exercises").json()) == 1
    assert len(client.get("/api/workouts").json()) == 1
    assert len(client.get("/api/sets").json()) == 1
