from pathlib import Path

from alembic import command
from alembic.config import Config

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


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


def run_migrations() -> None:
    command.upgrade(alembic_config(), "head")
