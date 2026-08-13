#!/usr/bin/env bash
# Make a fresh git worktree safe to run, then install its dependencies.
#
# A linked worktree inherits nothing gitignored from the checkout it branched
# from: no backend/.venv, no node_modules, and — the omission that costs data —
# no per-worktree database setting. Startup runs `alembic upgrade head` against
# whatever OPENREP_DATABASE_PATH resolves to, so a branch carrying a new
# migration upgrades ~/.openrep/openrep.db in place and leaves every older
# checkout unable to open it.
#
# scripts/dev.sh exports the same path, but writing backend/.env here covers
# every other entrypoint whose cwd is backend/ as well — plain `uv run uvicorn`,
# the `alembic` CLI, ad-hoc scripts — not just the one launcher.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# A linked worktree has .git as a file holding a gitdir: pointer; the main
# checkout has it as a directory. Only the former gets a scratch database — the
# main checkout should go on using the developer's real training data.
if [ -f .git ]; then
  mkdir -p .dev
  if [ -e backend/.env ]; then
    echo "==> backend/.env exists already, leaving it as it is"
  else
    # .env is gitignored repo-wide, so this stays out of git status.
    printf 'OPENREP_DATABASE_PATH=%s\n' "$root/.dev/openrep.db" > backend/.env
    echo "==> Wrote backend/.env -> $root/.dev/openrep.db"
  fi
else
  echo "==> Main checkout, so the real database stays configured"
fi

echo "==> Installing backend dependencies"
(cd backend && uv sync)

echo "==> Installing frontend and e2e dependencies"
pnpm install

echo
echo "Ready. Start both dev servers with: make dev"
