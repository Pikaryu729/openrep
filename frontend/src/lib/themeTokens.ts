/**
 * The theme token catalog.
 *
 * One table drives everything: the settings editor renders from it, applyTheme
 * writes CSS variables from it, and the tweakcn CSS importer maps onto it. Add a
 * token here and all three follow — there is deliberately no exhaustive switch
 * to keep in sync.
 *
 * Naming note, because it is the one genuine trap in this file: OpenRep's
 * `--accent` is the *brand* color and feeds shadcn's `--color-primary`. It is
 * therefore the `primary` token here. shadcn's own "accent" (subtle hover
 * washes) is the `uiAccent` token and writes `--ui-accent`, which defaults to
 * the neutral muted scale. Never wire uiAccent to `--accent`.
 */

export type TokenGroup = 'brand' | 'surface' | 'ui' | 'sidebar' | 'chart'

export interface ColorTokenSpec {
  key: ColorTokenKey
  cssVar: string
  label: string
  group: TokenGroup
  /** Longer explanation shown under the swatch in the editor. */
  hint?: string
}

/**
 * The literal table exists only to derive ColorTokenKey; consumers use the
 * widened COLOR_TOKENS below. `as const satisfies` would narrow each entry to
 * its own literal type, which drops `hint` from the entries that lack one and
 * makes `token.hint` a compile error at the call site.
 */
const RAW_COLOR_TOKENS = [
  // --- brand ---------------------------------------------------------------
  {
    key: 'primary',
    cssVar: '--accent',
    label: 'Primary',
    group: 'brand',
    hint: 'The brand accent. Drives buttons, links, focus rings and the sidebar highlight.',
  },
  {
    key: 'primaryForeground',
    cssVar: '--accent-contrast',
    label: 'Primary foreground',
    group: 'brand',
    hint: 'Text and icons drawn on top of the primary color.',
  },

  // --- surfaces ------------------------------------------------------------
  { key: 'background', cssVar: '--background', label: 'Background', group: 'surface' },
  { key: 'foreground', cssVar: '--foreground', label: 'Foreground', group: 'surface' },
  { key: 'card', cssVar: '--card', label: 'Card', group: 'surface' },
  { key: 'cardForeground', cssVar: '--card-foreground', label: 'Card foreground', group: 'surface' },
  { key: 'popover', cssVar: '--popover', label: 'Popover', group: 'surface' },
  {
    key: 'popoverForeground',
    cssVar: '--popover-foreground',
    label: 'Popover foreground',
    group: 'surface',
  },

  // --- ui ------------------------------------------------------------------
  { key: 'secondary', cssVar: '--secondary', label: 'Secondary', group: 'ui' },
  {
    key: 'secondaryForeground',
    cssVar: '--secondary-foreground',
    label: 'Secondary foreground',
    group: 'ui',
  },
  { key: 'muted', cssVar: '--muted', label: 'Muted', group: 'ui' },
  { key: 'mutedForeground', cssVar: '--muted-foreground', label: 'Muted foreground', group: 'ui' },
  {
    key: 'uiAccent',
    cssVar: '--ui-accent',
    label: 'Hover wash',
    group: 'ui',
    hint: "shadcn's \"accent\" token — hover and active backgrounds. Follows Muted unless set.",
  },
  {
    key: 'uiAccentForeground',
    cssVar: '--ui-accent-foreground',
    label: 'Hover wash foreground',
    group: 'ui',
  },
  { key: 'destructive', cssVar: '--destructive', label: 'Destructive', group: 'ui' },
  {
    key: 'destructiveForeground',
    cssVar: '--destructive-foreground',
    label: 'Destructive foreground',
    group: 'ui',
  },
  { key: 'border', cssVar: '--border', label: 'Border', group: 'ui' },
  { key: 'input', cssVar: '--input', label: 'Input border', group: 'ui' },
  {
    key: 'ring',
    cssVar: '--ring',
    label: 'Focus ring',
    group: 'ui',
    hint: 'Follows Primary unless set.',
  },

  // --- sidebar -------------------------------------------------------------
  { key: 'sidebar', cssVar: '--sidebar', label: 'Sidebar', group: 'sidebar' },
  {
    key: 'sidebarForeground',
    cssVar: '--sidebar-foreground',
    label: 'Sidebar foreground',
    group: 'sidebar',
  },
  {
    key: 'sidebarPrimary',
    cssVar: '--sidebar-primary',
    label: 'Sidebar highlight',
    group: 'sidebar',
    hint: 'Follows Primary unless set.',
  },
  {
    key: 'sidebarPrimaryForeground',
    cssVar: '--sidebar-primary-foreground',
    label: 'Sidebar highlight foreground',
    group: 'sidebar',
  },
  {
    key: 'sidebarAccent',
    cssVar: '--sidebar-accent',
    label: 'Sidebar hover',
    group: 'sidebar',
  },
  {
    key: 'sidebarAccentForeground',
    cssVar: '--sidebar-accent-foreground',
    label: 'Sidebar hover foreground',
    group: 'sidebar',
  },
  { key: 'sidebarBorder', cssVar: '--sidebar-border', label: 'Sidebar border', group: 'sidebar' },
  {
    key: 'sidebarRing',
    cssVar: '--sidebar-ring',
    label: 'Sidebar focus ring',
    group: 'sidebar',
    hint: 'Follows Primary unless set.',
  },

  // --- charts --------------------------------------------------------------
  // CHART SERIES: identity, not decoration.
  //
  // Derived from Okabe-Ito, the reference color-vision-safe qualitative
  // palette, shifted in OKLCH lightness per mode (-0.12 light, +0.10 dark) so
  // the marks clear 3:1 against every shipped preset's background AND card, not
  // just the default ones. The shift is uniform on purpose: it preserves the
  // per-series lightness differences that make the palette separable at all.
  // A palette where every series shares a lightness cannot survive dichromat
  // simulation, because that simulation collapses hue.
  //
  // These are defaults, not a lock — the editor lets you replace them and
  // re-runs the same checks live (src/lib/themeAudit.ts). Assignment is by slot
  // order and never cycles; a sixth series needs a new slot, not a generated hue.
  { key: 'chart1', cssVar: '--chart-1', label: 'Series 1', group: 'chart' },
  { key: 'chart2', cssVar: '--chart-2', label: 'Series 2', group: 'chart' },
  { key: 'chart3', cssVar: '--chart-3', label: 'Series 3', group: 'chart' },
  { key: 'chart4', cssVar: '--chart-4', label: 'Series 4', group: 'chart' },
  { key: 'chart5', cssVar: '--chart-5', label: 'Series 5', group: 'chart' },
] as const

export type ColorTokenKey = (typeof RAW_COLOR_TOKENS)[number]['key']

export const COLOR_TOKENS: readonly ColorTokenSpec[] = RAW_COLOR_TOKENS

export const COLOR_TOKEN_KEYS = RAW_COLOR_TOKENS.map((token) => token.key) as ColorTokenKey[]

export const CHART_TOKEN_KEYS = [
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
] as const satisfies readonly ColorTokenKey[]

export const GROUP_LABELS: Record<TokenGroup, string> = {
  brand: 'Brand',
  surface: 'Surfaces',
  ui: 'Interface',
  sidebar: 'Sidebar',
  chart: 'Chart series',
}

/** Tokens whose value mirrors another token when the user has not set one. */
export const DERIVED_FROM: Partial<Record<ColorTokenKey, ColorTokenKey>> = {
  ring: 'primary',
  sidebarPrimary: 'primary',
  sidebarPrimaryForeground: 'primaryForeground',
  sidebarRing: 'primary',
  uiAccent: 'muted',
  uiAccentForeground: 'foreground',
}

// --- non-color tokens --------------------------------------------------------

export interface ShadowTokens {
  color: string
  opacity: string
  blur: string
  spread: string
  offsetX: string
  offsetY: string
}

export interface GlobalTokens {
  radius: string
  fontSans: string
  fontSerif: string
  fontMono: string
  letterSpacing: string
  spacing: string
}

export const FONT_STACKS: { label: string; value: string }[] = [
  { label: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: 'Inter', value: "Inter, system-ui, sans-serif" },
  { label: 'Geist', value: "Geist, system-ui, sans-serif" },
  { label: 'Grotesk', value: "'Space Grotesk', system-ui, sans-serif" },
  { label: 'Serif', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Mono', value: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace" },
]

/** Base values — the look OpenRep ships with, before any preset or override. */
export type ColorMap = Record<ColorTokenKey, string>

export const BASE_LIGHT: ColorMap = {
  primary: '#3f3f46',
  primaryForeground: '#ffffff',
  background: '#f6f6f7',
  foreground: '#1c1c21',
  card: '#ffffff',
  cardForeground: '#1c1c21',
  popover: '#ffffff',
  popoverForeground: '#1c1c21',
  secondary: '#efeff1',
  secondaryForeground: '#1c1c21',
  muted: '#efeff1',
  mutedForeground: '#6e6e78',
  uiAccent: '#efeff1',
  uiAccentForeground: '#1c1c21',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  border: '#e2e2e6',
  input: '#e2e2e6',
  ring: '#3f3f46',
  sidebar: '#ffffff',
  sidebarForeground: '#1c1c21',
  sidebarPrimary: '#3f3f46',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#efeff1',
  sidebarAccentForeground: '#1c1c21',
  sidebarBorder: '#e2e2e6',
  sidebarRing: '#3f3f46',
  // Okabe-Ito, shifted -0.12 in OKLCH lightness. See CHART SERIES note below.
  chart1: '#004e8c',
  chart2: '#ac3700',
  chart3: '#007951',
  chart4: '#a45582',
  chart5: '#2a8ec1',
}

export const BASE_DARK: ColorMap = {
  primary: '#a1a1aa',
  primaryForeground: '#18181b',
  background: '#131316',
  foreground: '#ececf0',
  card: '#1c1c21',
  cardForeground: '#ececf0',
  popover: '#1c1c21',
  popoverForeground: '#ececf0',
  secondary: '#26262c',
  secondaryForeground: '#ececf0',
  muted: '#26262c',
  mutedForeground: '#9c9ca8',
  uiAccent: '#26262c',
  uiAccentForeground: '#ececf0',
  destructive: '#f87171',
  destructiveForeground: '#2a0a0a',
  border: '#32323a',
  input: '#32323a',
  ring: '#a1a1aa',
  sidebar: '#1c1c21',
  sidebarForeground: '#ececf0',
  sidebarPrimary: '#a1a1aa',
  sidebarPrimaryForeground: '#18181b',
  sidebarAccent: '#26262c',
  sidebarAccentForeground: '#ececf0',
  sidebarBorder: '#32323a',
  sidebarRing: '#a1a1aa',
  // Okabe-Ito, shifted +0.10 in OKLCH lightness. See CHART SERIES note below.
  chart1: '#3491d3',
  chart2: '#f87e36',
  chart3: '#3fbe91',
  chart4: '#ee98c7',
  chart5: '#77d4ff',
}

export const BASE_SHADOW_LIGHT: ShadowTokens = {
  color: '#000000',
  opacity: '0.1',
  blur: '3px',
  spread: '0px',
  offsetX: '0px',
  offsetY: '1px',
}

export const BASE_SHADOW_DARK: ShadowTokens = {
  color: '#000000',
  opacity: '0.4',
  blur: '4px',
  spread: '0px',
  offsetX: '0px',
  offsetY: '2px',
}

export const BASE_GLOBAL: GlobalTokens = {
  radius: '0.625rem',
  fontSans: FONT_STACKS[0].value,
  fontSerif: FONT_STACKS[4].value,
  fontMono: FONT_STACKS[5].value,
  letterSpacing: '0em',
  spacing: '0.25rem',
}
