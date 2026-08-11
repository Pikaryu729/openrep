#!/usr/bin/env bash
# Install a built wheel into a clean venv and prove the packaged app actually
# works: migrations run, the API answers, and the bundled UI is served.
#
# This is the check that catches a wheel whose static/ was dropped at build
# time — the single most likely packaging failure, and one that leaves every
# other test green.
set -euo pipefail

wheel="${1:?usage: smoke-wheel.sh path/to/openrep-x.y.z-py3-none-any.whl}"
port="${OPENREP_SMOKE_PORT:-8799}"
workdir="$(mktemp -d)"
venv="$workdir/venv"
data="$workdir/smoke.db"

cleanup() {
  [ -n "${server:-}" ] && kill "$server" 2>/dev/null || true
  rm -rf "$workdir"
}
trap cleanup EXIT

python3 -m venv "$venv"
"$venv/bin/pip" install --quiet "$wheel"

echo "==> openrep --version"
"$venv/bin/openrep" --version | grep -q '^openrep ' || { echo "FAIL: --version"; exit 1; }

echo "==> starting the packaged app on :$port"
OPENREP_DATABASE_PATH="$data" "$venv/bin/openrep" --no-browser --port "$port" \
  > "$workdir/server.log" 2>&1 &
server=$!

for _ in $(seq 1 80); do
  curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && break
  sleep 0.5
done

check() {
  local label="$1" url="$2" pattern="$3" body
  # GET, not `curl -I`: FastAPI's APIRoute does not auto-register HEAD.
  # Body is captured before matching so `grep -q` cannot SIGPIPE curl under
  # `set -o pipefail` and turn a passing check into a failure.
  body="$(curl -fsS "$url" || true)"
  if printf '%s' "$body" | grep -q "$pattern"; then
    echo "  ok   $label"
  else
    echo "  FAIL $label ($url)"; cat "$workdir/server.log"; exit 1
  fi
}

check "api health"       "http://127.0.0.1:$port/api/health"    '"status":"ok"'
check "api endpoint"     "http://127.0.0.1:$port/api/exercises" '^\[\]$'
check "bundled UI"       "http://127.0.0.1:$port/"              '<div id="root">'
check "SPA deep link"    "http://127.0.0.1:$port/workouts/42"   '<div id="root">'
check "static favicon"   "http://127.0.0.1:$port/favicon.svg"   '<svg'

# No -f here: a 404 is the expected result, and -f would make curl noisy on it.
status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/nope" || true)"
[ "$status" = "404" ] && echo "  ok   unknown /api path 404s" \
  || { echo "  FAIL unknown /api path returned $status"; exit 1; }

[ -f "$data" ] && echo "  ok   migrations created the database" \
  || { echo "  FAIL database was never created"; exit 1; }

echo "smoke: OK"
