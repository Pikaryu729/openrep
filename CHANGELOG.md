# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-11

First packaged release. OpenRep installs as a single command and runs as one
process serving both the API and the UI.

### Added

- `openrep` command that starts the server and opens the app in a browser,
  with `--port`, `--host`, `--no-browser`, and `--version` flags. Occupied
  ports fail with an actionable message rather than a traceback.
- Distribution as a PyPI wheel with the built frontend bundled inside:
  `uv tool install openrep` or `pipx install openrep`.
- Workout, exercise, and set tracking with weight, reps, RPE, and set order.
- Analytics: personal records, estimated 1RM (Epley), and volume by day.
- Theming with light/dark/system modes, five accent presets, and a custom
  accent picker, persisted locally and applied before first paint.
- Metric and imperial units; weights are always stored in kilograms and
  converted only for display and input.
- Full JSON backup export and import, with merge and replace modes.

### Changed

- The API is served under `/api`. The single-page app owns `/exercises`,
  `/workouts`, and `/workouts/:id` as client-side routes — the same paths the
  API previously answered with JSON — so one origin can serve both.
- Default port is 8765 rather than 8000, which collides with uvicorn, Django,
  and `http.server` defaults.
- The Python package is `openrep` (previously the generic `app`), and Alembic
  migrations ship inside it so they run from an installed wheel.
- The `fastapi[standard]` extra was dropped for plain `fastapi`, removing
  `fastapi-cli`, `typer`, `jinja2`, `python-multipart`, and `email-validator`
  from end-user installs.

### Fixed

- SQLite foreign keys are enforced: deleting a workout cascades to its sets,
  and deleting an exercise still referenced by sets is refused with a 409.
- Duplicate exercise names return 409 instead of a 500.
- Creating a set against a missing workout or exercise returns 404 instead of
  silently inserting an orphan row.
- New workouts default to the local date. They previously used the UTC date, so
  an evening session west of Greenwich was dated a day into the future.
- `openrep --host ::1` (or `::`) opens the browser instead of polling a
  bracketed IPv6 literal that no socket call accepts, and `--host ""` no longer
  exits with a traceback before the server starts.
- Sets with equal `set_order` — possible from direct API writes or an imported
  backup — keep a stable order instead of shuffling between requests.
- A failed sets or exercises request on a workout shows an error. It previously
  rendered the empty state, so a network blip looked like the logged sets had
  been lost.
- The exercise picker falls back to a live exercise when the selected one is
  deleted elsewhere, instead of posting an id the picker no longer displays.
- The same backup file can be selected again after an import, which is what
  switching from merge to replace requires.
- A backup containing duplicate exercise names is refused with 422 up front,
  rather than failing at commit with a 500 after replace mode issued the wipe.
- Requests for stale `assets/` bundles return 404 instead of the HTML shell,
  which a tab left open across an upgrade reported as a syntax error.
- Backup export downloads in Firefox, which ignores a programmatic click on an
  anchor that is not in the document.

### Development notes

- `frontend/.env` is gitignored. A stale `VITE_API_BASE_URL` there overrides
  the new same-origin `/api` default and breaks the dev loop — clear it.
- `./scripts/build-dist.sh` builds the distributable artifacts;
  `./scripts/smoke-wheel.sh` verifies a built wheel actually serves the app.

[Unreleased]: https://github.com/Pikaryu729/openrep/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pikaryu729/openrep/releases/tag/v0.1.0
