import { describe, expect, it } from 'vitest'

/**
 * Guards against routes the generator silently drops.
 *
 * `routeTree.gen.ts` is generated, gitignored, and carries `@ts-nocheck`, so a
 * route that never makes it into `rootRouteChildren` produces no type error and
 * no build failure — just a 404 at runtime. That happened for real: after
 * `exercises.tsx` was renamed to `exercises.index.tsx`, the generator kept
 * emitting `getParentRoute: () => ExercisesRoute` for a parent that no longer
 * existed and dropped `/exercises/$exerciseId` from the tree entirely. Deleting
 * routeTree.gen.ts and regenerating clears it; these assertions catch the next
 * occurrence instead of leaving it to a manual click-through.
 *
 * Uses Vite's glob rather than node:fs — the app tsconfig has no node types.
 */
const routeModules = import.meta.glob('./routes/*.tsx', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

const generatedModules = import.meta.glob('./routeTree.gen.ts', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

const GENERATED = Object.values(generatedModules)[0] ?? ''

function routeFiles(): string[] {
  return Object.keys(routeModules)
    .map((path) => path.replace('./routes/', ''))
    .filter((name) => !name.includes('.test.') && name !== '__root.tsx')
}

describe('generated route tree', () => {
  it('found the generated tree and the route files', () => {
    expect(GENERATED).not.toBe('')
    expect(routeFiles().length).toBeGreaterThan(0)
  })

  it('imports every route file', () => {
    for (const file of routeFiles()) {
      const module = file.replace(/\.tsx$/, '')
      expect(GENERATED, `${file} is missing from routeTree.gen.ts`).toContain(`./routes/${module}'`)
    }
  })

  it('never parents a route to a route that does not exist', () => {
    const parents = [...GENERATED.matchAll(/getParentRoute: \(\) => (\w+)/g)].map((m) => m[1])
    for (const parent of new Set(parents)) {
      if (parent === 'rootRouteImport') continue
      expect(GENERATED, `parent ${parent} is referenced but never defined`).toMatch(
        new RegExp(`const ${parent} = `),
      )
    }
  })

  it('registers every root-level route in the tree', () => {
    const children = GENERATED.match(/const rootRouteChildren[^}]+}/s)?.[0] ?? ''
    const rootParented = [
      ...GENERATED.matchAll(
        /const (\w+Route) = \w+\.update\(\{[^}]*?getParentRoute: \(\) => rootRouteImport/gs,
      ),
    ].map((m) => m[1])

    expect(rootParented.length).toBeGreaterThan(0)
    for (const route of rootParented) {
      expect(children, `${route} is defined but never added to the route tree`).toContain(route)
    }
  })
})
