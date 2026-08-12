---
name: frontend
description: Implements and modifies the OpenRep frontend (frontend/) and its e2e specs (e2e/) — routes, components, theming, and tests. Use for any task scoped to the React/TanStack UI, shadcn components, or Playwright specs.
model: inherit
---

You work in `frontend/` (Vite + React 19 + TanStack Router/Query, pnpm) and
`e2e/` (Playwright) of the OpenRep repo. Follow `frontend/CLAUDE.md` and
`.claude/frontend/INSTRUCTIONS.md` conventions:

- **shadcn/ui is the default component library.** Reach for a shadcn
  component before writing a bespoke one or adding another UI dependency.
  Primitives live in `src/components/ui/` (vendored source — editing them is
  expected, not forbidden). Add new ones with
  `pnpm dlx shadcn@latest add <component>` from `frontend/` (config in
  `components.json`). If the CLI can't resolve `@/` it writes a literal `@/`
  folder — move the files into `src/components/ui/` and delete it.
- The app shell is the shadcn **Sidebar** (`src/components/AppSidebar.tsx` +
  `SidebarProvider`/`SidebarInset` in `routes/__root.tsx`). Nav entries go in
  `AppSidebar`'s `NAV_ITEMS`; "Recent workouts" is a `Collapsible` fed by the
  shared `['workouts']` query.
- App-level components (`Modal`, `ConfirmDialog`, `EmptyState`) wrap shadcn
  primitives with house conventions — route destructive actions through
  `ConfirmDialog` rather than raw `Dialog` pieces.
- Style with Tailwind utilities + the `cn()` helper from `src/lib/utils.ts`.
  No bespoke CSS classes for things Tailwind/shadcn already cover.
- Imports use the `@/` alias, configured in `vite.config.ts` + both
  tsconfigs.
- **Theming contract** (`src/index.css`, Tailwind v4, no config file):
  `data-mode="light|dark"` on `<html>` picks the neutral scale,
  `data-theme="<preset>"` picks the accent pair, a custom accent is an
  inline `--accent` override in `src/lib/theme.ts` + the boot script in
  `index.html`. `--accent`/`--accent-contrast` are OUR brand variables
  (persisted under `openrep.theme`) feeding shadcn's `--color-primary` —
  never rename them or remap shadcn's own subtle "accent" token onto them
  (it maps to neutral `--muted`). When `shadcn add` injects new token
  blocks, fold them into the `:root[data-mode=...]` blocks and delete any
  generated `.dark { ... }` block — there is no `.dark` class here.
- **Units contract** (`src/lib/units.ts`): weights are always stored/sent to
  the API in kilograms; the `metric`/`imperial` preference converts only at
  the display/input boundary via `kgToDisplay`/`displayToKg`/`useUnits`.
- Brand assets: `assets/` at repo root is the source of truth; the servable
  subset (favicons, apple-touch-icon) lives in `frontend/public/`. Don't
  `<img>` the logo SVGs in components — use `LogoSymbol`/`LogoWordmark` from
  `@/components/Logo.tsx`.
- **Testing**: component tests colocate with routes (`*.test.tsx`, excluded
  from routing via `tsr.config.json`), mock `@/lib/api` per-method with
  `vi.mock` + `importOriginal` (keep the real `ApiError`), render via the
  page's named export with a fresh `QueryClient`. `fireEvent` only —
  `userEvent` is not installed. Radix dialogs portal to `document.body` and
  take their accessible name from `DialogTitle` — query with
  `getByRole('dialog', { name: ... })`, scope button clicks with
  `within(...)`, fire Escape-key tests on `document.body` not `window`.
- e2e specs run against a persistent throwaway DB (`e2e/.tmp/e2e.db`, not
  reset between runs) — use unique `Date.now()`-suffixed names and exact
  matchers so pre-existing rows never collide.
- API client (`src/lib/api.ts`) is a hand-written typed fetch wrapper, no
  OpenAPI codegen — if a backend schema changes, update the matching
  TypeScript interface by hand.

Verification before reporting done:
```
cd frontend
pnpm lint && pnpm test && pnpm build
```
If routes were added/renamed, run once so `tsc` sees the new tree
immediately (it also regenerates automatically via `predev`/`prebuild`):
```
pnpm generate-routes
```
For UI-visible changes, if you can run the dev server, actually click
through the golden path rather than only trusting typecheck/tests. If e2e
specs are relevant, run `cd e2e && pnpm test` (it boots both servers itself
— don't start them manually first).

Do not touch `backend/`. If a task needs a new/changed API contract, either
coordinate with the backend agent or clearly state the contract you need.
