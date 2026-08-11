# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OpenRep: a local-first strength training tracker. FastAPI backend + SQLite,
TanStack (Router + Query) frontend, Playwright e2e. "Local-first" here means
literally that: the backend is a personal server against a SQLite file on the
user's own machine (`~/.openrep/openrep.db` by default) — no auth, no
multi-tenancy, no cloud sync. See README.md for the pitch and stack summary.

## Repo layout

```
backend/   FastAPI + SQLModel + Alembic + pytest   (uv-managed)
frontend/  Vite + React + TanStack Router/Query     (pnpm workspace member)
e2e/       Playwright, drives frontend + backend    (pnpm workspace member)
```

`frontend/` and `e2e/` share one pnpm workspace (`pnpm-workspace.yaml`, single
root `pnpm-lock.yaml`). `backend/` is a separate uv project with its own lock
file — run `pnpm install` from repo root once, and `uv sync` from `backend/`.

## Scoped instructions

Area-specific conventions live in `.claude/` and are part of these
instructions:

- @.claude/frontend/INSTRUCTIONS.md — **frontend**: shadcn/ui is the default
  component library our components are built on; theming token contract;
  testing conventions.
- @.claude/backend/INSTRUCTIONS.md — **backend**: route/model/schema
  conventions, error-status contract, migration and test rules.

## Commands

### Backend (`cd backend`)

```bash
uv sync                                          # install deps
uv run uvicorn app.main:app --reload --port 8000 # dev server (auto-migrates on startup)
uv run pytest                                    # all tests
uv run pytest tests/test_exercises.py::test_create_and_list_exercise  # single test
uv run ruff check . && uv run ruff format .      # lint + format
uv run alembic revision --autogenerate -m "..."  # new migration after model changes
uv run alembic upgrade head                      # apply migrations manually (rarely needed, see below)
```

### Frontend (`cd frontend`)

```bash
pnpm dev                       # dev server on :5173 (expects backend on :8000)
pnpm build                     # typecheck + production build
pnpm test                      # vitest run
pnpm exec vitest run src/lib/api.test.ts  # single test file
pnpm lint                      # oxlint
```

`VITE_API_BASE_URL` (see `frontend/.env.example`) points the frontend at the
backend; defaults to `http://localhost:8000`.

### E2E (`cd e2e`)

```bash
pnpm test                                   # boots backend + frontend itself, runs all specs
pnpm exec playwright test tests/smoke.spec.ts  # single spec
```

`playwright.config.ts`'s `webServer` array starts both dev servers against a
throwaway DB (`e2e/.tmp/e2e.db`) — don't start servers manually first. First
time on a new machine, browsers need `pnpm exec playwright install chromium`
(use plain `install`, not `--with-deps`, in sandboxed environments without
root/sudo).

## Architecture notes

**Migrations run automatically.** `app/main.py`'s FastAPI `lifespan` calls
`app.core.migrate.run_migrations()` on every startup, which runs
`alembic upgrade head` programmatically against whatever `OPENREP_DATABASE_PATH`
resolves to. This is deliberate for a local-first single-user app — there's no
separate deploy step where someone would remember to run migrations. You still
write migrations by hand with `alembic revision --autogenerate` after changing
a model; you just don't need to apply them manually.

Because startup always migrates the *real* configured database,
`backend/tests/conftest.py` sets `OPENREP_DATABASE_PATH` to a fresh temp
directory *before* importing `app.main` — otherwise running pytest would
create/migrate a file under the developer's real `~/.openrep/`. Preserve that
ordering (env var set → then import app modules) if you touch conftest.py.

**Domain model** (`backend/app/models/`): `Exercise`, `Workout`, `SetEntry`.
A `SetEntry` belongs to one `Workout` and one `Exercise`, and carries
`weight_kg` / `reps` / `rpe` / `set_order`. Each SQLModel class file defines a
`*Base`/table class plus `*Create`/`*Update`/`*Read` variants — the same
SQLModel classes serve as both the ORM table and the FastAPI request/response
schemas, so there's no separate `schemas/` mirror of the core domain types
(`app/schemas/` is only used for cross-table *derived* data like analytics).

**Cross-model relationships use `TYPE_CHECKING`-only imports** (e.g.
`SetEntry.workout: "Workout"` with `Workout` imported only under
`TYPE_CHECKING`). This is intentional, not an oversight: SQLAlchemy resolves
`Relationship()` string targets via the shared declarative registry at
mapper-configuration time, not via Python's import system, so no runtime
import is needed as long as all three model modules get imported somewhere
before the app runs a query (`app/models/__init__.py` does this). Don't
"fix" apparent circular-import gaps here by adding runtime imports.

**Analytics/derived-data endpoints** live in `app/api/routes/analytics.py` +
`app/schemas/analytics.py` (personal records, volume-by-day, estimated 1RM via
the Epley formula). This is the intended growth point for the "complex data
analysis" side of the product — keep these endpoints read-only, computed from
`Exercise`/`Workout`/`SetEntry`, rather than introducing separately-persisted
aggregate state.

**Frontend routing is file-based** (TanStack Router): every file under
`src/routes/` maps directly to a URL path, and `src/routes/__root.tsx` is the
shared layout (nav + outlet). `src/routeTree.gen.ts` is generated by
`tsr generate` — it's gitignored and rebuilt automatically via the `predev`/
`prebuild` pnpm scripts and by the Vite plugin during `pnpm dev`. Never
hand-edit it. `frontend/tsr.config.json` excludes `*.test.tsx` from being
treated as routes, which is why component tests can live directly alongside
their route file (e.g. `src/routes/exercises.tsx` /
`src/routes/exercises.test.tsx`).

**API client** (`frontend/src/lib/api.ts`) is a small hand-written typed
`fetch` wrapper — there's no OpenAPI codegen yet. If you change a backend
Pydantic/SQLModel schema, update the matching TypeScript interface in this
file by hand.

## License

MIT (this is an open source project — see LICENSE).
