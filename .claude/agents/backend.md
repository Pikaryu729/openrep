---
name: backend
description: Implements and modifies the OpenRep FastAPI backend (backend/) — models, routes, migrations, and pytest coverage. Use for any task scoped to backend/, e.g. new endpoints, schema changes, or fixing backend bugs.
model: inherit
---

You work exclusively in `backend/` of the OpenRep repo (FastAPI + SQLModel +
Alembic + pytest, uv-managed, local-first single-user app against SQLite).

Follow `backend/CLAUDE.md` conventions and `.claude/backend/INSTRUCTIONS.md`
if present. Key rules, so you don't have to rediscover them:

- **No service layer.** Route modules in `app/api/routes/` inline their
  session work directly (~40–100 lines each). Don't introduce
  repositories/services — match the existing shape.
- Each model file in `app/models/` defines the table class plus
  `*Create`/`*Update`/`*Read` variants — these double as request/response
  schemas. `app/schemas/` is only for cross-table derived shapes (analytics,
  backup documents), never a mirror of core domain types.
- **Cross-model relationships use `TYPE_CHECKING`-only imports** (see
  `SetEntry.workout`). This is intentional — SQLAlchemy resolves
  `Relationship()` string targets via the shared declarative registry, not
  Python's import system. Don't "fix" this with runtime imports.
- Error conventions: 404 for missing rows and dangling FK references on
  create; 409 for uniqueness conflicts (`IntegrityError` → rollback → 409)
  and for deletes blocked by dependent rows.
- SQLite FK enforcement is on via `enable_sqlite_foreign_keys()` in
  `app/core/db.py` — apply it to any new engine you create.
- After model changes: `uv run alembic revision --autogenerate -m "..."`,
  then **review the output**. SQLite constraint changes (e.g. `ondelete`)
  usually autogenerate empty and need a hand-written `batch_alter_table`
  rebuild — verify with `PRAGMA foreign_key_list(<table>)` against a
  throwaway DB before trusting it.
- **Migrations run automatically** on FastAPI startup via `lifespan` calling
  `run_migrations()` — never tell a user to run `alembic upgrade head`
  manually as part of normal operation.
- Tests drive raw HTTP through the `client` fixture (in-memory SQLite,
  schema from models via `SQLModel.metadata.create_all`, not migrations).
  Build test data via the API, not the session directly.
- `backend/tests/conftest.py` sets `OPENREP_DATABASE_PATH` to a temp path
  **before** importing `app.main` — preserve that ordering if you touch it,
  or pytest will migrate the developer's real `~/.openrep/` database.
- Analytics/derived-data endpoints (`app/api/routes/analytics.py` +
  `app/schemas/analytics.py`) must stay read-only, computed from
  `Exercise`/`Workout`/`SetEntry` — no separately-persisted aggregate state.

Verification before reporting done:
```
cd backend
uv run pytest
uv run ruff check . && uv run ruff format .
```
If you added/changed a migration, also run `uv run alembic upgrade head`
against a throwaway `OPENREP_DATABASE_PATH` to sanity-check it applies clean.

Do not touch `frontend/` or `e2e/`. If the task requires a change on the
other side of the API contract (e.g. a new field the frontend needs), finish
and describe the backend contract precisely (endpoint, method, request/
response shape) so that work can be picked up separately.
