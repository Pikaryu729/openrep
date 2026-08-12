from fastapi import APIRouter, HTTPException
from sqlmodel import select

from openrep.api.deps import SessionDep
from openrep.models.exercise import Exercise
from openrep.models.set import (
    SetEntry,
    SetEntryCreate,
    SetEntryRead,
    SetEntryUpdate,
    SetOrderUpdate,
)
from openrep.models.workout import Workout

router = APIRouter(prefix="/sets", tags=["sets"])


@router.get("", response_model=list[SetEntryRead])
def list_sets(session: SessionDep, workout_id: int | None = None) -> list[SetEntry]:
    query = select(SetEntry)
    if workout_id is not None:
        query = query.where(SetEntry.workout_id == workout_id)
    # id breaks ties: set_order is client-assigned, so direct API writes and
    # imported backups can collide on it, and SQLite's order among equal keys
    # is unspecified — rows would shuffle between refetches.
    return session.exec(query.order_by(SetEntry.set_order, SetEntry.id)).all()


@router.post("", response_model=SetEntryRead, status_code=201)
def create_set(set_entry: SetEntryCreate, session: SessionDep) -> SetEntry:
    if session.get(Workout, set_entry.workout_id) is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    if session.get(Exercise, set_entry.exercise_id) is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    db_set = SetEntry.model_validate(set_entry)
    session.add(db_set)
    session.commit()
    session.refresh(db_set)
    return db_set


# Declared before /{set_id} so "reorder" is never parsed as a set id.
@router.patch("/reorder", response_model=list[SetEntryRead])
def reorder_sets(updates: list[SetOrderUpdate], session: SessionDep) -> list[SetEntry]:
    """Apply several set_order values in a single transaction.

    Swapping two sets with two separate PATCHes leaves them briefly sharing a
    set_order. A refetch landing in that window renders them in the other
    order, so rows move under the user's cursor mid-interaction — an edit can
    land on the row that just took the place of the one they clicked.
    """
    # Resolve everything first: a missing id must not leave earlier rows mutated.
    entries: list[tuple[SetEntry, int]] = []
    for update in updates:
        entry = session.get(SetEntry, update.id)
        if entry is None:
            raise HTTPException(status_code=404, detail=f"Set {update.id} not found")
        entries.append((entry, update.set_order))

    for entry, set_order in entries:
        entry.set_order = set_order
        session.add(entry)
    session.commit()

    for entry, _ in entries:
        session.refresh(entry)
    return [entry for entry, _ in entries]


@router.get("/{set_id}", response_model=SetEntryRead)
def get_set(set_id: int, session: SessionDep) -> SetEntry:
    set_entry = session.get(SetEntry, set_id)
    if set_entry is None:
        raise HTTPException(status_code=404, detail="Set not found")
    return set_entry


@router.patch("/{set_id}", response_model=SetEntryRead)
def update_set(set_id: int, update: SetEntryUpdate, session: SessionDep) -> SetEntry:
    set_entry = session.get(SetEntry, set_id)
    if set_entry is None:
        raise HTTPException(status_code=404, detail="Set not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(set_entry, key, value)
    session.add(set_entry)
    session.commit()
    session.refresh(set_entry)
    return set_entry


@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: int, session: SessionDep) -> None:
    set_entry = session.get(SetEntry, set_id)
    if set_entry is None:
        raise HTTPException(status_code=404, detail="Set not found")
    session.delete(set_entry)
    session.commit()
