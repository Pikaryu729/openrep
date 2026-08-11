from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.api.deps import SessionDep
from app.models.exercise import Exercise, ExerciseCreate, ExerciseRead, ExerciseUpdate

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseRead])
def list_exercises(session: SessionDep) -> list[Exercise]:
    return session.exec(select(Exercise).order_by(Exercise.name)).all()


@router.post("", response_model=ExerciseRead, status_code=201)
def create_exercise(exercise: ExerciseCreate, session: SessionDep) -> Exercise:
    db_exercise = Exercise.model_validate(exercise)
    session.add(db_exercise)
    session.commit()
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
    session.commit()
    session.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, session: SessionDep) -> None:
    exercise = session.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    session.delete(exercise)
    session.commit()
