# OpenRep Roadmap

_Last reviewed: 2026-08-24._

What stands between the current build and something we'd ask a stranger to
install. The app today is a solid CRUD tracker: exercises, workouts, sets,
theming, units, and JSON backup all work and are tested. But "works" and
"releasable" are different bars — this is the gap, ordered by priority.

## v0.1 — Release blockers ("Now")

These are the things a first-time user hits in the first ten minutes. Four of
the original six are now shipped; mobile usability is the active next item.

### Shipped

1. ✅ **A real install & run story.** `uv tool install openrep` (or `pipx`)
   installs a single process that serves the API and the built frontend;
   `openrep --version` and `/api/health` report version; `CHANGELOG.md` has a
   released `[0.1.0]` entry. (Auto-opening a browser / menu-bar icon was
   called out as a "nicer, not required" stretch and remains undone, but
   doesn't block release.)
2. ✅ **Surface the analytics we already built.** `exercises.$exerciseId.tsx`
   shows PR stat tiles (heaviest set, best e1RM, best session volume) and an
   `ExerciseProgressChart`; the dashboard has `volume_chart`,
   `personal_records`, `exercise_progress`, `category_breakdown`, and
   `recent_workouts` widgets, with volume + PRs in the default layout.
3. ✅ **Starter exercise library.** `frontend/src/lib/starterExercises.ts`
   seeds ~44 curated movements through the onboarding wizard; replay-safe,
   skippable, and deletable like any other exercise.
4. ✅ **First-run onboarding & empty-state flow.** `OnboardingWizard`
   (welcome → units → appearance → exercises → finish) is gated on a genuinely
   empty database and funnels into "log your first workout" or "explore the
   dashboard." Known edge cases (flash, race, quota-full) were already fixed
   in review.

### Active next item

### 5. Mobile usability pass — **active**
The first mobile-first pass is shipped for workout logging and the exercise
list. `useIsMobile()` swaps the workout and exercise desktop tables for stacked
cards below the shared 768px breakpoint; mutation handlers stay shared between
those render branches. Numeric weight/reps/RPE inputs carry decimal or numeric
`inputMode` hints, row actions use the existing icon-sized targets, add forms
reflow below `md`, and `SettingsRow` wraps long copy. The mobile shell also uses
a fixed bottom nav and adds back links to both detail-page success paths.

The broader audit remains active:
- Audit every flow at 390px width and make each logging flow thumb-friendly.
- Check touch targets and numeric keypad hints across any remaining flows.

### Remaining

### 6. Data-safety guarantees — partially done
Local-first means we are the user's only backup. The manual side exists —
Settings → Backup has real export/import with merge/replace modes behind a
`ConfirmDialog` — but the automatic safety nets the roadmap called for are
still missing:
- No backup snapshot before `alembic upgrade head` runs (`core/migrate.py`).
- No automatic rolling backups (e.g., daily, keep last 7) into
  `~/.openrep/backups/`.
- "Replace" import still deletes immediately with no auto-export safety copy
  first — the confirm dialog warns, but doesn't write a recovery file.

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
trust us with the data (6). Items 1–4 and the first mobile logging pass are
shipped, so (5) remains the active next item until the broader phone audit is
complete. Mobile logging is the highest-frequency interaction in the app,
while (6)'s tail-risk data-loss scenarios already have a manual (if
unprompted) safety net via export. v0.2 is ordered by retention impact per
unit of effort, with templates first because logging friction is the #1 churn
driver in this category.
