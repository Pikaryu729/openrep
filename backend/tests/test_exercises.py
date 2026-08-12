from fastapi.testclient import TestClient


def test_create_and_list_exercise(client: TestClient):
    response = client.post("/exercises", json={"name": "Deadlift", "category": "back"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Deadlift"
    assert body["id"] is not None

    response = client.get("/exercises")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_missing_exercise_404(client: TestClient):
    response = client.get("/exercises/999")
    assert response.status_code == 404


def test_update_exercise(client: TestClient):
    created = client.post("/exercises", json={"name": "Bench Press", "category": "push"}).json()
    response = client.patch(f"/exercises/{created['id']}", json={"category": "chest"})
    assert response.status_code == 200
    assert response.json()["category"] == "chest"
    assert response.json()["name"] == "Bench Press"


def test_delete_exercise(client: TestClient):
    created = client.post("/exercises", json={"name": "Overhead Press", "category": "push"}).json()
    response = client.delete(f"/exercises/{created['id']}")
    assert response.status_code == 204
    assert client.get(f"/exercises/{created['id']}").status_code == 404


def test_create_duplicate_name_409(client: TestClient):
    assert client.post("/exercises", json={"name": "Deadlift"}).status_code == 201
    response = client.post("/exercises", json={"name": "Deadlift"})
    assert response.status_code == 409

    # the failed insert must not have left anything behind
    assert len(client.get("/exercises").json()) == 1


def test_rename_onto_existing_name_409(client: TestClient):
    client.post("/exercises", json={"name": "Deadlift"})
    other = client.post("/exercises", json={"name": "Bench Press"}).json()
    response = client.patch(f"/exercises/{other['id']}", json={"name": "Deadlift"})
    assert response.status_code == 409


def test_delete_exercise_in_use_409(client: TestClient):
    exercise_id = client.post("/exercises", json={"name": "Back Squat"}).json()["id"]
    workout_id = client.post("/workouts", json={"performed_on": "2026-08-01"}).json()["id"]
    client.post(
        "/sets",
        json={"workout_id": workout_id, "exercise_id": exercise_id, "weight_kg": 100, "reps": 5},
    )

    response = client.delete(f"/exercises/{exercise_id}")
    assert response.status_code == 409
    assert client.get(f"/exercises/{exercise_id}").status_code == 200
