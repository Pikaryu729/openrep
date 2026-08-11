# OpenRep

A local-first strength training tracker, built for easy logging and deep data analysis.

OpenRep runs as a small personal server on your own machine: a FastAPI backend
persists everything to a SQLite database on disk, and a TanStack (Router +
Query) frontend talks to it over HTTP. There's no required cloud account and
no multi-tenant auth — your data stays on your machine.

## Stack

- **Backend**: FastAPI, SQLModel (SQLAlchemy + Pydantic), Alembic, SQLite
- **Frontend**: React, TanStack Router (file-based routing), TanStack Query, Vite
- **E2E tests**: Playwright, driving the real frontend + backend together
- **Package management**: [uv](https://docs.astral.sh/uv/) (Python), [pnpm](https://pnpm.io/) workspaces (JS/TS)

## Getting started

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Database migrations run automatically on startup. The SQLite file defaults to
`~/.openrep/openrep.db`; override with `OPENREP_DATABASE_PATH`.

### Frontend

```bash
cd frontend  # or: pnpm --dir frontend
pnpm install # from repo root, installs both frontend and e2e workspaces
pnpm dev
```

Visit `http://localhost:5173`. The frontend expects the backend at
`http://localhost:8000` by default; override with `VITE_API_BASE_URL` (see
`frontend/.env.example`).

### Tests

```bash
# Backend unit tests
cd backend && uv run pytest

# Frontend unit tests
cd frontend && pnpm test

# End-to-end tests (boots both servers automatically)
cd e2e && pnpm test
```

## License

MIT, see [LICENSE](./LICENSE).
