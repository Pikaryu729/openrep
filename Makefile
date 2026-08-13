.PHONY: help install backend-install frontend-install lint format \
        type-check test backend-test frontend-test e2e-test \
        dev dev-backend dev-frontend build build-dist smoke-test \
        clean clean-backend clean-frontend clean-all

# Default target
help:
	@echo "OpenRep Development Environment"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install              Install all dependencies (backend + frontend)"
	@echo "  make backend-install      Install backend dependencies (uv sync)"
	@echo "  make frontend-install     Install frontend dependencies (pnpm install)"
	@echo ""
	@echo "Development:"
	@echo "  make dev-backend          Start backend dev server on :8765"
	@echo "  make dev-frontend         Start frontend dev server on :5173"
	@echo "  make dev                  Show instructions for running both servers"
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

backend-install:
	@echo "→ Installing backend dependencies..."
	cd backend && uv sync
	@echo "✓ Backend dependencies installed"

frontend-install:
	@echo "→ Installing frontend dependencies..."
	pnpm install
	@echo "✓ Frontend dependencies installed"

## Development Servers

dev:
	@echo "To start development servers, run in separate terminals:"
	@echo ""
	@echo "  Terminal 1 (Backend on :8765):"
	@echo "    $$ make dev-backend"
	@echo ""
	@echo "  Terminal 2 (Frontend on :5173):"
	@echo "    $$ make dev-frontend"
	@echo ""
	@echo "Or use your IDE's run configurations for parallel execution."

dev-backend: backend-install
	@echo "→ Starting backend dev server..."
	cd backend && uv run uvicorn openrep.main:app --reload --port 8765

dev-frontend: frontend-install
	@echo "→ Starting frontend dev server..."
	cd frontend && pnpm dev

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
