import json
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from openrep.api.deps import SessionDep
from openrep.models.dashboard import (
    DASHBOARD_CONFIG_VERSION,
    DEFAULT_WIDGETS,
    MAX_CONFIG_BYTES,
    MAX_WIDGETS,
    SINGLETON_ID,
    DashboardConfig,
    DashboardConfigRead,
    DashboardConfigUpdate,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/config", response_model=DashboardConfigRead)
def get_dashboard_config(session: SessionDep) -> DashboardConfigRead:
    """The stored layout, or the default one when it has never been written.

    Deliberately does not create the row: a GET with a side effect races itself
    on first load, and materializing defaults would destroy the "never
    customized" signal that `updated_at is None` carries.
    """
    config = session.get(DashboardConfig, SINGLETON_ID)
    if config is None:
        return DashboardConfigRead(
            version=DASHBOARD_CONFIG_VERSION, widgets=DEFAULT_WIDGETS, updated_at=None
        )
    return DashboardConfigRead(
        version=config.version, widgets=config.widgets, updated_at=config.updated_at
    )


@router.put("/config", response_model=DashboardConfigRead)
def save_dashboard_config(
    update: DashboardConfigUpdate, session: SessionDep
) -> DashboardConfigRead:
    """Replace the layout wholesale. The client always sends the full list."""
    # Validate everything before touching the row, the way backup.py does — a
    # failure halfway through a write is far worse than a rejected request.
    if update.version != DASHBOARD_CONFIG_VERSION:
        raise HTTPException(
            status_code=422, detail=f"Unsupported dashboard config version {update.version}"
        )

    if len(update.widgets) > MAX_WIDGETS:
        raise HTTPException(
            status_code=422, detail=f"A dashboard holds at most {MAX_WIDGETS} widgets"
        )

    seen: set[str] = set()
    for widget in update.widgets:
        if widget.id in seen:
            # 422, not 409: this is one malformed document, not a conflict with
            # a row that already exists — the same call backup.py makes for
            # duplicate exercise names inside a payload.
            raise HTTPException(status_code=422, detail=f"Duplicate widget id {widget.id!r}")
        seen.add(widget.id)

    widgets = [widget.model_dump() for widget in update.widgets]
    if len(json.dumps(widgets)) > MAX_CONFIG_BYTES:
        raise HTTPException(status_code=422, detail="Dashboard config is too large")

    config = session.get(DashboardConfig, SINGLETON_ID)
    if config is None:
        config = DashboardConfig(id=SINGLETON_ID)
        session.add(config)

    config.version = update.version
    config.widgets = widgets
    config.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(config)

    return DashboardConfigRead(
        version=config.version, widgets=config.widgets, updated_at=config.updated_at
    )
