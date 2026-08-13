# OpenRep

A local-first strength training tracker, built for easy logging and deep data
analysis.

OpenRep runs as a small personal server on your own machine: a FastAPI backend
persists everything to a SQLite database on disk, and the React UI is served
from the same process. There's no cloud account, no telemetry, and no
multi-tenant auth — your training data stays on your machine.

## Install

```bash
uv tool install openrep     # or: pipx install openrep
openrep
```

Your browser opens on the app. That's the whole setup.

Your data lives in `~/.openrep/openrep.db`. Back it up from **Settings →
Backup**, or just copy that file.

### Options

| Flag | Default | Description |
| --- | --- | --- |
| `--port` | `8765` | Port to listen on (`OPENREP_PORT`) |
| `--host` | `127.0.0.1` | Address to bind (`OPENREP_HOST`) |
| `--no-browser` | off | Don't open a browser on startup |
| `--version` | | Print the version and exit |

Set `OPENREP_DATABASE_PATH` to keep the database elsewhere. Settings can also
live in `~/.openrep/.env`.

> Binding to anything other than a loopback address puts your training
> database on the network, and OpenRep has no authentication.

### Upgrading

```bash
uv tool upgrade openrep
```

Migrations run automatically the next time you start it.

## Features

- Workouts, exercises, and sets with weight, reps, RPE, and ordering
- Personal records, estimated 1RM, and training volume analytics
- Light/dark/system themes, five accent presets, and a custom accent picker
- Metric or imperial units
- Full JSON export and import for backup and restore

## Stack

- **Backend**: FastAPI, SQLModel (SQLAlchemy + Pydantic), Alembic, SQLite
- **Frontend**: React, TanStack Router (file-based routing), TanStack Query,
  Vite, Tailwind, shadcn/ui
- **E2E tests**: Playwright, driving the real frontend + backend together
- **Package management**: [uv](https://docs.astral.sh/uv/) (Python),
  [pnpm](https://pnpm.io/) workspaces (JS/TS)

## Development

Two servers, so the frontend gets hot reload. The Vite dev server proxies
`/api` to the backend, so the browser sees a single origin — the same as the
packaged app.

```bash
# Backend on :8765
cd backend
uv sync
uv run uvicorn openrep.main:app --reload --port 8765

# Frontend on :5173
pnpm install          # from the repo root; installs frontend and e2e
pnpm --dir frontend dev
```

Visit `http://localhost:5173`. Migrations run automatically on startup; the
database defaults to `~/.openrep/openrep.db` (override with
`OPENREP_DATABASE_PATH` so you don't develop against your real data).

> `frontend/.env` is gitignored. If yours still sets `VITE_API_BASE_URL` from
> an older checkout, clear it — it overrides the same-origin `/api` default.

### Orca workspaces

`orca.yaml` is checked in, so opening this repo in [Orca](https://orca.computer)
gives every new worktree a backend tab and a frontend tab that come up on their
own. `scripts/orca-dev.sh` backs all of it, and can be run by hand outside Orca:

```bash
./scripts/orca-dev.sh setup       # allocate this worktree's ports + database
./scripts/orca-dev.sh backend     # uvicorn, with reload
./scripts/orca-dev.sh frontend    # vite, and opens Orca's browser on the UI
```

Because several worktrees run at once, none of them may assume the defaults:
each gets the first free port at or above 8765/5173 — skipping the pair `e2e`
reserves — plus its own SQLite file, recorded in that worktree's git directory
(`./scripts/orca-dev.sh env` prints them). Delete
`$(git rev-parse --git-dir)/orca/dev.env` to reallocate.

### Tests

```bash
cd backend && uv run pytest        # backend unit tests
pnpm --dir frontend test           # frontend unit tests
pnpm --dir e2e test                # end-to-end (boots both servers itself)
```

### Building a release artifact

```bash
./scripts/build-dist.sh                                   # sdist + wheel
./scripts/smoke-wheel.sh backend/dist/openrep-*.whl       # verify the wheel
```

`build-dist.sh` builds the frontend into `backend/openrep/static/` so the
wheel serves the UI from the same process as the API.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for what's planned and what's explicitly out
of scope.

## License

MIT, see [LICENSE](./LICENSE).
