/**
 * Design-time checks for a customized theme.
 *
 * The editor lets you set any token, including the chart series colors that
 * used to be locked. These checks are what replaces that lock: rather than
 * refusing a palette, we tell you exactly which pair stops being separable and
 * for whom. Warnings, never errors — it is the user's tracker.
 */

import { contrastRatio, deltaEOk, simulateCvd, type CvdType } from './color'
import { CHART_TOKEN_KEYS, COLOR_TOKENS, type ColorMap, type ColorTokenKey } from './themeTokens'

export type Severity = 'warn' | 'info'

export interface ThemeWarning {
  severity: Severity
  /** Tokens the warning is about, for highlighting in the editor. */
  tokens: ColorTokenKey[]
  message: string
}

/**
 * Thresholds.
 *
 * WCAG puts 4.5:1 on body text and 3:1 on large text and non-text UI; chart
 * marks are non-text, so 3:1 against the surfaces they sit on.
 *
 * The two OKLab deltas are calibrated, not guessed. Okabe-Ito — the reference
 * color-vision-safe qualitative palette, and what the shipped series colors are
 * derived from — achieves a worst pair of ~0.14 in normal vision and ~0.069
 * under dichromat simulation. Set the bars above that and a known-good palette
 * fails; the numbers below sit just under it, which still catches the failures
 * that matter (a duplicated series scores 0, and a red/green pair of equal
 * lightness scores ~0.03 under deuteranopia).
 */
export const THRESHOLDS = {
  bodyText: 4.5,
  largeText: 3,
  nonText: 3,
  seriesNormal: 0.12,
  seriesCvd: 0.055,
} as const

const labelFor = (key: ColorTokenKey) =>
  COLOR_TOKENS.find((token) => token.key === key)?.label ?? key

const round = (value: number) => Math.round(value * 10) / 10

/** Foreground/background pairs that must stay readable, as [fg, bg, minimum]. */
const TEXT_PAIRS: [ColorTokenKey, ColorTokenKey, number][] = [
  ['foreground', 'background', THRESHOLDS.bodyText],
  ['cardForeground', 'card', THRESHOLDS.bodyText],
  ['popoverForeground', 'popover', THRESHOLDS.bodyText],
  ['mutedForeground', 'muted', THRESHOLDS.largeText],
  ['primaryForeground', 'primary', THRESHOLDS.bodyText],
  ['secondaryForeground', 'secondary', THRESHOLDS.bodyText],
  ['destructiveForeground', 'destructive', THRESHOLDS.bodyText],
  ['uiAccentForeground', 'uiAccent', THRESHOLDS.bodyText],
  ['sidebarForeground', 'sidebar', THRESHOLDS.bodyText],
  ['sidebarPrimaryForeground', 'sidebarPrimary', THRESHOLDS.bodyText],
  ['sidebarAccentForeground', 'sidebarAccent', THRESHOLDS.bodyText],
]

export function auditTextContrast(colors: ColorMap): ThemeWarning[] {
  const warnings: ThemeWarning[] = []
  for (const [fg, bg, minimum] of TEXT_PAIRS) {
    const ratio = contrastRatio(colors[fg], colors[bg])
    if (ratio < minimum) {
      warnings.push({
        severity: 'warn',
        tokens: [fg, bg],
        message: `${labelFor(fg)} on ${labelFor(bg)} is ${round(ratio)}:1 — below the ${minimum}:1 minimum.`,
      })
    }
  }
  return warnings
}

const CVD_LABELS: Record<CvdType, string> = {
  protan: 'red-blind (protanopia)',
  deutan: 'green-blind (deuteranopia)',
  tritan: 'blue-blind (tritanopia)',
}

/**
 * Chart series must be separable from each other and visible on both surfaces.
 *
 * Only reports the first CVD type that collapses a given pair — knowing a pair
 * fails for protans and deutans is one decision, not two.
 */
export function auditChartSeries(colors: ColorMap): ThemeWarning[] {
  const warnings: ThemeWarning[] = []
  const series = CHART_TOKEN_KEYS

  for (const key of series) {
    for (const surface of ['background', 'card'] as const) {
      const ratio = contrastRatio(colors[key], colors[surface])
      if (ratio < THRESHOLDS.nonText) {
        warnings.push({
          severity: 'warn',
          tokens: [key],
          message: `${labelFor(key)} is ${round(ratio)}:1 against ${labelFor(surface)} — below ${THRESHOLDS.nonText}:1, so the mark may vanish.`,
        })
      }
    }
  }

  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const [a, b] = [series[i], series[j]]
      const normal = deltaEOk(colors[a], colors[b])
      if (normal < THRESHOLDS.seriesNormal) {
        warnings.push({
          severity: 'warn',
          tokens: [a, b],
          message: `${labelFor(a)} and ${labelFor(b)} are too close to tell apart.`,
        })
        continue
      }
      const failing = (Object.keys(CVD_LABELS) as CvdType[]).find(
        (type) => deltaEOk(simulateCvd(colors[a], type), simulateCvd(colors[b], type)) < THRESHOLDS.seriesCvd,
      )
      if (failing) {
        warnings.push({
          severity: 'warn',
          tokens: [a, b],
          message: `${labelFor(a)} and ${labelFor(b)} merge for ${CVD_LABELS[failing]} viewers.`,
        })
      }
    }
  }
  return warnings
}

export function auditTheme(colors: ColorMap): ThemeWarning[] {
  return [...auditTextContrast(colors), ...auditChartSeries(colors)]
}
