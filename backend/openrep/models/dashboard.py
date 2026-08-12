from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

DASHBOARD_CONFIG_VERSION = 1

# `options` is an opaque dict the server never interprets, so without caps a
# client could park arbitrary amounts of data in this row.
MAX_WIDGETS = 24
MAX_CONFIG_BYTES = 64_000

# One user, one dashboard. A keyed table would force a "which one" story into
# every route for no benefit.
SINGLETON_ID = 1

# Reproduces the pre-widget dashboard exactly, so an existing user sees no
# change until they edit. Returned by GET when the row has never been written.
DEFAULT_WIDGETS: list[dict[str, Any]] = [
    {"id": "stats", "type": "stat_tiles", "options": {}},
    {"id": "volume", "type": "volume_chart", "options": {"range_days": None}},
    {"id": "records", "type": "personal_records", "options": {"limit": 5}},
]


class DashboardWidget(SQLModel):
    """One widget. `options` is deliberately untyped here.

    The server has no widget catalog — it stores and returns whatever the
    client sends. That is what lets a layout written by a newer OpenRep survive
    a round trip through an older one instead of being silently truncated.
    """

    id: str = Field(min_length=1, max_length=64)
    type: str = Field(min_length=1, max_length=64)
    options: dict[str, Any] = Field(default_factory=dict)


class DashboardConfigBase(SQLModel):
    version: int = DASHBOARD_CONFIG_VERSION
    widgets: list[DashboardWidget] = Field(default_factory=list)


class DashboardConfig(SQLModel, table=True):
    """Two deliberate deviations from the usual model shape in this package:

    - There is no `*Create`. The singleton has no POST; it is created
      implicitly by the first PUT.
    - This class does NOT inherit `DashboardConfigBase`. A `sa_column=Column(...)`
      declared on a shared base attaches one Column instance to several mapped
      classes, which fails at mapper-configuration time. The JSON column is
      therefore declared only here.
    """

    __tablename__ = "dashboard_config"

    id: int | None = Field(default=None, primary_key=True)
    version: int = Field(default=DASHBOARD_CONFIG_VERSION)
    widgets: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DashboardConfigUpdate(DashboardConfigBase):
    """PUT body. Always the complete widget list — there are no merge semantics."""


class DashboardConfigRead(DashboardConfigBase):
    # None means the row has never been written, i.e. the client is looking at
    # DEFAULT_WIDGETS rather than a layout the user chose.
    updated_at: datetime | None = None
