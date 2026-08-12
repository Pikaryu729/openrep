from fastapi.testclient import TestClient

from openrep.models.dashboard import MAX_WIDGETS


def _widget(widget_id: str, widget_type: str = "volume_chart", **options) -> dict:
    return {"id": widget_id, "type": widget_type, "options": options}


def test_get_returns_defaults_when_never_written(client: TestClient):
    response = client.get("/api/dashboard/config")
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == 1
    # updated_at is the "never customized" signal — GET must not materialize a row.
    assert body["updated_at"] is None
    assert [w["type"] for w in body["widgets"]] == [
        "stat_tiles",
        "volume_chart",
        "personal_records",
    ]


def test_put_then_get_round_trips(client: TestClient):
    widgets = [_widget("a", "stat_tiles"), _widget("b", "volume_chart", range_days=90)]

    response = client.put("/api/dashboard/config", json={"version": 1, "widgets": widgets})
    assert response.status_code == 200
    assert response.json()["updated_at"] is not None

    body = client.get("/api/dashboard/config").json()
    assert [w["id"] for w in body["widgets"]] == ["a", "b"]
    assert body["widgets"][1]["options"] == {"range_days": 90}


def test_put_replaces_wholesale(client: TestClient):
    client.put(
        "/api/dashboard/config",
        json={"version": 1, "widgets": [_widget("a"), _widget("b"), _widget("c")]},
    )
    client.put("/api/dashboard/config", json={"version": 1, "widgets": [_widget("only")]})

    body = client.get("/api/dashboard/config").json()
    assert [w["id"] for w in body["widgets"]] == ["only"]


def test_put_preserves_unknown_widget_type(client: TestClient):
    """The server has no catalog: a layout from a newer client must survive."""
    widgets = [{"id": "future", "type": "hologram", "options": {"nested": {"deep": [1, 2]}}}]
    client.put("/api/dashboard/config", json={"version": 1, "widgets": widgets})

    body = client.get("/api/dashboard/config").json()
    assert body["widgets"] == widgets


def test_empty_widget_list_is_allowed(client: TestClient):
    response = client.put("/api/dashboard/config", json={"version": 1, "widgets": []})
    assert response.status_code == 200
    assert client.get("/api/dashboard/config").json()["widgets"] == []


def test_put_rejects_duplicate_widget_ids(client: TestClient):
    response = client.put(
        "/api/dashboard/config",
        json={"version": 1, "widgets": [_widget("dup"), _widget("dup")]},
    )
    assert response.status_code == 422
    assert "dup" in response.json()["detail"]


def test_put_rejects_unsupported_version(client: TestClient):
    response = client.put("/api/dashboard/config", json={"version": 2, "widgets": []})
    assert response.status_code == 422


def test_put_rejects_too_many_widgets(client: TestClient):
    widgets = [_widget(f"w{n}") for n in range(MAX_WIDGETS + 1)]
    response = client.put("/api/dashboard/config", json={"version": 1, "widgets": widgets})
    assert response.status_code == 422


def test_put_rejects_oversized_options(client: TestClient):
    fat = [{"id": "a", "type": "volume_chart", "options": {"blob": "x" * 100_000}}]
    response = client.put("/api/dashboard/config", json={"version": 1, "widgets": fat})
    assert response.status_code == 422


def test_put_rejects_widget_without_type(client: TestClient):
    response = client.put(
        "/api/dashboard/config", json={"version": 1, "widgets": [{"id": "a", "options": {}}]}
    )
    assert response.status_code == 422


def test_rejected_put_leaves_the_stored_config_untouched(client: TestClient):
    client.put("/api/dashboard/config", json={"version": 1, "widgets": [_widget("keep")]})
    client.put(
        "/api/dashboard/config",
        json={"version": 1, "widgets": [_widget("dup"), _widget("dup")]},
    )

    body = client.get("/api/dashboard/config").json()
    assert [w["id"] for w in body["widgets"]] == ["keep"]
