.PHONY: help install worktree-init backend-install frontend-install lint format \
        type-check test backend-test frontend-test e2e-test \
        dev dev-backend dev-frontend dev-ports build build-dist smoke-test \
        clean clean-backend clean-frontend clean-all

# Default target
help:
	@echo "OpenRep Development Environment"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make worktree-init        Set up a fresh git worktree (deps + scratch database)"
	@echo "  make install              Install all dependencies (backend + frontend)"
	@echo "  make backend-install      Install backend dependencies (uv sync)"
	@echo "  make frontend-install     Install frontend dependencies (pnpm install)"
	@echo ""
	@echo "Development:"
	@echo "  make dev                  Start both dev servers on this worktree's ports"
	@echo "  make dev-backend          Start only the backend"
	@echo "  make dev-frontend         Start only the frontend"
	@echo "  make dev-ports            Print this worktree's ports and database"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint                 Run all linters (ruff + oxlint)"
	@echo "  make format               Auto-format code (ruff + apply)"
	@echo "  make type-check           Run TypeScript type checking"
	@echo ""
	@echo "Testing:"
	@echo "  make test                 Run all test suites"
	@echo "  make backend-test         Run backend tests (pytest)"
	@echo "  make frontend-test        Run frontend tests (vitest)"
	@echo "  make e2e-test             Run e2e tests (playwright)"
	@echo ""
	@echo "Building:"
	@echo "  make build-dist           Build frontend, stage it, and create wheel/sdist"
	@echo "  make smoke-test           Verify a built wheel works"
	@echo "  make build                Alias for build-dist"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean                Remove build artifacts and dependencies"
	@echo "  make clean-backend        Clean backend build artifacts"
	@echo "  make clean-frontend       Clean frontend build artifacts"
	@echo "  make clean-all            Full clean (backend, frontend, node_modules)"

## Setup & Installation

install: backend-install frontend-install
	@echo "✓ All dependencies installed"

# Use this instead of `install` in a fresh git worktree: it also points the
# worktree at its own scratch database, so a branch carrying a new migration
# cannot upgrade ~/.openrep/openrep.db out from under every other checkout.
worktree-init:
	./scripts/worktree-init.sh

backend-install:
	@echo "→ Installing backend dependencies..."
	cd backend && uv sync
	@echo "✓ Backend dependencies installed"

frontend-install:
	@echo "→ Installing frontend dependencies..."
	pnpm install
	@echo "✓ Frontend dependencies installed"

## Development Servers

# scripts/dev.sh owns port and database selection for all three of these, so
# that two worktrees can run side by side. Ports are derived from the worktree
# path (stable across restarts) and reported in .dev/ports.env; a linked
# worktree also gets its own database. Splitting backend and frontend across two
# terminals still works — the second one adopts the ports the first wrote.
dev:
	./scripts/dev.sh

dev-backend: backend-install
	./scripts/dev.sh backend

dev-frontend: frontend-install
	./scripts/dev.sh frontend

dev-ports:
	@./scripts/dev.sh ports

## Code Quality

lint:
	@echo "→ Running backend linter (ruff)..."
	cd backend && uv run ruff check .
	@echo "✓ Backend linting passed"
	@echo ""
	@echo "→ Running frontend linter (oxlint)..."
	cd frontend && pnpm lint
	@echo "✓ Frontend linting passed"

format:
	@echo "→ Formatting backend code (ruff)..."
	cd backend && uv run ruff check . --fix && uv run ruff format .
	@echo "✓ Backend code formatted"
	@echo ""
	@echo "→ Formatting frontend code (oxlint)..."
	cd frontend && pnpm lint --fix
	@echo "✓ Frontend code formatted"

type-check:
	@echo "→ Type checking frontend (tsc)..."
	cd frontend && pnpm exec tsc -b
	@echo "✓ Frontend type checking passed"

## Testing

test: backend-test frontend-test e2e-test
	@echo "✓ All tests passed"

backend-test: backend-install
	@echo "→ Running backend tests (pytest)..."
	cd backend && uv run pytest
	@echo "✓ Backend tests passed"

frontend-test: frontend-install
	@echo "→ Running frontend tests (vitest)..."
	cd frontend && pnpm test
	@echo "✓ Frontend tests passed"

e2e-test: frontend-install
	@echo "→ Running e2e tests (playwright)..."
	@echo "   Note: This boots both dev servers automatically"
	pnpm --dir e2e test
	@echo "✓ E2E tests passed"

## Building

build-dist: frontend-install
	@echo "→ Building frontend and packaging wheel/sdist..."
	./scripts/build-dist.sh
	@echo "✓ Build complete: backend/dist/"

build: build-dist

smoke-test: build-dist
	@echo "→ Smoke testing the built wheel..."
	wheel=$$(ls -1 backend/dist/openrep-*.whl | head -1); \
	if [ -z "$$wheel" ]; then \
	  echo "ERROR: No wheel found in backend/dist/"; \
	  exit 1; \
	fi; \
	./scripts/smoke-wheel.sh "$$wheel"
	@echo "✓ Smoke test passed"

## Cleanup

clean: clean-backend clean-frontend
	@echo "✓ Cleaned build artifacts"

clean-backend:
	@echo "→ Cleaning backend artifacts..."
	cd backend && rm -rf dist build .pytest_cache __pycache__ .ruff_cache
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Backend cleaned"

clean-frontend:
	@echo "→ Cleaning frontend artifacts..."
	cd frontend && rm -rf dist .vite build coverage
	cd e2e && rm -rf test-results
	@echo "✓ Frontend cleaned"

clean-all: clean-backend clean-frontend
	@echo "→ Removing node_modules..."
	rm -rf node_modules
	rm -rf frontend/node_modules
	rm -rf e2e/node_modules
	@echo "✓ Complete clean done"
