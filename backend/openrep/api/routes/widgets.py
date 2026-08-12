from datetime import UTC, date, datetime

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from openrep.api.deps import SessionDep
from openrep.core.widget_query import run_widget_query
from openrep.models.custom_widget import (
    CustomWidget,
    CustomWidgetCreate,
    CustomWidgetRead,
    CustomWidgetUpdate,
)
from openrep.schemas.widget_query import (
    QueryCatalog,
    QueryResult,
    WidgetQuery,
    build_catalog,
)

router = APIRouter(prefix="/widgets", tags=["widgets"])

DUPLICATE_NAME = "A widget with this name already exists"


def _to_read(widget: CustomWidget) -> CustomWidgetRead:
    """Row → response, re-validating the stored query.

    A row whose JSON no longer parses can only come from a hand-edited database
    or a downgrade, and answering with a half-formed widget would push the
    error into the client's chart code. 422 names the problem where it is.
    """
    try:
        query = WidgetQuery.model_validate(widget.query)
    except ValidationError as error:
        raise HTTPException(
            status_code=422,
            detail=f"Widget {widget.name!r} has a query this version cannot read: {error.errors()[0]['msg']}",
        ) from error
    return CustomWidgetRead(
        id=widget.id,
        name=widget.name,
        description=widget.description,
        visualization=widget.visualization,
        query=query,
        created_at=widget.created_at,
        updated_at=widget.updated_at,
    )


def _require_ordered_range(start: date | None, end: date | None) -> None:
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="start must be on or before end")


# The two static paths are registered before "/{widget_id}" on purpose: routes
# resolve in declaration order, and while an int path param would reject
# "fields" with a 422 rather than mis-route it, a 422 is not the answer anyone
# wants from GET /api/widgets/fields.
@router.get("/fields", response_model=QueryCatalog)
def get_query_catalog() -> QueryCatalog:
    """Everything the editor needs to build a query: fields, operators,
    aggregates, groupings. Published so the client never hardcodes a second
    copy of the whitelist in schemas/widget_query.py."""
    return build_catalog()


@router.post("/preview", response_model=QueryResult)
def preview_query(
    query: WidgetQuery, session: SessionDep, start: date | None = None, end: date | None = None
) -> QueryResult:
    """Run an unsaved query. This is what makes the editor a live preview
    rather than a form you submit and hope about."""
    _require_ordered_range(start, end)
    return run_widget_query(session, query, start, end)


@router.get("", response_model=list[CustomWidgetRead])
def list_widgets(session: SessionDep) -> list[CustomWidgetRead]:
    widgets = session.exec(select(CustomWidget).order_by(CustomWidget.name)).all()
    return [_to_read(widget) for widget in widgets]


@router.post("", response_model=CustomWidgetRead, status_code=201)
def create_widget(data: CustomWidgetCreate, session: SessionDep) -> CustomWidgetRead:
    widget = CustomWidget(
        name=data.name,
        description=data.description,
        visualization=data.visualization,
        query=data.query.model_dump(mode="json"),
    )
    session.add(widget)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME)
    session.refresh(widget)
    return _to_read(widget)


@router.get("/{widget_id}", response_model=CustomWidgetRead)
def get_widget(widget_id: int, session: SessionDep) -> CustomWidgetRead:
    widget = session.get(CustomWidget, widget_id)
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    return _to_read(widget)


@router.patch("/{widget_id}", response_model=CustomWidgetRead)
def update_widget(
    widget_id: int, update: CustomWidgetUpdate, session: SessionDep
) -> CustomWidgetRead:
    widget = session.get(CustomWidget, widget_id)
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")

    fields = update.model_dump(exclude_unset=True)
    if "query" in fields and update.query is not None:
        fields["query"] = update.query.model_dump(mode="json")
    for key, value in fields.items():
        setattr(widget, key, value)
    widget.updated_at = datetime.now(UTC)

    session.add(widget)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME)
    session.refresh(widget)
    return _to_read(widget)


@router.delete("/{widget_id}", status_code=204)
def delete_widget(widget_id: int, session: SessionDep) -> None:
    """Deliberately not blocked by dashboard placements, unlike deleting an
    exercise that has sets.

    There is no foreign key to check — the dashboard layout stores widget names
    in opaque JSON — and the layout is already built to tolerate a reference it
    cannot resolve (a deleted exercise behaves the same way). Refusing here
    would mean hunting down placements before you can tidy up.
    """
    widget = session.get(CustomWidget, widget_id)
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    session.delete(widget)
    session.commit()


@router.get("/{widget_id}/data", response_model=QueryResult)
def get_widget_data(
    widget_id: int, session: SessionDep, start: date | None = None, end: date | None = None
) -> QueryResult:
    _require_ordered_range(start, end)
    widget = session.get(CustomWidget, widget_id)
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    return run_widget_query(session, _to_read(widget).query, start, end)
