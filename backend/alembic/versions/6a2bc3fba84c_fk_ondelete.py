"""fk ondelete

Revision ID: 6a2bc3fba84c
Revises: ed42a62fa85f
Create Date: 2026-08-10 21:40:23.802294

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '6a2bc3fba84c'
down_revision: Union[str, Sequence[str], None] = 'ed42a62fa85f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# SQLite can't ALTER constraints in place, and the original FKs are unnamed;
# batch mode rebuilds the table, and this naming convention lets us address
# the reflected unnamed constraints deterministically.
naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("set_entry", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint("fk_set_entry_workout_id_workout", type_="foreignkey")
        batch_op.drop_constraint("fk_set_entry_exercise_id_exercise", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_set_entry_workout_id_workout",
            "workout",
            ["workout_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_foreign_key(
            "fk_set_entry_exercise_id_exercise",
            "exercise",
            ["exercise_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("set_entry", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint("fk_set_entry_workout_id_workout", type_="foreignkey")
        batch_op.drop_constraint("fk_set_entry_exercise_id_exercise", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_set_entry_workout_id_workout", "workout", ["workout_id"], ["id"]
        )
        batch_op.create_foreign_key(
            "fk_set_entry_exercise_id_exercise", "exercise", ["exercise_id"], ["id"]
        )
