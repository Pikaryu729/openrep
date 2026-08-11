# OpenRep Roadmap

What stands between the current build and something we'd ask a stranger to
install. The app today is a solid CRUD tracker: exercises, workouts, sets,
theming, units, and JSON backup all work and are tested. But "works" and
"releasable" are different bars — this is the gap, ordered by priority.

## v0.1 — Release blockers ("Now")

These are the things a first-time user hits in the first ten minutes. Ship
nothing until all six are done.

### 1. A real install & run story
Today the app is `git clone` + `uv run uvicorn` + `pnpm dev` — that's a
developer setup, not a product. A local-first app lives or dies on this.
- One command / one artifact to run both server and UI (single FastAPI process
  serving the built frontend is the cheapest path; a packaged binary via
  PyInstaller or a Tauri wrapper is the nicer one).
- Decide the default port story and what "open the app" means (auto-open
  browser? menu-bar icon?).
- Versioned releases with a changelog, and `--version` reporting.

### 2. Surface the analytics we already built
The backend ships personal records, per-exercise history, and estimated 1RM
endpoints — **none of which have any UI**. Progress visualization is the whole
reason someone logs sets instead of using a notebook.
- Exercise detail view: history chart (weight + e1RM over time), PR badges.
- Dashboard: volume as a chart rather than a bare table, plus a "recent PRs"
  panel.
- This is our core value prop; the table-only dashboard undersells the product.

### 3. Starter exercise library
The app boots completely empty. Nobody wants to type "Bench Press" before
they can log their first set.
- Seed a curated library (~50 common barbell/dumbbell/bodyweight movements,
  categorized) on first run, via the existing import mechanism.
- Make it skippable and deletable — it's their database.

### 4. First-run onboarding & empty-state flow
Empty states exist per page, but there's no thread connecting them. A new user
should land on a guided path: create/seed exercises → log first workout → see
first chart. One-time dismissible, no accounts, no tour overlay theatrics.

### 5. Mobile usability pass
People log sets *in the gym, on a phone*. The shadcn sidebar collapses to a
sheet, but the workout detail page (our most-used screen) is a desktop table
with small touch targets.
- Audit every flow at 390px width; make add-set a thumb-friendly flow.
- Bigger touch targets for the reorder/edit/delete row actions.

### 6. Data-safety guarantees
Local-first means we are the user's only backup. Right now one bad migration
or an accidental "Replace" import loses everything silently.
- Automatic backup snapshot before every schema migration (server-side, cheap).
- Automatic rolling backups (e.g., daily, keep last 7) into `~/.openrep/backups/`.
- "Replace" import writes a safety export first, and says so.

## v0.2 — The retention release ("Next")

What makes week-two users stay, once strangers can install it.

- **Workout templates / "repeat last workout"** — most training is the same
  workout every week. One-tap "start from last Tuesday" removes 90% of logging
  friction. Full program support (5/3/1-style progressions) can wait; repeat +
  named templates cannot wait long.
- **Rest timer** — start on set save, notify at target. Table stakes in every
  competitor.
- **Richer set semantics** — bodyweight (weight optional), warmup vs working
  sets (warmups pollute PR/volume stats today), and failure/AMRAP marking.
- **PWA / offline** — installable icon on the phone home screen, and resilience
  to the backend being briefly unreachable. Pairs naturally with local-first.
- **CSV import from Strong / Hevy** — every serious user we want already has
  years of data in one of these. Import is the single biggest adoption lever.
- **Undo for destructive actions** — we confirm deletes, but confirmation is
  not recovery. A 10-second undo toast beats a modal.

## v0.3+ — "Later"

Worth doing, not worth blocking on.

- Programs with progression rules (percentages, week cycles).
- Plate calculator on the add-set form.
- Body-weight and measurement tracking alongside lifts.
- Exercise notes/history visible while logging ("what did I do last time?" —
  partially covered by prefill today).
- Tagging/filtering for workouts (push/pull/legs, meets, deloads).
- Keyboard-first quick-logging for the desk-treadmill crowd.

## Explicit non-goals

Declaring these keeps scope honest — revisit only with strong evidence:

- **Accounts, cloud sync, multi-device** — local-first is the identity. The
  answer to sync requests is a better backup/export story, not a server.
- **Social features** — no feeds, no sharing, no leaderboards.
- **AI coaching** — not before the data foundations above are excellent.

## Sequencing rationale

v0.1 is ordered around the first-session funnel: install (1) → have something
to log against (3, 4) → log from a phone (5) → see why it was worth it (2) →
trust us with the data (6). v0.2 is ordered by retention impact per unit of
effort, with templates first because logging friction is the #1 churn driver
in this category.
