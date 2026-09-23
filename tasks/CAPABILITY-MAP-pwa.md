# Capability Map: Mobile PWA

## Context

OpenRep is local-first: a FastAPI + SQLite backend runs on the user's own
machine (default `127.0.0.1:8765`, no auth), with the React UI served from
the same process. There is no cloud account and no multi-tenant sync.

For a phone to use OpenRep as an installed app, the backend must be reachable
from the phone. The only viable model that preserves the no-cloud, no-new-
infra philosophy is: **the backend runs on a machine on the user's home LAN,
bound off loopback** (already a documented, accepted tradeoff in the README
for same-network access — installing a PWA on a phone on that same network
doesn't add new exposure, just a new client). Away from that network (gym,
travel), the phone cannot reach the backend at all, so the app must work
**fully offline** and reconcile once the phone rejoins the home network.

iOS Safari does not implement the Service Worker Background Sync API, so
"sync on reconnect" must be implemented as foreground reconnect-and-flush
(triggered on app open and on the `online` event), not true OS-level
background sync — that only exists on Chrome/Android and would be a bonus
enhancement there, not the baseline mechanism either module can depend on.

## Module Map

| Module id | Responsibility | Depends on |
|---|---|---|
| `pwa-shell` | Installability: web app manifest, icons (incl. maskable + iOS splash), service worker registration, app-shell precaching (JS/CSS/fonts, not API data), install UX (`beforeinstallprompt` on Android/Chrome, "Add to Home Screen" guidance on iOS), update-available-reload prompt | — |
| `offline-data` | Using the app with no route to the backend: cached reads of recent data (workouts, exercises, dashboard) so the UI isn't blank; a local write queue (IndexedDB) for logging sets/workouts while offline; foreground reconnect-and-flush sync; backend idempotency support so a retried queued write can't double-create a row; reconciling client-generated ids (offline-created workout/exercise/set) against server ids once synced | `pwa-shell` (reuses its service worker for the `online`/registration lifecycle; the write queue and IndexedDB layer are independent of precaching) |

Build order: `pwa-shell` → `offline-data`

## Explicitly out of scope (for both modules, unless revisited later)

- Push notifications — no push server in this architecture, and it doesn't
  fit "nothing leaves your machine."
- True OS-level Background Sync API — Android/Chrome only; not a dependency
  of the baseline design in either module.
- Multi-device conflict resolution beyond "last write wins on sync" — this
  is a single-user app; concurrent edits from two devices to the *same*
  unsynced record are an accepted edge case, not a CRDT/merge system.
- Changing the default bind address or adding auth — out of scope for the
  PWA modules; the LAN-exposure tradeoff is pre-existing and documented.

## Notes for module specs

- `pwa-shell` is low-risk, frontend-only, no backend changes.
- `offline-data` is the larger, higher-risk module: it touches the backend
  write contract (idempotency keys on `SetEntry`/`Workout`/`Exercise`
  create endpoints) as well as the frontend (queue, IndexedDB schema, sync
  state UI). Expect its own spec to be substantially longer.
