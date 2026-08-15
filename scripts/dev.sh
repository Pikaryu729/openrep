#!/usr/bin/env bash
# Run this worktree's dev servers on ports derived from its own path, against a
# database that is not the developer's real one.
#
# Both matter as soon as two checkouts are live at once (parallel agents, or a
# review branch open beside a feature branch). Ports collide loudly and
# harmlessly. The database collides silently and expensively: startup runs
# `alembic upgrade head` against whatever OPENREP_DATABASE_PATH resolves to, so
# a branch carrying a new migration upgrades ~/.openrep/openrep.db in place —
# after which every older checkout fails to boot, because its migration history
# does not contain the revision the file is now stamped at.
#
# Usage: dev.sh [both|backend|frontend|ports]
#        `ports` resolves and reports without starting anything.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

component="${1:-both}"
state_dir="$root/.dev"
ports_file="$state_dir/ports.env"
mkdir -p "$state_dir"

# 1000 two-port slots, clear of the 5173/8765 defaults, of the e2e suite's own
# derived range, and of the ephemeral ports Linux hands out from 32768 up.
port_low=20000
port_span=2000
port_block=2

port_free() {
  # A refused connection means nothing is listening. Cheaper than a Python
  # probe and keeps this script dependency-free.
  ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

derive_ports() {
  local digest attempt=0
  digest="$(printf '%s' "$root" | cksum | cut -d' ' -f1)"
  backend_port=$(( port_low + (digest % (port_span / port_block)) * port_block ))

  # Deterministic first: a worktree keeps the same URLs across restarts, so a
  # bookmark stays good and a backend started in one terminal agrees with a
  # frontend started in another. Walk to the next block only if this one is
  # actually occupied, so a hash collision degrades instead of failing.
  while (( attempt < 100 )) && ! { port_free "$backend_port" && port_free "$((backend_port + 1))"; }; do
    backend_port=$(( port_low + ((backend_port - port_low + port_block) % port_span) ))
    attempt=$(( attempt + 1 ))
  done

  frontend_port=$(( backend_port + 1 ))
}

# A linked worktree has .git as a file holding a gitdir: pointer; the main
# checkout has it as a directory. Only the former gets a scratch database.
# Exported here as well as in backend/.env (written by worktree-init.sh) because
# a real environment variable outranks the dotenv file — the two name the same
# path, so whichever is in play, this worktree stays off the real database.
if [ -f .git ]; then
  export OPENREP_DATABASE_PATH="$state_dir/openrep.db"
fi
database="${OPENREP_DATABASE_PATH:-$HOME/.openrep/openrep.db}"

if [ "$component" = "both" ] || [ ! -f "$ports_file" ]; then
  derive_ports
  cat > "$ports_file" <<EOF
# Written by scripts/dev.sh. Source this, or just read it, to find the servers
# this worktree is using. Deleted when \`dev.sh both\` exits.
OPENREP_DEV_BACKEND_PORT=$backend_port
OPENREP_DEV_FRONTEND_PORT=$frontend_port
OPENREP_DEV_URL=http://127.0.0.1:$frontend_port
OPENREP_DATABASE_PATH=$database
EOF
else
  # Started per-component in a second terminal: adopt the ports the first one
  # picked rather than re-probing, since its servers now hold them.
  # shellcheck source=/dev/null
  source "$ports_file"
  backend_port="$OPENREP_DEV_BACKEND_PORT"
  frontend_port="$OPENREP_DEV_FRONTEND_PORT"
fi

echo "==> OpenRep dev ($component)"
echo "    UI        http://127.0.0.1:$frontend_port"
echo "    API docs  http://127.0.0.1:$backend_port/api/docs"
echo "    Database  $database"
echo "    Ports     $ports_file"
echo

start_backend() {
  cd "$root/backend"
  exec uv run uvicorn openrep.main:app --reload --port "$backend_port"
}

start_frontend() {
  # --strictPort: without it Vite silently walks to the next free port while
  # everything else — the proxy target above, $ports_file, whatever the user
  # bookmarked — keeps pointing at this one.
  export OPENREP_BACKEND_URL="http://127.0.0.1:$backend_port"
  exec pnpm --dir "$root/frontend" dev --port "$frontend_port" --strictPort
}

case "$component" in
  backend) start_backend ;;
  frontend) start_frontend ;;
  ports) exit 0 ;;
  both) ;;
  *)
    echo "usage: dev.sh [both|backend|frontend|ports]" >&2
    exit 2
    ;;
esac

# Job control so each child leads its own process group: `uv run uvicorn
# --reload` and `pnpm dev` both fork, and killing only the job we launched
# leaves grandchildren holding the ports.
set -m

pids=()
cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  done
  rm -f "$ports_file"
}
trap cleanup EXIT INT TERM

start_backend &
pids+=($!)
start_frontend &
pids+=($!)

wait -n
