from collections import defaultdict
from datetime import date

from fastapi import APIRouter
from sqlmodel import select

from openrep.api.deps import SessionDep
from openrep.models.exercise import Exercise
from openrep.models.set import SetEntry
from openrep.models.workout import Workout
from openrep.schemas.analytics import (
    ExercisePersonalRecords,
    RecentPersonalRecord,
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
            max_weight_achieved_on=None,
            max_estimated_1rm_kg=None,
            max_estimated_1rm_achieved_on=None,
            max_volume_in_a_workout_kg=None,
            max_volume_achieved_on=None,
        )

    volume_by_workout: dict = defaultdict(float)
    # A PR is dated to the *first* day it was reached — repeating a best lift
    # later does not reset the record.
    max_weight = max_1rm = 0.0
    weight_on: date | None = None
    rm_on: date | None = None
    for set_entry, performed_on in rows:
        if set_entry.weight_kg > max_weight or weight_on is None:
            max_weight, weight_on = set_entry.weight_kg, performed_on
        elif set_entry.weight_kg == max_weight and performed_on < weight_on:
            weight_on = performed_on

        one_rm = estimated_1rm(set_entry.weight_kg, set_entry.reps)
        if one_rm > max_1rm or rm_on is None:
            max_1rm, rm_on = one_rm, performed_on
        elif one_rm == max_1rm and performed_on < rm_on:
            rm_on = performed_on

        volume_by_workout[performed_on] += set_entry.weight_kg * set_entry.reps

    best_volume = max(volume_by_workout.values())
    best_volume_on = min(day for day, total in volume_by_workout.items() if total == best_volume)

    return ExercisePersonalRecords(
        exercise_id=exercise_id,
        max_weight_kg=round(max_weight, 2),
        max_weight_achieved_on=weight_on,
        max_estimated_1rm_kg=round(max_1rm, 2),
        max_estimated_1rm_achieved_on=rm_on,
        max_volume_in_a_workout_kg=round(best_volume, 2),
        max_volume_achieved_on=best_volume_on,
    )


@router.get("/personal-records", response_model=list[RecentPersonalRecord])
def recent_personal_records(session: SessionDep, limit: int = 5) -> list[RecentPersonalRecord]:
    """Best estimated 1RM per exercise, most recently set first."""
    rows = session.exec(
        select(SetEntry, Workout.performed_on, Exercise.name)
        .join(Workout, SetEntry.workout_id == Workout.id)
        .join(Exercise, SetEntry.exercise_id == Exercise.id)
    ).all()

    best: dict[int, RecentPersonalRecord] = {}
    for set_entry, performed_on, exercise_name in rows:
        one_rm = estimated_1rm(set_entry.weight_kg, set_entry.reps)
        current = best.get(set_entry.exercise_id)
        if current is None or one_rm > current.max_estimated_1rm_kg:
            best[set_entry.exercise_id] = RecentPersonalRecord(
                exercise_id=set_entry.exercise_id,
                exercise_name=exercise_name,
                max_estimated_1rm_kg=round(one_rm, 2),
                achieved_on=performed_on,
            )
        elif one_rm == current.max_estimated_1rm_kg and performed_on < current.achieved_on:
            current.achieved_on = performed_on

    ordered = sorted(best.values(), key=lambda pr: (pr.achieved_on, pr.exercise_name), reverse=True)
    return ordered[:limit]


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
