from collections import defaultdict

from fastapi import APIRouter
from sqlmodel import select

from openrep.api.deps import SessionDep
from openrep.models.set import SetEntry
from openrep.models.workout import Workout
from openrep.schemas.analytics import (
    ExercisePersonalRecords,
    SetHistoryPoint,
    VolumeByDay,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def estimated_1rm(weight_kg: float, reps: int) -> float:
    """Epley formula. Reps of 1 return the weight itself."""
    if reps <= 1:
        return weight_kg
    return weight_kg * (1 + reps / 30)


@router.get("/exercises/{exercise_id}/history", response_model=list[SetHistoryPoint])
def exercise_history(exercise_id: int, session: SessionDep) -> list[SetHistoryPoint]:
    rows = session.exec(
        select(SetEntry, Workout.performed_on)
        .join(Workout, SetEntry.workout_id == Workout.id)
        .where(SetEntry.exercise_id == exercise_id)
        .order_by(Workout.performed_on)
    ).all()
    return [
        SetHistoryPoint(
            performed_on=performed_on,
            weight_kg=set_entry.weight_kg,
            reps=set_entry.reps,
            rpe=set_entry.rpe,
            estimated_1rm_kg=round(estimated_1rm(set_entry.weight_kg, set_entry.reps), 2),
        )
        for set_entry, performed_on in rows
    ]


@router.get("/exercises/{exercise_id}/personal-records", response_model=ExercisePersonalRecords)
def exercise_personal_records(exercise_id: int, session: SessionDep) -> ExercisePersonalRecords:
    rows = session.exec(
        select(SetEntry, Workout.performed_on)
        .join(Workout, SetEntry.workout_id == Workout.id)
        .where(SetEntry.exercise_id == exercise_id)
    ).all()

    if not rows:
        return ExercisePersonalRecords(
            exercise_id=exercise_id,
            max_weight_kg=None,
            max_estimated_1rm_kg=None,
            max_volume_in_a_workout_kg=None,
        )

    volume_by_workout: dict = defaultdict(float)
    max_weight = 0.0
    max_1rm = 0.0
    for set_entry, performed_on in rows:
        max_weight = max(max_weight, set_entry.weight_kg)
        max_1rm = max(max_1rm, estimated_1rm(set_entry.weight_kg, set_entry.reps))
        volume_by_workout[performed_on] += set_entry.weight_kg * set_entry.reps

    return ExercisePersonalRecords(
        exercise_id=exercise_id,
        max_weight_kg=round(max_weight, 2),
        max_estimated_1rm_kg=round(max_1rm, 2),
        max_volume_in_a_workout_kg=round(max(volume_by_workout.values()), 2),
    )


@router.get("/volume", response_model=list[VolumeByDay])
def volume_by_day(session: SessionDep) -> list[VolumeByDay]:
    rows = session.exec(
        select(SetEntry, Workout.performed_on).join(Workout, SetEntry.workout_id == Workout.id)
    ).all()

    totals: dict = defaultdict(lambda: {"volume": 0.0, "sets": 0})
    for set_entry, performed_on in rows:
        totals[performed_on]["volume"] += set_entry.weight_kg * set_entry.reps
        totals[performed_on]["sets"] += 1

    return [
        VolumeByDay(
            performed_on=day, total_volume_kg=round(data["volume"], 2), total_sets=data["sets"]
        )
        for day, data in sorted(totals.items())
    ]
