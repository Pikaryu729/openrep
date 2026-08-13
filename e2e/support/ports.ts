import { createHash } from 'node:crypto'

/**
 * Single source of truth for the suite's ports and the frontend origin.
 *
 * Dedicated ports, deliberately NOT the dev-server defaults (5173 / 8765).
 * Sharing them meant `reuseExistingServer` would adopt whatever backend was
 * already listening — including a dev server opened against the real
 * ~/.openrep/openrep.db — and these specs create and delete rows. e2e must
 * only ever talk to a server it started itself, against the throwaway DB the
 * config points at.
 *
 * Derived from the checkout path rather than fixed, because two worktrees
 * running the suite at once would otherwise fight over one pair of ports —
 * and `reuseExistingServer: false` turns that into a hard failure, correctly,
 * rather than the far worse alternative of adopting the other run's backend.
 * Deterministic so a given worktree is reproducible; scripts/dev.sh keeps its
 * own range (20000–22000) clear of this one. Env overrides exist for when the
 * derived pair is squatted by some unrelated process.
 *
 * Both playwright.config.ts and any spec that writes its own `storageState`
 * must import from here: a localStorage origin derived independently (say,
 * from the raw env string while the config normalized it to a number) would
 * silently never match the page's origin.
 *
 * `Number(...) || fallback`, not `??`: a set-but-empty variable coerces to 0
 * (`--port 0 --strictPort` hangs the suite), garbage coerces to NaN, and an
 * explicit 0 is never a usable port — all three fall back instead.
 */
function resolvePort(raw: string | undefined, fallback: number): number {
  return Number(raw) || fallback
}

const slot = parseInt(createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8), 16) % 500

export const FRONTEND_PORT = resolvePort(process.env.E2E_FRONTEND_PORT, 23000 + slot * 2)
export const BACKEND_PORT = resolvePort(process.env.E2E_BACKEND_PORT, 23001 + slot * 2)

export const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`
