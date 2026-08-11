# Backend instructions

- **No service layer by design.** Route modules in `app/api/routes/` inline
  their session work (~40–100 lines each); follow that shape rather than
  introducing repositories/services.
- Each model file in `app/models/` defines the table class plus
  `*Create`/`*Update`/`*Read` variants — these double as request/response
  schemas. `app/schemas/` is only for cross-table derived shapes (analytics,
  backup documents).
- Error conventions: 404 for missing rows and dangling FK references on
  create; 409 for uniqueness conflicts (`IntegrityError` → rollback → 409) and
  for deletes blocked by dependent rows.
- SQLite FK enforcement is on via `enable_sqlite_foreign_keys()` in
  `app/core/db.py`; apply it to any engine you create (the test fixture in
  `tests/conftest.py` does).
- After model changes: `uv run alembic revision --autogenerate -m "..."` — but
  review the output; SQLite constraint changes usually need a hand-written
  `batch_alter_table` rebuild.
- Tests drive raw HTTP through the `client` fixture (in-memory SQLite,
  schema from models, not migrations). Build test data via the API, not the
  session. Preserve the env-var-before-`app.main`-import ordering at the top
  of `conftest.py`.
