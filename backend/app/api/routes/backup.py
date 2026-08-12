from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import delete, select

from app.api.deps import SessionDep
from app.models.exercise import Exercise
from app.models.set import SetEntry
from app.models.workout import Workout
from app.schemas.backup import (
    BACKUP_VERSION,
    BackupDocument,
    BackupImportRequest,
    BackupImportSummary,
)

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/export", response_model=BackupDocument)
def export_backup(session: SessionDep) -> BackupDocument:
    return BackupDocument(
        exported_at=datetime.now(UTC),
        exercises=session.exec(select(Exercise).order_by(Exercise.id)).all(),
        workouts=session.exec(select(Workout).order_by(Workout.id)).all(),
        sets=session.exec(select(SetEntry).order_by(SetEntry.id)).all(),
    )


@router.post("/import", response_model=BackupImportSummary)
def import_backup(request: BackupImportRequest, session: SessionDep) -> BackupImportSummary:
    data = request.data
    if data.version != BACKUP_VERSION:
        raise HTTPException(status_code=422, detail=f"Unsupported backup version {data.version}")

    exercise_ids = {exercise.id for exercise in data.exercises}
    workout_ids = {workout.id for workout in data.workouts}
    for set_entry in data.sets:
        if set_entry.workout_id not in workout_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Set {set_entry.id} references unknown workout {set_entry.workout_id}",
            )
        if set_entry.exercise_id not in exercise_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Set {set_entry.id} references unknown exercise {set_entry.exercise_id}",
            )

    if request.mode == "replace":
        session.exec(delete(SetEntry))
        session.exec(delete(Workout))
        session.exec(delete(Exercise))

    exercises_created = 0
    exercises_matched = 0
    exercise_remap: dict[int, int] = {}
    for exercise in data.exercises:
        existing = None
        if request.mode == "merge":
            existing = session.exec(select(Exercise).where(Exercise.name == exercise.name)).first()
        if existing is not None:
            exercise_remap[exercise.id] = existing.id
            exercises_matched += 1
        else:
            db_exercise = Exercise(
                name=exercise.name, category=exercise.category, notes=exercise.notes
            )
            session.add(db_exercise)
            session.flush()
            exercise_remap[exercise.id] = db_exercise.id
            exercises_created += 1

    workout_remap: dict[int, int] = {}
    for workout in data.workouts:
        db_workout = Workout(
            performed_on=workout.performed_on,
            notes=workout.notes,
            created_at=workout.created_at,
        )
        session.add(db_workout)
        session.flush()
        workout_remap[workout.id] = db_workout.id

    for set_entry in data.sets:
        session.add(
            SetEntry(
                workout_id=workout_remap[set_entry.workout_id],
                exercise_id=exercise_remap[set_entry.exercise_id],
                weight_kg=set_entry.weight_kg,
                reps=set_entry.reps,
                rpe=set_entry.rpe,
                set_order=set_entry.set_order,
            )
        )

    session.commit()
    return BackupImportSummary(
        mode=request.mode,
        exercises_created=exercises_created,
        exercises_matched=exercises_matched,
        workouts_created=len(workout_remap),
        sets_created=len(data.sets),
    )
