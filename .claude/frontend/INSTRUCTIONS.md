# Frontend instructions

## Component library: shadcn/ui first

**shadcn/ui is the default component library.** Our app components are built on
top of it — always reach for a shadcn component before writing a bespoke one or
adding another UI dependency.

- Generated primitives live in `frontend/src/components/ui/` (button, card,
  dialog, input, label, table so far). They are vendored source, not a package:
  editing them is allowed and expected when the design calls for it.
- Add new primitives with the CLI from `frontend/`:
  `pnpm dlx shadcn@latest add <component>` (config in `frontend/components.json`,
  new-york style). Check the file lands in `src/components/ui/` — if the CLI
  can't resolve the `@/` alias it writes a literal `@/` folder; move the files
  and delete it.
- The app shell is the shadcn **Sidebar** (`src/components/AppSidebar.tsx` +
  `SidebarProvider`/`SidebarInset` in `routes/__root.tsx`). Nav changes go in
  `AppSidebar`'s `NAV_ITEMS`; the "Recent workouts" group is a `Collapsible`
  fed by the shared `['workouts']` query.
- App-level components in `frontend/src/components/` (`Modal`, `ConfirmDialog`,
  `EmptyState`) wrap the shadcn primitives with our conventions. Route through
  them for common cases (all destructive actions go through `ConfirmDialog`)
  instead of using raw `Dialog` pieces in routes.
- Style with Tailwind utility classes and the `cn()` helper from
  `src/lib/utils.ts`. Do not reintroduce bespoke CSS classes for things a
  shadcn component or a utility class covers.
- Imports use the `@/` alias (e.g. `@/components/ui/button`), configured in
  `vite.config.ts` and both tsconfigs.

## Brand assets

- `assets/` at the repo root is the brand **source of truth** (logo masters,
  social card, 1024px icons) — it is not served by the app. The servable
  subset (favicons, apple-touch-icon) is copied into `frontend/public/`; if
  the masters change, re-copy them.
- In components, don't `<img>` the logo SVGs — use `LogoSymbol` /
  `LogoWordmark` from `@/components/Logo.tsx`, which inline the mono symbol so
  the bar follows `currentColor` and the center plate follows the user's
  `--accent`.

## Dashboard widgets

The dashboard is user-composable. To add a widget type:

1. Add a member to the `WidgetInstance` union in `src/lib/dashboard.ts`, with
   its options interface and a `WIDGET_CATALOG` entry (label, description,
   `defaultOptions`, and a `normalizeOptions` that validates **per field** the
   way `loadTheme` does — an unknown value falls back, it does not throw).
2. Satisfy the two exhaustive switches: `WidgetView.tsx` (render) and
   `WidgetOptionsForm.tsx` (configure). The union is discriminated, so the
   compiler names both for you.

Widgets never use `?? []` on query data — see `WidgetState`. An empty array is
indistinguishable from a pending or failed fetch, and rendering "no data" for a
network blip reads as data loss. If a widget stores an `exercise_id`, it must
also resolve it against the `['exercises']` list: the history endpoint answers
a deleted exercise with `[]`, not a 404.

### User-created widgets

`custom` is the one widget type whose definition is not in the catalog: its
options are just `{ widget_id }`, and the query, visualization and title belong
to a row in `custom_widget` (see CLAUDE.md). Consequences:

- The Add-widget dialog lists saved widgets individually and never offers the
  bare `custom` type — see `BUILT_IN_TYPES` in `routes/index.tsx`.
- `WidgetEditor.tsx` renders itself from `GET /api/widgets/fields`. Do not
  hardcode fields, operators or aggregates in the client; add them to
  `backend/openrep/schemas/widget_query.py` and they appear here.
- `lib/widgetQuery.ts` is the client half: blanks the editor starts from, the
  human phrasing of a query, and how a result row becomes a chart or a table.
  The server stays the authority on what is *legal* and re-validates everything;
  `queryProblems()` exists only so the editor can disable Save and say why.
- A custom placement resolves its `widget_id` against the `['widgets']` list for
  the same reason a pinned exercise does: a deleted widget must read as deleted,
  not as an empty chart.

### Known deliberate exception

The exercise picker uses a styled **native `<select>`** (see
`selectClassName` in `routes/workouts.$workoutId.tsx`), not the Radix-based
shadcn Select: it's driven by Playwright's `selectOption` and plain `fireEvent`
in tests, which Radix Select doesn't support well in jsdom. Keep that trade-off
unless the tests move to a driver that handles Radix Select.

## Theming contract

The theme is fully user-customizable from Settings (a tweakcn-style editor).
Base tokens live in `src/index.css` (Tailwind v4, no config file); everything
above them is data.

- **One table drives the whole system**: `COLOR_TOKENS` in
  `src/lib/themeTokens.ts`. The editor renders from it, `applyTheme` writes CSS
  variables from it, and the CSS importer maps onto it. Add a token there and
  all three follow — there is deliberately no exhaustive switch.
- **Resolution is base → preset → user override**, collapsed by
  `resolveColors()`. Presets (`src/lib/themePresets.ts`) are *sparse patches*,
  not full palettes, and `data-theme` is now informational only — a preset can
  patch forty-odd tokens across two modes, which is too much for a CSS block.
  Tokens listed in `DERIVED_FROM` (ring, sidebar highlight, hover wash) follow
  their source unless preset or user names them explicitly; that is what lets an
  accent-only preset still move the focus rings.
- **`--accent` / `--accent-contrast` are OUR brand variables** (persisted in
  localStorage under `openrep.theme`); they feed shadcn's `--color-primary`.
  shadcn's own "accent" (subtle hover washes) is `--ui-accent`, which defaults
  to the neutral `--muted` — never map it to `--accent`, and never rename
  `--accent`, or persisted user themes and the FOUC boot script break. This is
  also the one real trap when importing a theme: **tweakcn's `--primary` is our
  `--accent`, and tweakcn's `--accent` is our `--ui-accent`**. `themeCss.ts`
  exists to do that translation.
- **`saveTheme()` precomputes the full CSS-variable map for both modes** into
  the persisted `vars` field, so `index.html`'s boot script does zero theme
  math. Anything cleverer in that script would be a second implementation of
  `resolveColors()` free to drift from the first. Bump `THEME_SCHEMA_VERSION`
  and extend the v1 migration if the persisted shape changes.
- **`--chart-1..5` are series identity, not derived from `--accent`.** They are
  the categorical colors for charts plotting more than one thing (only custom
  widgets, so far). `--accent` is any hue the user typed into settings, so
  series identity cannot depend on it. Single-series charts still use
  `--accent`; assignment is by slot order and never cycles, so a sixth series
  needs a new slot rather than a generated hue.
- **They are editable but audited, not locked.** `src/lib/themeAudit.ts` re-runs
  the WCAG contrast and dichromat-simulation checks live and *warns*; it never
  refuses. Its ΔE thresholds are calibrated against what Okabe-Ito actually
  achieves (~0.14 normal, ~0.069 simulated) — set them higher and a known-good
  palette fails. Every shipped preset is asserted warning-free in
  `themeAudit.test.ts`, so a new preset must pass it too.
- **The series defaults are per-mode**, unlike every earlier version of this
  file: one palette cannot clear 3:1 against both a near-white and a near-black
  surface, and presets move those surfaces further still. They are Okabe-Ito
  shifted -0.12 (light) and +0.10 (dark) in OKLCH lightness — a uniform shift,
  which preserves the per-series lightness differences that survive dichromat
  simulation at all.
- Tailwind's `dark:` variant is bound to `[data-mode='dark']` via
  `@custom-variant`, not to `prefers-color-scheme`.
- The API client calls **same-origin `/api`** by default (`src/lib/api.ts`);
  `pnpm dev` proxies `/api` to the backend, and the packaged app serves both
  from one process. `VITE_API_BASE_URL` is an override only, and must include
  the `/api` suffix. Note `frontend/.env` is gitignored — a stale value there
  silently overrides the default.
- Units preference (`openrep.units` in localStorage, `src/lib/units.ts`):
  weights are ALWAYS stored and sent to the API in kilograms; convert only at
  the display/input boundary via `kgToDisplay`/`displayToKg`/`useUnits`.
- When `shadcn add` injects new token blocks into `index.css`, fold them into
  our `:root[data-mode=...]` blocks and delete any generated `.dark { ... }`
  block — we have no `.dark` class. If the new token should be user-editable,
  add it to `COLOR_TOKENS` and to `BASE_LIGHT`/`BASE_DARK` as well; those base
  maps must stay in sync with the CSS, since the editor reads them to show a
  token's starting value.

## Testing conventions

- Component tests colocate with routes (`*.test.tsx`, excluded from routing),
  mock `@/lib/api` per-method with `vi.mock` + `importOriginal` (keep the real
  `ApiError`), and render pages via their named export with a fresh
  QueryClient. `fireEvent` only — `userEvent` is not installed.
- Radix dialogs portal to `document.body` and take their accessible name from
  `DialogTitle`; query with `getByRole('dialog', { name: ... })` and scope
  button clicks with `within(...)` (row and dialog often share button names).
  Escape-key tests must fire on `document.body`, not `window`.
- e2e specs run against a persistent throwaway DB (`e2e/.tmp/e2e.db`): use
  unique `Date.now()`-suffixed names and exact matchers so pre-existing rows
  never collide.
