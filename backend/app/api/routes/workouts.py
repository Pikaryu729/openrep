from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.api.deps import SessionDep
from app.models.workout import Workout, WorkoutCreate, WorkoutRead, WorkoutUpdate

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("", response_model=list[WorkoutRead])
def list_workouts(session: SessionDep) -> list[Workout]:
    return session.exec(select(Workout).order_by(Workout.performed_on.desc())).all()


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
