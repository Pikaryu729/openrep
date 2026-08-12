from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from openrep.schemas.widget_query import Visualization, WidgetQuery

NAME_MAX = 80
DESCRIPTION_MAX = 400


class CustomWidgetBase(SQLModel):
    name: str = Field(min_length=1, max_length=NAME_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    visualization: Visualization = "bar"


class CustomWidget(SQLModel, table=True):
    """A widget the user built in the editor.

    Like DashboardConfig, this class does NOT inherit its `*Base`: a
    `sa_column=Column(...)` declared on a shared base attaches one Column
    instance to several mapped classes, which fails at mapper-configuration
    time. The JSON column is therefore declared only here.

    `query` is stored as JSON rather than shredded into columns because it is a
    small tree (filters, metrics) whose shape is owned by
    `schemas/widget_query.py`. Unlike the dashboard layout's opaque `options`,
    it IS validated on the way in and out — the server executes it, so an
    unparseable query is a real error rather than something to preserve.
    """

    __tablename__ = "custom_widget"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True, max_length=NAME_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    visualization: str = Field(default="bar", max_length=16)
    query: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CustomWidgetCreate(CustomWidgetBase):
    query: WidgetQuery


class CustomWidgetUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    visualization: Visualization | None = None
    query: WidgetQuery | None = None


class CustomWidgetRead(CustomWidgetBase):
    id: int
    query: WidgetQuery
    created_at: datetime
    updated_at: datetime
