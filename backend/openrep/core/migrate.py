import logging
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from alembic.script.revision import RevisionError
from alembic.util import CommandError
from sqlalchemy import create_engine, pool

from openrep.core.config import settings

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

logger = logging.getLogger(__name__)


class DatabaseAheadOfCheckout(RuntimeError):
    """The database is stamped at a revision this build's history does not contain."""


def alembic_config() -> Config:
    """Build the Alembic config in code rather than reading alembic.ini.

    alembic.ini lives at the backend project root for the `alembic` CLI, but it
    sits *outside* the installed package — so the runtime path must not need it.
    A file-less Config still creates the [alembic] section, and
    version_locations defaults to <script_location>/versions.
    """
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return config


def pending_revisions(config: Config) -> tuple[str | None, list[str]]:
    """Return the database's current revision and what `upgrade head` would apply.

    An empty list means the database is already at head. A current revision of
    `None` means the file is new and Alembic has never stamped it — there is
    nothing in it to preserve.
    """
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()

    engine = create_engine(settings.database_url, poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
    finally:
        engine.dispose()

    if current == head:
        return current, []

    try:
        walk = list(script.iterate_revisions(head, current))
    except (RevisionError, CommandError) as exc:
        # The database was migrated by a checkout that has a revision this one
        # does not — typically another worktree's branch pointed at the same
        # file. Alembic's own message here is just "Can't locate revision",
        # which gives no hint about what happened or how to get out of it.
        # Both bases are caught because iterate_revisions raises the low-level
        # ResolutionError while command.upgrade wraps the same fault as a
        # CommandError.
        raise DatabaseAheadOfCheckout(
            f"{settings.database_path} is stamped at revision {current!r}, which is not "
            f"in this build's migration history (head is {head!r}). A newer OpenRep or "
            "another branch migrated this database, and there is no downgrade path from "
            "here.\n\n"
            "  Use a scratch database:  OPENREP_DATABASE_PATH=/tmp/scratch.db\n"
            "  Or roll the file back:   check out the branch that created "
            f"{current!r}, then `alembic downgrade {head!r}`\n"
            "  Snapshots taken before earlier migrations sit next to the database as "
            "*.pre-<revision>.*.db"
        ) from exc

    return current, [revision.revision for revision in walk]


def _snapshot(revision: str) -> Path:
    """Copy the database aside, tagged with the revision it is being migrated off."""
    source_path = settings.database_path
    # UTC to match every other timestamp in the app (see models/workout.py).
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    destination = source_path.with_name(f"{source_path.stem}.pre-{revision}.{stamp}.db")

    # sqlite3's backup API copies a consistent snapshot even while another
    # connection is mid-write, which a plain file copy cannot promise.
    with (
        closing(sqlite3.connect(source_path)) as source,
        closing(sqlite3.connect(destination)) as target,
    ):
        source.backup(target)

    return destination


def run_migrations() -> None:
    config = alembic_config()
    current, pending = pending_revisions(config)

    # Startup migrates automatically and nothing here ever downgrades, so for a
    # database that already holds training data this copy is the only way back.
    # A brand-new file (current is None) has nothing to preserve.
    if current is not None and pending:
        destination = _snapshot(current)
        logger.info(
            "Applying %d migration(s); snapshot of revision %s saved to %s",
            len(pending),
            current,
            destination,
        )

    command.upgrade(config, "head")
