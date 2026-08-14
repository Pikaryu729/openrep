/**
 * Single source of truth for the suite's ports and the frontend origin.
 *
 * Dedicated ports, deliberately NOT the dev-server defaults (5173 / 8765).
 * Sharing them meant `reuseExistingServer` would adopt whatever backend was
 * already listening — including a dev server opened against the real
 * ~/.openrep/openrep.db — and these specs create and delete rows. e2e must
 * only ever talk to a server it started itself, against the throwaway DB the
 * config points at. Env overrides exist for when the defaults are squatted by
 * another process (e.g. a second dev server that walked from 5173 to 5174).
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

export const FRONTEND_PORT = resolvePort(process.env.E2E_FRONTEND_PORT, 5174)
export const BACKEND_PORT = resolvePort(process.env.E2E_BACKEND_PORT, 8766)

export const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`
