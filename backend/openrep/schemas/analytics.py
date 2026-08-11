from datetime import date

from sqlmodel import SQLModel


class VolumeByDay(SQLModel):
    performed_on: date
    total_volume_kg: float
    total_sets: int


class SetHistoryPoint(SQLModel):
    performed_on: date
    weight_kg: float
    reps: int
    rpe: float | None
    estimated_1rm_kg: float


class ExercisePersonalRecords(SQLModel):
    exercise_id: int
    max_weight_kg: float | None
    max_estimated_1rm_kg: float | None
    max_volume_in_a_workout_kg: float | None
