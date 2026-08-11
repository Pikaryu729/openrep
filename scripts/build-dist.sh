#!/usr/bin/env bash
# Build the frontend, stage it into the Python package, and produce sdist + wheel.
#
# Deliberately a plain script rather than a hatchling build hook: a hook that
# shells out to pnpm would fail for anyone doing `pip install openrep` from the
# sdist, since they will not have Node.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

echo "==> Building the frontend"
pnpm install --frozen-lockfile
pnpm --dir frontend build          # prebuild runs `tsr generate` for routeTree.gen.ts

echo "==> Staging frontend/dist -> backend/openrep/static"
rm -rf backend/openrep/static
mkdir -p backend/openrep/static
cp -R frontend/dist/. backend/openrep/static/

echo "==> Building sdist + wheel"
rm -rf backend/dist
(cd backend && uv build)

echo "==> Verifying artifacts"
wheel="$(echo backend/dist/openrep-*.whl)"
sdist="$(echo backend/dist/openrep-*.tar.gz)"

# Listings are captured up front rather than piped into `grep -q`: under
# `set -o pipefail`, grep -q exits on the first match, the producer takes
# SIGPIPE, and the pipeline reports failure on a listing that was actually fine.
wheel_files="$(unzip -l "$wheel")"
sdist_files="$(tar tzf "$sdist")"

# Not decoration: hatchling's file selection is VCS-aware, so the generated
# (gitignored) static/ silently vanishes without the `artifacts` entries in
# pyproject.toml. The app would still install and boot — API-only.
for required in \
    openrep/static/index.html \
    openrep/static/assets/ \
    openrep/migrations/env.py \
    openrep/migrations/script.py.mako \
    openrep/migrations/versions/ ; do
  case "$wheel_files" in
    *"$required"*) ;;
    *) echo "FAIL: $required missing from the wheel"; exit 1 ;;
  esac
  case "$sdist_files" in
    *"$required"*) ;;
    *) echo "FAIL: $required missing from the sdist"; exit 1 ;;
  esac
done

echo "OK:"
ls -1 backend/dist
