from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from openrep.models.set import SetEntry


class ExerciseBase(SQLModel):
    name: str = Field(index=True, unique=True)
    category: str = Field(default="uncategorized", index=True)
    notes: str | None = None


class Exercise(ExerciseBase, table=True):
    id: int | None = Field(default=None, primary_key=True)

    sets: list["SetEntry"] = Relationship(back_populates="exercise")


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(SQLModel):
    name: str | None = None
    category: str | None = None
    notes: str | None = None


class ExerciseRead(ExerciseBase):
    id: int
