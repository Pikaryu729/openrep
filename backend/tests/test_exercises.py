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
