from datetime import datetime
from typing import Literal

from sqlmodel import SQLModel

from app.models.exercise import ExerciseRead
from app.models.set import SetEntryRead
from app.models.workout import WorkoutRead

BACKUP_VERSION = 1


class BackupDocument(SQLModel):
    app: str = "openrep"
    version: int = BACKUP_VERSION
    exported_at: datetime
    exercises: list[ExerciseRead]
    workouts: list[WorkoutRead]
    sets: list[SetEntryRead]


class BackupImportRequest(SQLModel):
    mode: Literal["merge", "replace"] = "merge"
    data: BackupDocument


class BackupImportSummary(SQLModel):
    mode: str
    exercises_created: int
    exercises_matched: int
    workouts_created: int
    sets_created: int
