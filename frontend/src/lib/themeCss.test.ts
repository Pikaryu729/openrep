import { describe, expect, it } from 'vitest'
import { parseThemeCss } from './themeCss'

/** Shaped like a real tweakcn export: oklch values, :root plus .dark. */
const TWEAKCN_EXPORT = `
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.55 0.22 264);
  --primary-foreground: oklch(0.985 0 0);
  --accent: oklch(0.97 0.01 264);
  --accent-foreground: oklch(0.205 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --radius: 0.5rem;
  --font-sans: Inter, sans-serif;
  --shadow-opacity: 0.12;
  --shadow-blur: 5px;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.72 0.19 264);
  --accent: oklch(0.269 0 0);
}
`

describe('parseThemeCss', () => {
  it('maps tweakcn primary onto our brand accent, not their accent', () => {
    const { overrides } = parseThemeCss(TWEAKCN_EXPORT)
    // This is the whole point of the module: --primary is our --accent...
    expect(overrides.colors.light.primary).toBeDefined()
    expect(overrides.colors.light.primary).not.toBe(overrides.colors.light.uiAccent)
    // ...and their --accent is our hover wash, which must NOT become the brand.
    expect(overrides.colors.light.uiAccent).toBeDefined()
  })

  it('converts oklch to hex', () => {
    const { overrides } = parseThemeCss(TWEAKCN_EXPORT)
    expect(overrides.colors.light.background).toBe('#ffffff')
    expect(overrides.colors.light.primary).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('splits :root and .dark into the two modes', () => {
    const { overrides, applied } = parseThemeCss(TWEAKCN_EXPORT)
    expect(overrides.colors.light.foreground).not.toBe(overrides.colors.dark.foreground)
    expect(applied.light).toBeGreaterThan(0)
    expect(applied.dark).toBeGreaterThan(0)
  })

  it('picks up globals and shadow tokens', () => {
    const { overrides } = parseThemeCss(TWEAKCN_EXPORT)
    expect(overrides.global.radius).toBe('0.5rem')
    expect(overrides.global.fontSans).toBe('Inter, sans-serif')
    expect(overrides.shadow.light.opacity).toBe('0.12')
    expect(overrides.shadow.light.blur).toBe('5px')
  })

  it('accepts hex and hsl as well as oklch', () => {
    const { overrides } = parseThemeCss(
      ':root { --background: #ff0000; --foreground: hsl(120 100% 50%); }',
    )
    expect(overrides.colors.light.background).toBe('#ff0000')
    expect(overrides.colors.light.foreground).toBe('#00ff00')
  })

  it('reports variables it had no home for', () => {
    const { ignored } = parseThemeCss(':root { --background: #fff; --mystery-token: 4px; }')
    expect(ignored).toContain('--mystery-token')
  })

  it('errors rather than silently importing nothing', () => {
    expect(parseThemeCss('').error).toBeTruthy()
    expect(parseThemeCss('.card { color: red }').error).toBeTruthy()
    expect(parseThemeCss(':root { --nope: 1px }').error).toBeTruthy()
  })

  // A non-greedy [^}]* would stop at the first inner brace and drop the rest.
  it('does not truncate on nested blocks', () => {
    const { overrides } = parseThemeCss(
      '@theme inline { --color-x: var(--y); } :root { --background: #123456; }',
    )
    expect(overrides.colors.light.background).toBe('#123456')
  })

  it('ignores commented-out declarations', () => {
    const { overrides } = parseThemeCss(':root { /* --background: #000000; */ --foreground: #fff }')
    expect(overrides.colors.light.background).toBeUndefined()
    expect(overrides.colors.light.foreground).toBe('#ffffff')
  })

  it('skips var() indirection it cannot resolve', () => {
    const { overrides } = parseThemeCss(':root { --background: var(--something); --card: #abcdef }')
    expect(overrides.colors.light.background).toBeUndefined()
    expect(overrides.colors.light.card).toBe('#abcdef')
  })
})
