# OpenRep

A local-first strength training tracker. One command, your data on your machine.

OpenRep runs as a small personal server on your own computer: a FastAPI
backend persists everything to a SQLite database on disk, and a React
single-page app is served from the same process. There is no cloud account,
no telemetry, and no multi-tenant auth — your training data never leaves your
machine.

## Install

```bash
uv tool install openrep     # or: pipx install openrep
openrep
```

Your browser opens on the app. The database lives at
`~/.openrep/openrep.db`.

## Options

| Flag | Default | Description |
| --- | --- | --- |
| `--port` | `8765` | Port to listen on (`OPENREP_PORT`) |
| `--host` | `127.0.0.1` | Address to bind (`OPENREP_HOST`) |
| `--no-browser` | off | Don't open a browser on startup |
| `--version` | | Print the version and exit |

Set `OPENREP_DATABASE_PATH` to keep the database somewhere else.

## Features

- Log workouts, exercises, and sets with weight, reps, and RPE
- Personal records, estimated 1RM, and training-volume analytics
- Light/dark themes with preset and custom accent colors
- Metric or imperial units
- Full JSON export and import for backup and restore

Source, issues, and development setup:
<https://github.com/Pikaryu729/openrep>

MIT licensed.
