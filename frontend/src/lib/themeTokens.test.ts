import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BASE_DARK,
  BASE_LIGHT,
  COLOR_TOKENS,
  COLOR_TOKEN_KEYS,
  DERIVED_FROM,
  type ColorTokenKey,
} from './themeTokens'

/**
 * index.css and the BASE_* maps describe the same thing in two languages: the
 * CSS is what an unstyled first paint uses, the maps are what the editor shows
 * you as a token's starting value. Nothing at runtime forces them to agree, so
 * this test does.
 */
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/**
 * Reads declarations out of one `:root[data-mode='<mode>'] { … }` block, keyed
 * by our own CSS variable names.
 *
 * Deliberately not parseThemeCss: that importer speaks tweakcn's vocabulary,
 * where `--accent` is the hover wash. Pointed at our own stylesheet it would
 * file our brand accent under uiAccent and quietly pass.
 */
function declaredColors(mode: 'light' | 'dark'): Partial<Record<ColorTokenKey, string>> {
  const block = new RegExp(`:root\\[data-mode='${mode}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)
  if (!block) throw new Error(`no :root[data-mode='${mode}'] block in index.css`)
  const out: Partial<Record<ColorTokenKey, string>> = {}
  for (const token of COLOR_TOKENS) {
    const declaration = new RegExp(`${token.cssVar}:\\s*([^;]+);`).exec(block[1])
    if (declaration) out[token.key] = declaration[1].trim()
  }
  return out
}

describe('index.css and the base token maps agree', () => {
  it.each([
    ['light', BASE_LIGHT] as const,
    ['dark', BASE_DARK] as const,
  ])('%s mode matches', (mode, expected) => {
    const fromCss = declaredColors(mode)
    const declared = Object.keys(fromCss) as ColorTokenKey[]
    expect(declared.length).toBeGreaterThan(20)
    for (const key of declared) {
      expect({ key, value: fromCss[key] }).toEqual({ key, value: expected[key] })
    }
  })

  it('declares every token in both mode blocks', () => {
    for (const mode of ['light', 'dark'] as const) {
      const declared = new Set(Object.keys(declaredColors(mode)))
      const missing = COLOR_TOKEN_KEYS.filter((key) => !declared.has(key))
      expect({ mode, missing }).toEqual({ mode, missing: [] })
    }
  })

  it('never points the hover wash at the brand accent in CSS', () => {
    expect(declaredColors('light').uiAccent).not.toBe(declaredColors('light').primary)
    expect(DERIVED_FROM.uiAccent).toBe('muted')
  })
})

describe('token catalog', () => {
  it('has no duplicate keys or CSS variables', () => {
    expect(new Set(COLOR_TOKENS.map((t) => t.key)).size).toBe(COLOR_TOKENS.length)
    expect(new Set(COLOR_TOKENS.map((t) => t.cssVar)).size).toBe(COLOR_TOKENS.length)
  })

  it('gives every token a value in both base maps', () => {
    for (const key of COLOR_TOKEN_KEYS) {
      expect(BASE_LIGHT[key]).toMatch(/^#[0-9a-f]{6}$/)
      expect(BASE_DARK[key]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  // The rule the whole theming contract hangs on.
  it('keeps the brand accent and shadcn’s hover wash on separate variables', () => {
    const byKey = Object.fromEntries(COLOR_TOKENS.map((t) => [t.key, t.cssVar]))
    expect(byKey.primary).toBe('--accent')
    expect(byKey.uiAccent).toBe('--ui-accent')
    expect(DERIVED_FROM.uiAccent).toBe('muted')
  })
})
