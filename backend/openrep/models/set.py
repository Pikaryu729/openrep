from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from openrep.models.exercise import Exercise
    from openrep.models.workout import Workout


class SetEntryBase(SQLModel):
    workout_id: int = Field(foreign_key="workout.id", index=True, ondelete="CASCADE")
    exercise_id: int = Field(foreign_key="exercise.id", index=True, ondelete="RESTRICT")
    weight_kg: float
    reps: int
    rpe: float | None = None
    set_order: int = Field(default=0)


class SetEntry(SetEntryBase, table=True):
    __tablename__ = "set_entry"

    id: int | None = Field(default=None, primary_key=True)

    workout: "Workout" = Relationship(back_populates="sets")
    exercise: "Exercise" = Relationship(back_populates="sets")


class SetEntryCreate(SetEntryBase):
    pass


class SetEntryUpdate(SQLModel):
    weight_kg: float | None = None
    reps: int | None = None
    rpe: float | None = None
    set_order: int | None = None


class SetEntryRead(SetEntryBase):
    id: int


class SetOrderUpdate(SQLModel):
    """One row's new position, for the bulk reorder endpoint."""

    id: int
    set_order: int
