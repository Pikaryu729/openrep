from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from openrep.spa import mount_spa, resolve_static_file

INDEX_HTML = "<!doctype html><div id='root'></div>"


@pytest.fixture(name="static_dir")
def static_dir_fixture(tmp_path: Path) -> Path:
    """A stand-in for a built frontend, so these tests never need `pnpm build`."""
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(INDEX_HTML)
    (tmp_path / "assets" / "main-abc123.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    return tmp_path


@pytest.fixture(name="spa_client")
def spa_client_fixture(static_dir: Path) -> TestClient:
    app = FastAPI()

    @app.get("/api/exercises")
    def exercises() -> list[str]:
        return []

    assert mount_spa(app, static_dir) is True
    return TestClient(app)


def test_unknown_path_serves_the_shell(spa_client: TestClient):
    response = spa_client.get("/workouts/42")
    assert response.status_code == 200
    assert "<div id='root'>" in response.text


def test_root_serves_the_shell(spa_client: TestClient):
    # An empty spa_path must not resolve to the directory itself.
    response = spa_client.get("/")
    assert response.status_code == 200
    assert "<div id='root'>" in response.text
    assert response.headers["cache-control"] == "no-cache"


def test_real_file_is_served(spa_client: TestClient):
    response = spa_client.get("/favicon.svg")
    assert response.status_code == 200
    assert response.text == "<svg/>"


def test_hashed_assets_are_cached_immutably(spa_client: TestClient):
    response = spa_client.get("/assets/main-abc123.js")
    assert response.status_code == 200
    assert "immutable" in response.headers["cache-control"]


def test_registered_api_routes_still_win(spa_client: TestClient):
    response = spa_client.get("/api/exercises")
    assert response.status_code == 200
    assert response.json() == []


def test_unknown_api_path_404s_instead_of_serving_the_shell(spa_client: TestClient):
    # Otherwise a typo'd endpoint silently returns 200 + HTML.
    response = spa_client.get("/api/nope")
    assert response.status_code == 404
    assert "<div id='root'>" not in response.text


def test_stale_asset_404s_instead_of_serving_the_shell(spa_client: TestClient):
    # A tab left open across an upgrade requests the previous build's bundle.
    # Answering with 200 + HTML surfaces as "Unexpected token '<'".
    response = spa_client.get("/assets/main-OLDHASH.js")
    assert response.status_code == 404
    assert "<div id='root'>" not in response.text


def test_missing_build_registers_nothing(tmp_path: Path):
    app = FastAPI()
    assert mount_spa(app, tmp_path / "does-not-exist") is False

    response = TestClient(app).get("/")
    assert response.status_code == 404


@pytest.mark.parametrize(
    "escape",
    [
        "../../../etc/passwd",
        "/etc/passwd",  # pathlib: root / "/abs" replaces the left operand entirely
        "assets/../../pyproject.toml",
        "assets/../../../../../../etc/hosts",
    ],
)
def test_resolver_refuses_escapes(static_dir: Path, escape: str):
    # Tested at the function, not over HTTP: httpx normalises ".." out of the
    # path before the app ever sees it, so an HTTP-level test proves nothing.
    assert resolve_static_file(static_dir, escape) is None


def test_encoded_traversal_falls_back_to_the_shell(spa_client: TestClient):
    # Percent-encoded dots survive httpx and are decoded only after routing.
    response = spa_client.get("/%2e%2e/%2e%2e/etc/passwd")
    assert response.status_code == 200
    assert "<div id='root'>" in response.text


def test_resolver_finds_real_files(static_dir: Path):
    assert resolve_static_file(static_dir, "favicon.svg") == (static_dir / "favicon.svg").resolve()
    assert resolve_static_file(static_dir, "nope.svg") is None
    assert resolve_static_file(static_dir, "assets") is None  # a directory is not a file
