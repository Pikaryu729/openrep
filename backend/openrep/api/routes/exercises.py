from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from openrep.api.deps import SessionDep
from openrep.models.exercise import Exercise, ExerciseCreate, ExerciseRead, ExerciseUpdate
from openrep.models.set import SetEntry

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseRead])
def list_exercises(session: SessionDep) -> list[Exercise]:
    return session.exec(select(Exercise).order_by(Exercise.name)).all()


@router.post("", response_model=ExerciseRead, status_code=201)
def create_exercise(exercise: ExerciseCreate, session: SessionDep) -> Exercise:
    db_exercise = Exercise.model_validate(exercise)
    session.add(db_exercise)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="An exercise with this name already exists")
    session.refresh(db_exercise)
    return db_exercise


@router.get("/{exercise_id}", response_model=ExerciseRead)
def get_exercise(exercise_id: int, session: SessionDep) -> Exercise:
    exercise = session.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.patch("/{exercise_id}", response_model=ExerciseRead)
def update_exercise(exercise_id: int, update: ExerciseUpdate, session: SessionDep) -> Exercise:
    exercise = session.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(exercise, key, value)
    session.add(exercise)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="An exercise with this name already exists")
    session.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, session: SessionDep) -> None:
    exercise = session.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    in_use = session.exec(
        select(SetEntry.id).where(SetEntry.exercise_id == exercise_id).limit(1)
    ).first()
    if in_use is not None:
        raise HTTPException(status_code=409, detail="Exercise is used by existing sets")
    session.delete(exercise)
    session.commit()
