from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.set import SetEntry


class WorkoutBase(SQLModel):
    performed_on: date = Field(index=True)
    notes: str | None = None


class Workout(WorkoutBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    sets: list["SetEntry"] = Relationship(back_populates="workout", cascade_delete=True)


class WorkoutCreate(WorkoutBase):
    pass


class WorkoutUpdate(SQLModel):
    performed_on: date | None = None
    notes: str | None = None


class WorkoutRead(WorkoutBase):
    id: int
    created_at: datetime
