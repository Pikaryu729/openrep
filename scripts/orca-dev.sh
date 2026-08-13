#!/usr/bin/env bash
#
# Per-worktree dev environment for Orca workspaces. Driven by orca.yaml:
# `scripts.setup` runs `setup` once when a worktree is created, and each
# `defaultTabs` entry runs one of the server subcommands in its own tab.
#
# Everything is scoped to the worktree, because Orca runs several checkouts of
# this repo side by side and the defaults are not shareable: :8765 and :5173
# can only belong to one of them, and ~/.openrep/openrep.db would be migrated
# by whichever branch started last. Ports are allocated once per worktree and
# recorded in the worktree's git dir, and the SQLite file lives there too.
#
#   ./scripts/orca-dev.sh setup      allocate ports + db path, print them
#   ./scripts/orca-dev.sh backend    uvicorn on this worktree's backend port
#   ./scripts/orca-dev.sh frontend   vite on this worktree's frontend port
#   ./scripts/orca-dev.sh browser    point Orca's built-in browser at the UI
#   ./scripts/orca-dev.sh env        print the allocated values
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$(git -C "$ROOT" rev-parse --absolute-git-dir)/orca"
ENV_FILE="$STATE_DIR/dev.env"
# Every worktree's state lives under the one common git dir, which is how a
# worktree finds out what its siblings have already claimed.
COMMON_DIR="$(cd "$ROOT" && cd "$(git rev-parse --git-common-dir)" && pwd)"

# Which binary is Orca's CLI, per Orca's own resolution order. The Linux case
# is not pedantry: outside an Orca terminal, `orca` on Linux is the GNOME Orca
# screen reader, and calling it would start reading the desktop aloud.
resolve_orca_cli() {
  if [ -n "${ORCA_CLI_COMMAND:-}" ]; then
    printf '%s' "$ORCA_CLI_COMMAND"
  elif [ "${TERM_PROGRAM:-}" = "Orca" ] || [ -n "${ORCA_TERMINAL_HANDLE:-}" ]; then
    printf 'orca'
  elif [ "$(uname -s)" = "Linux" ]; then
    printf 'orca-ide'
  else
    printf 'orca'
  fi
}
ORCA="$(resolve_orca_cli)"

log() { printf '[orca-dev] %s\n' "$*" >&2; }

# e2e/playwright.config.ts hardcodes these and refuses to adopt a foreign
# server, so a worktree that squatted on them would break `pnpm --dir e2e test`
# for the whole machine — they are skipped even when free.
RESERVED_PORTS=" 8766 5174 "

# Ports a sibling worktree has already written down. Probing for a listener is
# not enough on its own: a sibling whose servers happen to be stopped still
# owns its recorded pair for good, so allocating around only what is live hands
# the same pair out twice and both worktrees collide the next time they run.
reserve_sibling_ports() {
  local file port
  for file in "$COMMON_DIR"/orca/dev.env "$COMMON_DIR"/worktrees/*/orca/dev.env; do
    if [ ! -f "$file" ] || [ "$file" = "$ENV_FILE" ]; then
      continue
    fi
    while read -r port; do
      case "$port" in
        '' | *[!0-9]*) continue ;;
      esac
      RESERVED_PORTS="$RESERVED_PORTS$port "
    done < <(grep -h '^OPENREP_[A-Z]*_PORT=' "$file" | cut -d= -f2)
  done
}

# The connect happens in a subshell so the descriptor closes with it.
port_is_listening() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

port_is_free() {
  case "$RESERVED_PORTS" in
    *" $1 "*) return 1 ;;
  esac
  ! port_is_listening "$1"
}

pick_port() {
  local port="$1"
  while ! port_is_free "$port"; do
    port=$((port + 1))
  done
  printf '%s' "$port"
}

wait_for_port() {
  local port="$1" tries="${2:-600}"
  while [ "$tries" -gt 0 ]; do
    if port_is_listening "$port"; then
      return 0
    fi
    sleep 0.25
    tries=$((tries - 1))
  done
  return 1
}

# The backend and frontend tabs start at the same time, so allocation is done
# under a lock and written once. Delete dev.env to reallocate.
#
# The lock lives in the common git dir, not this worktree's: it has to
# serialize sibling worktrees against each other too, or two of them created at
# the same moment both read the sibling ports before either writes its own.
allocate_env() {
  mkdir -p "$STATE_DIR" "$COMMON_DIR/orca"
  if [ -f "$ENV_FILE" ]; then
    return 0
  fi

  local lock="$COMMON_DIR/orca/dev.lock" waited=0
  until mkdir "$lock" 2>/dev/null; do
    if [ -f "$ENV_FILE" ]; then
      return 0
    fi
    sleep 0.2
    waited=$((waited + 1))
    if [ "$waited" -gt 150 ]; then
      log "taking over a stale lock at $lock"
      break
    fi
  done

  if [ ! -f "$ENV_FILE" ]; then
    local backend frontend
    reserve_sibling_ports
    backend="$(pick_port 8765)"
    frontend="$(pick_port 5173)"
    cat >"$ENV_FILE" <<EOF
# Written by scripts/orca-dev.sh for $(basename "$ROOT").
# Delete this file to hand the worktree a fresh pair of ports.
OPENREP_BACKEND_PORT=$backend
OPENREP_FRONTEND_PORT=$frontend
OPENREP_DATABASE_PATH=$STATE_DIR/openrep.db
EOF
    log "allocated backend :$backend and frontend :$frontend"
  fi

  rmdir "$lock" 2>/dev/null || true
}

load_env() {
  allocate_env
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  FRONTEND_URL="http://localhost:$OPENREP_FRONTEND_PORT"
}

cmd_setup() {
  load_env
  log "worktree: $ROOT"
  log "backend:  http://localhost:$OPENREP_BACKEND_PORT/api/docs"
  log "frontend: $FRONTEND_URL"
  log "database: $OPENREP_DATABASE_PATH"
  log "the backend and frontend tabs install their own dependencies"
}

cmd_backend() {
  load_env
  log "backend on :$OPENREP_BACKEND_PORT against $OPENREP_DATABASE_PATH"
  cd "$ROOT/backend"
  uv sync --quiet
  # Dev talks to the API through Vite's same-origin /api proxy, so this only
  # matters if you point a browser straight at the backend.
  export OPENREP_CORS_ORIGINS="[\"$FRONTEND_URL\"]"
  exec uv run uvicorn openrep.main:app --reload \
    --host 127.0.0.1 --port "$OPENREP_BACKEND_PORT"
}

cmd_frontend() {
  load_env
  log "frontend on :$OPENREP_FRONTEND_PORT, proxying /api to :$OPENREP_BACKEND_PORT"
  (cd "$ROOT" && pnpm install --silent)

  # Open the UI once Vite is actually listening, not before.
  (wait_for_port "$OPENREP_FRONTEND_PORT" && cmd_browser) &

  cd "$ROOT/frontend"
  export OPENREP_BACKEND_URL="http://127.0.0.1:$OPENREP_BACKEND_PORT"
  exec pnpm dev --port "$OPENREP_FRONTEND_PORT" --strictPort
}

cmd_browser() {
  load_env
  if ! command -v "$ORCA" >/dev/null 2>&1; then
    log "Orca CLI not found; open $FRONTEND_URL yourself"
    return 0
  fi
  # Restarting the dev server should reuse the tab rather than stack up copies.
  if "$ORCA" tab list --json 2>/dev/null | grep -qF "$FRONTEND_URL"; then
    "$ORCA" reload --json >/dev/null 2>&1 || true
    log "reloaded the built-in browser at $FRONTEND_URL"
    return 0
  fi
  if "$ORCA" tab create --url "$FRONTEND_URL" --json >/dev/null 2>&1; then
    log "opened the built-in browser at $FRONTEND_URL"
  else
    log "could not drive the Orca CLI; open $FRONTEND_URL yourself"
  fi
}

cmd_env() {
  load_env
  cat "$ENV_FILE"
}

case "${1:-setup}" in
  setup) cmd_setup ;;
  backend) cmd_backend ;;
  frontend) cmd_frontend ;;
  browser) cmd_browser ;;
  env) cmd_env ;;
  *)
    echo "usage: $0 {setup|backend|frontend|browser|env}" >&2
    exit 2
    ;;
esac
