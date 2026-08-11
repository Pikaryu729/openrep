from collections.abc import Generator

from sqlalchemy import Engine, event
from sqlmodel import Session, create_engine

from app.core.config import settings

settings.database_path.parent.mkdir(parents=True, exist_ok=True)


def enable_sqlite_foreign_keys(target: Engine) -> None:
    """SQLite ships with foreign key enforcement off; turn it on per connection."""

    @event.listens_for(target, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


engine: Engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
enable_sqlite_foreign_keys(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
