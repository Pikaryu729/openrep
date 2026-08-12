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
    max_weight_achieved_on: date | None
    max_estimated_1rm_kg: float | None
    max_estimated_1rm_achieved_on: date | None
    max_volume_in_a_workout_kg: float | None
    max_volume_achieved_on: date | None


class RecentPersonalRecord(SQLModel):
    """One exercise's best estimated 1RM, for the dashboard's PR panel.

    Carries the exercise name so the panel needs one request rather than a
    fan-out over the library.
    """

    exercise_id: int
    exercise_name: str
    max_estimated_1rm_kg: float
    achieved_on: date
