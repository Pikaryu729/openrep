from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select

from openrep.api.deps import SessionDep
from openrep.models.exercise import Exercise
from openrep.models.set import SetEntry
from openrep.models.workout import Workout, WorkoutCreate, WorkoutRead, WorkoutUpdate

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("", response_model=list[WorkoutRead])
def list_workouts(
    session: SessionDep,
    limit: int | None = Query(default=None, ge=1, le=100),
    start: date | None = None,
    end: date | None = None,
    exercise_id: int | None = None,
    category: str | None = None,
) -> list[Workout]:
    """Newest first. All filters are optional; no filters means all history."""
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="start must be on or before end")

    query = select(Workout)
    if start is not None:
        query = query.where(Workout.performed_on >= start)
    if end is not None:
        query = query.where(Workout.performed_on <= end)

    # Joining sets multiplies rows by set count, so these filters need DISTINCT:
    # three sets of one lift must not yield the workout three times. An unknown
    # exercise_id returns [] rather than 404, matching how list_sets treats
    # workout_id.
    if exercise_id is not None:
        query = query.where(SetEntry.workout_id == Workout.id).where(
            SetEntry.exercise_id == exercise_id
        )
    if category is not None:
        query = (
            query.where(SetEntry.workout_id == Workout.id)
            .where(SetEntry.exercise_id == Exercise.id)
            .where(Exercise.category == category)
        )
    if exercise_id is not None or category is not None:
        query = query.distinct()

    # id breaks ties: once a limit truncates the list, same-day workouts would
    # otherwise shuffle between refetches (SQLite's order among equal keys is
    # unspecified) — the same bug already fixed for set_order in sets.py.
    query = query.order_by(Workout.performed_on.desc(), Workout.id.desc())
    if limit is not None:
        query = query.limit(limit)

    return session.exec(query).all()


@router.post("", response_model=WorkoutRead, status_code=201)
def create_workout(workout: WorkoutCreate, session: SessionDep) -> Workout:
    db_workout = Workout.model_validate(workout)
    session.add(db_workout)
    session.commit()
    session.refresh(db_workout)
    return db_workout


@router.get("/{workout_id}", response_model=WorkoutRead)
def get_workout(workout_id: int, session: SessionDep) -> Workout:
    workout = session.get(Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.patch("/{workout_id}", response_model=WorkoutRead)
def update_workout(workout_id: int, update: WorkoutUpdate, session: SessionDep) -> Workout:
    workout = session.get(Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(workout, key, value)
    session.add(workout)
    session.commit()
    session.refresh(workout)
    return workout


@router.delete("/{workout_id}", status_code=204)
def delete_workout(workout_id: int, session: SessionDep) -> None:
    workout = session.get(Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    session.delete(workout)
    session.commit()
