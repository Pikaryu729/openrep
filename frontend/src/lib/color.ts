/**
 * Color conversion and contrast math.
 *
 * Exists because the theme editor has to do three things the DOM won't do for
 * us: read the OKLCH values tweakcn exports, feed hex into `<input type=color>`,
 * and judge whether a palette the user just typed is actually legible.
 *
 * Everything normalizes to hex internally — it is the one format that survives
 * a round trip through localStorage, a color input, and a CSS variable without
 * ambiguity.
 */

/** A parsed sRGB color, channels in 0..1. */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** Perceptual OKLab coordinates. */
export interface Oklab {
  L: number
  a: number
  b: number
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

// --- hex ---------------------------------------------------------------------

/** Expands #abc to #aabbcc and lowercases; returns null if not a hex color. */
export function normalizeHex(input: string): string | null {
  const value = input.trim().toLowerCase()
  const short = /^#([0-9a-f]{3})$/.exec(value)
  if (short) {
    const [r, g, b] = short[1]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return /^#[0-9a-f]{6}$/.test(value) ? value : null
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16) / 255,
    g: parseInt(normalized.slice(3, 5), 16) / 255,
    b: parseInt(normalized.slice(5, 7), 16) / 255,
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

// --- OKLab / OKLCH -----------------------------------------------------------
// Matrices from Björn Ottosson's reference implementation.

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

/** OKLCH triple: lightness 0..1, chroma, hue in degrees. */
export function rgbToOklch(rgb: Rgb): { l: number; c: number; h: number } {
  const { L, a, b } = rgbToOklab(rgb)
  const c = Math.sqrt(a * a + b * b)
  // Hue is meaningless at zero chroma; report 0 rather than a NaN from atan2.
  const h = c < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const rad = (h * Math.PI) / 180
  return oklabToRgb({ L: l, a: c * Math.cos(rad), b: c * Math.sin(rad) })
}

/**
 * Parses the color formats a theme can arrive in: hex, `oklch(...)`, `rgb(...)`,
 * and `hsl(...)`. Returns hex, or null if the value isn't a color we can pin
 * down. tweakcn exports OKLCH; hand-written CSS tends to be hex or hsl.
 */
export function parseColor(input: string): string | null {
  const value = input.trim().toLowerCase()
  if (!value) return null

  const hex = normalizeHex(value)
  if (hex) return hex

  const args = (source: string) =>
    source
      .replace(/^[a-z]+\(/, '')
      .replace(/\)$/, '')
      .replace(/\//g, ' ')
      .split(/[\s,]+/)
      .filter(Boolean)

  // A bare "0.6 0.12 250" triple is how shadcn CSS often stores oklch, with the
  // wrapper living in the consuming var() call.
  if (value.startsWith('oklch(') || /^[\d.]+\s+[\d.]+\s+[\d.-]+$/.test(value)) {
    const parts = args(value)
    if (parts.length < 3) return null
    const l = parsePercentOrNumber(parts[0], 1)
    const c = parsePercentOrNumber(parts[1], 0.4)
    const h = Number.parseFloat(parts[2])
    if (l === null || c === null || Number.isNaN(h)) return null
    return rgbToHex(oklchToRgb(l, c, h))
  }

  if (value.startsWith('rgb')) {
    const parts = args(value)
    if (parts.length < 3) return null
    const channels = parts.slice(0, 3).map((part) => {
      const n = Number.parseFloat(part)
      return Number.isNaN(n) ? null : part.endsWith('%') ? n / 100 : n / 255
    })
    if (channels.some((c) => c === null)) return null
    const [r, g, b] = channels as number[]
    return rgbToHex({ r, g, b })
  }

  if (value.startsWith('hsl')) {
    const parts = args(value)
    if (parts.length < 3) return null
    const h = Number.parseFloat(parts[0])
    const s = Number.parseFloat(parts[1]) / 100
    const l = Number.parseFloat(parts[2]) / 100
    if ([h, s, l].some(Number.isNaN)) return null
    return rgbToHex(hslToRgb(h, s, l))
  }

  return null
}

function parsePercentOrNumber(part: string, scale: number): number | null {
  const n = Number.parseFloat(part)
  if (Number.isNaN(n)) return null
  return part.endsWith('%') ? (n / 100) * scale : n
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((hp % 2) - 1))
  const [r1, g1, b1] =
    hp < 1
      ? [chroma, x, 0]
      : hp < 2
        ? [x, chroma, 0]
        : hp < 3
          ? [0, chroma, x]
          : hp < 4
            ? [0, x, chroma]
            : hp < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]
  const m = l - chroma / 2
  return { r: r1 + m, g: g1 + m, b: b1 + m }
}

// --- contrast ----------------------------------------------------------------

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
}

/** WCAG contrast ratio, 1..21. Order of arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

/** Black or white body text for a given background, whichever reads better. */
export function contrastColorFor(hex: string): string {
  const normalized = normalizeHex(hex)
  if (!normalized) return '#ffffff'
  return relativeLuminance(normalized) > 0.4 ? '#18181b' : '#ffffff'
}

// --- color vision deficiency -------------------------------------------------

/**
 * Brettel/Viénot-style dichromat simulation, in linear sRGB.
 *
 * Used to check that chart series stay distinguishable, not to render anything —
 * approximate is fine, and these matrices are the ones commonly used for
 * exactly this kind of design-time check.
 */
const CVD_MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const

export type CvdType = keyof typeof CVD_MATRICES

export function simulateCvd(hex: string, type: CvdType): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [lr, lg, lb] = [toLinear(rgb.r), toLinear(rgb.g), toLinear(rgb.b)]
  const m = CVD_MATRICES[type]
  return rgbToHex({
    r: fromLinear(clamp01(m[0][0] * lr + m[0][1] * lg + m[0][2] * lb)),
    g: fromLinear(clamp01(m[1][0] * lr + m[1][1] * lg + m[1][2] * lb)),
    b: fromLinear(clamp01(m[2][0] * lr + m[2][1] * lg + m[2][2] * lb)),
  })
}

/** Euclidean distance in OKLab — a reasonable stand-in for perceived difference. */
export function deltaEOk(a: string, b: string): number {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return 0
  const la = rgbToOklab(ra)
  const lb = rgbToOklab(rb)
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b)
}
