# Backend instructions

- **No service layer by design.** Route modules in `openrep/api/routes/` inline
  their session work (~40–100 lines each); follow that shape rather than
  introducing repositories/services.
- Each model file in `openrep/models/` defines the table class plus
  `*Create`/`*Update`/`*Read` variants — these double as request/response
  schemas. `openrep/schemas/` is only for cross-table derived shapes (analytics,
  backup documents).
- **New routers go on the `/api` parent router in `openrep/main.py`, never on
  `app` directly.** One process serves the API and the SPA, so a bare-root
  route is either shadowed by the SPA catch-all or collides outright with a
  frontend route (`/exercises` and `/workouts` are both).
- Error conventions: 404 for missing rows and dangling FK references on
  create; 409 for uniqueness conflicts (`IntegrityError` → rollback → 409) and
  for deletes blocked by dependent rows.
- Alembic lives at `openrep/migrations/` so it ships in the wheel;
  `run_migrations()` builds its `Config` in code. `backend/alembic.ini` is for
  the dev CLI only and is not distributed — don't make runtime depend on it.
- SQLite FK enforcement is on via `enable_sqlite_foreign_keys()` in
  `openrep/core/db.py`; apply it to any engine you create (the test fixture in
  `tests/conftest.py` does).
- After model changes: `uv run alembic revision --autogenerate -m "..."` — but
  review the output; SQLite constraint changes usually need a hand-written
  `batch_alter_table` rebuild.
- Tests drive raw HTTP through the `client` fixture (in-memory SQLite,
  schema from models, not migrations). Build test data via the API, not the
  session. Preserve the env-var-before-`openrep.main`-import ordering at the top
  of `conftest.py`.
