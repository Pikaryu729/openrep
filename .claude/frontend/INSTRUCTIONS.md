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

### Known deliberate exception

The exercise picker uses a styled **native `<select>`** (see
`selectClassName` in `routes/workouts.$workoutId.tsx`), not the Radix-based
shadcn Select: it's driven by Playwright's `selectOption` and plain `fireEvent`
in tests, which Radix Select doesn't support well in jsdom. Keep that trade-off
unless the tests move to a driver that handles Radix Select.

## Theming contract

Theme tokens live in `src/index.css` (Tailwind v4, no config file):

- `data-mode="light|dark"` on `<html>` selects the neutral scale;
  `data-theme="<preset>"` selects the accent pair; a user-picked custom accent
  is an inline `--accent` override set by `src/lib/theme.ts` and the boot
  script in `index.html`. Keep those three axes orthogonal.
- **`--accent` / `--accent-contrast` are OUR brand variables** (persisted in
  localStorage under `openrep.theme`); they feed shadcn's `--color-primary`.
  shadcn's own "accent" token (subtle hover washes) is mapped to the neutral
  `--muted` — never map it to `--accent`, and never rename `--accent`, or
  persisted user themes and the FOUC boot script break.
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
  block — we have no `.dark` class. (The sidebar tokens are already integrated
  this way: `--sidebar-primary` follows `--accent`, neutrals per mode.)

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
