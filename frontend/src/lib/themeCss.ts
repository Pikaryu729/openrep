/**
 * Imports a tweakcn (or plain shadcn) CSS theme block.
 *
 * The whole reason this file is not a two-line regex is the name collision:
 * tweakcn's `--primary` is OpenRep's `--accent` (our brand variable, and the
 * older name), while tweakcn's `--accent` is the subtle hover wash that we call
 * `--ui-accent`. Pasting a theme in raw would silently swap a brand color for a
 * hover tint, so the mapping below is the point of the module.
 */

import { parseColor } from './color'
import type { ThemeOverrides } from './theme'
import { EMPTY_OVERRIDES } from './theme'
import type { ColorMap, ColorTokenKey, GlobalTokens, ShadowTokens } from './themeTokens'

/** tweakcn/shadcn variable name → our color token key. */
const COLOR_ALIASES: Record<string, ColorTokenKey> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  'card-foreground': 'cardForeground',
  popover: 'popover',
  'popover-foreground': 'popoverForeground',
  // Their "primary" is our brand accent.
  primary: 'primary',
  'primary-foreground': 'primaryForeground',
  secondary: 'secondary',
  'secondary-foreground': 'secondaryForeground',
  muted: 'muted',
  'muted-foreground': 'mutedForeground',
  // Their "accent" is the hover wash, NOT our brand --accent.
  accent: 'uiAccent',
  'accent-foreground': 'uiAccentForeground',
  destructive: 'destructive',
  'destructive-foreground': 'destructiveForeground',
  border: 'border',
  input: 'input',
  ring: 'ring',
  'chart-1': 'chart1',
  'chart-2': 'chart2',
  'chart-3': 'chart3',
  'chart-4': 'chart4',
  'chart-5': 'chart5',
  sidebar: 'sidebar',
  'sidebar-background': 'sidebar',
  'sidebar-foreground': 'sidebarForeground',
  'sidebar-primary': 'sidebarPrimary',
  'sidebar-primary-foreground': 'sidebarPrimaryForeground',
  'sidebar-accent': 'sidebarAccent',
  'sidebar-accent-foreground': 'sidebarAccentForeground',
  'sidebar-border': 'sidebarBorder',
  'sidebar-ring': 'sidebarRing',
}

const GLOBAL_ALIASES: Record<string, keyof GlobalTokens> = {
  radius: 'radius',
  'font-sans': 'fontSans',
  'font-serif': 'fontSerif',
  'font-mono': 'fontMono',
  'letter-spacing': 'letterSpacing',
  'tracking-normal': 'letterSpacing',
  spacing: 'spacing',
}

const SHADOW_ALIASES: Record<string, keyof ShadowTokens> = {
  'shadow-color': 'color',
  'shadow-opacity': 'opacity',
  'shadow-blur': 'blur',
  'shadow-spread': 'spread',
  'shadow-offset-x': 'offsetX',
  'shadow-offset-y': 'offsetY',
}

export interface CssImportResult {
  overrides: ThemeOverrides
  /** Count of declarations we understood, per mode. */
  applied: { light: number; dark: number; global: number }
  /** Variable names present in the CSS that we had no home for. */
  ignored: string[]
  error: string | null
}

const EMPTY_RESULT: CssImportResult = {
  overrides: EMPTY_OVERRIDES,
  applied: { light: 0, dark: 0, global: 0 },
  ignored: [],
  error: null,
}

/** Which mode a selector's declarations belong to, or null to skip the block. */
function modeForSelector(selector: string): 'light' | 'dark' | null {
  const value = selector.toLowerCase()
  if (/(^|[\s,])(\.dark|\[data-theme=['"]?dark|:root\[data-mode=['"]?dark)/.test(value)) {
    return 'dark'
  }
  if (value.includes('dark')) return 'dark'
  if (value.includes(':root') || value.includes('html') || value.includes('body')) return 'light'
  return null
}

/**
 * Splits top-level `selector { ... }` blocks.
 *
 * Hand-rolled rather than regex because `@theme inline { ... }` and friends nest,
 * and a non-greedy `\{([^}]*)\}` silently truncates at the first inner brace.
 */
function topLevelBlocks(css: string): { selector: string; body: string }[] {
  const blocks: { selector: string; body: string }[] = []
  let depth = 0
  let selectorStart = 0
  let bodyStart = 0

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i]
    if (char === '{') {
      if (depth === 0) {
        blocks.push({ selector: css.slice(selectorStart, i).trim(), body: '' })
        bodyStart = i + 1
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        blocks[blocks.length - 1].body = css.slice(bodyStart, i)
        selectorStart = i + 1
      }
      if (depth < 0) return blocks // unbalanced; salvage what we have
    }
  }
  return blocks
}

function declarations(body: string): [string, string][] {
  const out: [string, string][] = []
  // Only top-level custom properties; a nested rule's body is skipped by depth.
  let depth = 0
  let buffer = ''
  const flush = () => {
    const text = buffer.trim()
    buffer = ''
    if (!text.startsWith('--')) return
    const colon = text.indexOf(':')
    if (colon === -1) return
    out.push([text.slice(2, colon).trim(), text.slice(colon + 1).trim()])
  }
  for (const char of body) {
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    else if (char === ';' && depth === 0) {
      flush()
      continue
    }
    if (depth === 0 && char !== '{' && char !== '}') buffer += char
  }
  flush()
  return out
}

/** Strips comments so a commented-out declaration is not imported. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

export function parseThemeCss(input: string): CssImportResult {
  const css = stripComments(input)
  if (!css.trim()) return { ...EMPTY_RESULT, error: 'Paste a CSS theme block first.' }

  const blocks = topLevelBlocks(css)
  if (blocks.length === 0) {
    return { ...EMPTY_RESULT, error: 'No CSS rules found — expected something like `:root { … }`.' }
  }

  const colors: Record<'light' | 'dark', Partial<ColorMap>> = { light: {}, dark: {} }
  const shadow: Record<'light' | 'dark', Partial<ShadowTokens>> = { light: {}, dark: {} }
  const global: Partial<GlobalTokens> = {}
  const applied = { light: 0, dark: 0, global: 0 }
  const ignored = new Set<string>()

  for (const block of blocks) {
    // `@theme` blocks map Tailwind names onto the vars we already read; importing
    // them would just re-import aliases of the same values.
    if (block.selector.startsWith('@theme') || block.selector.startsWith('@custom-variant')) {
      continue
    }
    const mode = modeForSelector(block.selector)
    if (!mode) continue

    for (const [name, rawValue] of declarations(block.body)) {
      const value = rawValue.replace(/\s*!important$/, '').trim()
      if (!value || value.startsWith('var(')) continue

      const colorKey = COLOR_ALIASES[name]
      if (colorKey) {
        const hex = parseColor(value)
        if (hex) {
          colors[mode][colorKey] = hex
          applied[mode] += 1
        } else {
          ignored.add(`--${name}`)
        }
        continue
      }

      const shadowKey = SHADOW_ALIASES[name]
      if (shadowKey) {
        const normalized = shadowKey === 'color' ? parseColor(value) : value
        if (normalized) {
          shadow[mode][shadowKey] = normalized
          applied[mode] += 1
        }
        continue
      }

      // Fonts, radius and spacing are not per-mode in OpenRep; light wins, and a
      // dark-only declaration still lands if light never mentioned it.
      const globalKey = GLOBAL_ALIASES[name]
      if (globalKey) {
        if (mode === 'light' || !(globalKey in global)) {
          if (!(globalKey in global)) applied.global += 1
          global[globalKey] = value
        }
        continue
      }

      if (!name.startsWith('shadow-')) ignored.add(`--${name}`)
    }
  }

  const total = applied.light + applied.dark + applied.global
  if (total === 0) {
    return {
      ...EMPTY_RESULT,
      ignored: [...ignored],
      error: 'No recognisable theme variables found in that CSS.',
    }
  }

  return {
    overrides: { colors, shadow, global },
    applied,
    ignored: [...ignored],
    error: null,
  }
}
