from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.api.deps import SessionDep
from app.models.exercise import Exercise
from app.models.set import SetEntry, SetEntryCreate, SetEntryRead, SetEntryUpdate
from app.models.workout import Workout

router = APIRouter(prefix="/sets", tags=["sets"])


@router.get("", response_model=list[SetEntryRead])
def list_sets(session: SessionDep, workout_id: int | None = None) -> list[SetEntry]:
    query = select(SetEntry)
    if workout_id is not None:
        query = query.where(SetEntry.workout_id == workout_id)
    return session.exec(query.order_by(SetEntry.set_order)).all()


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
