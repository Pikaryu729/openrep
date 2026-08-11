"""Serve the built single-page frontend from the same process as the API."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

# Vite fingerprints everything under assets/, so those are safe to cache forever.
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"


def resolve_static_file(static_dir: Path, relative_path: str) -> Path | None:
    """Return the real file `relative_path` names inside `static_dir`, else None.

    None covers "no such file" and every escape attempt: `../` traversal,
    absolute paths (pathlib's `/` lets an absolute right-hand operand replace
    the left entirely), and symlinks pointing out of the tree.
    """
    root = static_dir.resolve()
    candidate = (root / relative_path.lstrip("/")).resolve()
    if not candidate.is_relative_to(root):
        return None
    return candidate if candidate.is_file() else None


def mount_spa(app: FastAPI, static_dir: Path, api_prefix: str = "/api") -> bool:
    """Register the SPA catch-all route.

    Returns False and registers nothing when the frontend build is absent, so
    source checkouts and editable installs still boot as an API-only server.
    Must be called after the API router is included: the catch-all matches
    anything, and FastAPI resolves routes in registration order.
    """
    index_file = static_dir / "index.html"
    if not index_file.is_file():
        return False

    api_root = api_prefix.strip("/")

    @app.get("/{spa_path:path}", include_in_schema=False)
    def serve_spa(spa_path: str) -> FileResponse:
        # Without this, a typo'd endpoint would get 200 + the SPA shell, which
        # is a miserable way to discover you misspelled a route.
        if spa_path == api_root or spa_path.startswith(f"{api_root}/"):
            raise HTTPException(status_code=404, detail="Not Found")

        asset = resolve_static_file(static_dir, spa_path)
        if asset is None:
            # Unknown path: hand back the shell and let the client router decide.
            return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

        headers = {"Cache-Control": IMMUTABLE_CACHE} if spa_path.startswith("assets/") else {}
        return FileResponse(asset, headers=headers)

    return True
