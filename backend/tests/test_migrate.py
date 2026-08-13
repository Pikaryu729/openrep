"""Migration safety: a schema change to a database holding data must leave a way back.

Startup runs `alembic upgrade head` against whatever OPENREP_DATABASE_PATH
resolves to, and nothing here ever downgrades — so these tests are about the
snapshot that makes that recoverable, and about failing legibly when a database
has already been migrated by a checkout this one cannot follow.
"""

import sqlite3
from pathlib import Path

import pytest
from alembic import command

from openrep.core.config import settings
from openrep.core.migrate import (
    DatabaseAheadOfCheckout,
    alembic_config,
    pending_revisions,
    run_migrations,
)


@pytest.fixture(name="db_path")
def db_path_fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point migrations at a throwaway file.

    `openrep/migrations/env.py` reads `settings.database_url` when Alembic execs
    it, so patching the settings singleton redirects a real migration run.
    """
    monkeypatch.setattr(settings, "database_path", tmp_path / "openrep.db")
    return settings.database_path


def snapshots_beside(db_path: Path) -> list[Path]:
    return sorted(db_path.parent.glob(f"{db_path.stem}.pre-*.db"))


def revision_of(db_path: Path) -> str | None:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute("SELECT version_num FROM alembic_version").fetchone()
    return row[0] if row else None


def test_fresh_database_has_every_revision_pending(db_path: Path):
    current, pending = pending_revisions(alembic_config())
    assert current is None
    assert len(pending) > 1


def test_fresh_database_migrates_without_a_snapshot(db_path: Path):
    run_migrations()

    # Nothing existed to lose, so a copy would be pure noise in ~/.openrep/.
    assert snapshots_beside(db_path) == []
    _, pending = pending_revisions(alembic_config())
    assert pending == []


def test_database_already_at_head_is_a_noop(db_path: Path):
    run_migrations()
    at_head = revision_of(db_path)

    run_migrations()

    assert revision_of(db_path) == at_head
    assert snapshots_beside(db_path) == []


def test_schema_change_snapshots_the_existing_database(db_path: Path):
    config = alembic_config()
    run_migrations()
    with sqlite3.connect(db_path) as connection:
        connection.execute("INSERT INTO exercise (id, name, category) VALUES (1, 'Squat', 'legs')")

    # Step back one revision so the next run has real work to do, the way an
    # older database meets a build that has grown a migration.
    command.downgrade(config, "-1")
    behind = revision_of(db_path)

    run_migrations()

    assert revision_of(db_path) != behind, "should have upgraded back to head"
    copies = snapshots_beside(db_path)
    assert len(copies) == 1
    assert behind in copies[0].name, "the copy is tagged with the revision it was taken at"

    # The point of the snapshot: the training data is still readable from it.
    with sqlite3.connect(copies[0]) as connection:
        assert connection.execute("SELECT name FROM exercise").fetchone() == ("Squat",)


def test_database_ahead_of_checkout_is_rejected_with_guidance(db_path: Path):
    run_migrations()
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE alembic_version SET version_num = 'ffffffffffff'")

    with pytest.raises(DatabaseAheadOfCheckout) as exc:
        run_migrations()

    message = str(exc.value)
    assert "ffffffffffff" in message
    assert "OPENREP_DATABASE_PATH" in message, "must say how to get unstuck"
    assert snapshots_beside(db_path) == [], "a database we cannot read is not worth copying"
