import { describe, expect, it } from 'vitest'
import { auditChartSeries, auditTextContrast, auditTheme, THRESHOLDS } from './themeAudit'
import { resolveColors } from './theme'
import { EMPTY_OVERRIDES } from './theme'
import { THEME_PRESETS } from './themePresets'
import { BASE_DARK, BASE_LIGHT, type ColorMap } from './themeTokens'

describe('shipped defaults', () => {
  it('passes every check in both modes', () => {
    expect(auditTheme(BASE_LIGHT)).toEqual([])
    expect(auditTheme(BASE_DARK)).toEqual([])
  })

  // The whole justification for making chart colors editable was that the
  // audit replaces the lock. If a shipped preset trips it, the audit is wrong.
  it.each(THEME_PRESETS)('preset %s raises no warnings', (preset) => {
    for (const mode of ['light', 'dark'] as const) {
      const colors = resolveColors(mode, preset, EMPTY_OVERRIDES)
      expect({ preset, mode, warnings: auditTheme(colors) }).toEqual({
        preset,
        mode,
        warnings: [],
      })
    }
  })
})

describe('auditTextContrast', () => {
  it('flags foreground that disappears into its background', () => {
    const colors: ColorMap = { ...BASE_LIGHT, foreground: '#f0f0f0' }
    const warnings = auditTextContrast(colors)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].tokens).toEqual(['foreground', 'background'])
    expect(warnings[0].message).toContain('below the 4.5:1 minimum')
  })

  it('reports the measured ratio, not just a verdict', () => {
    const colors: ColorMap = { ...BASE_LIGHT, primary: '#ffffff', primaryForeground: '#fefefe' }
    const [warning] = auditTextContrast(colors).filter((w) => w.tokens.includes('primary'))
    expect(warning.message).toMatch(/is 1(\.\d)?:1/)
  })
})

describe('auditChartSeries', () => {
  it('flags two series that are near-identical', () => {
    const colors: ColorMap = { ...BASE_LIGHT, chart2: BASE_LIGHT.chart1 }
    const warnings = auditChartSeries(colors)
    expect(warnings.some((w) => w.message.includes('too close to tell apart'))).toBe(true)
  })

  it('flags a series that vanishes into the card surface', () => {
    const colors: ColorMap = { ...BASE_LIGHT, chart1: '#fdfdfd' }
    const warnings = auditChartSeries(colors)
    expect(warnings.some((w) => w.message.includes('may vanish'))).toBe(true)
  })

  it('flags a pair that only collapses for color-blind viewers', () => {
    // Red and green of similar lightness: clearly distinct to normal vision,
    // indistinguishable to protans and deutans.
    const colors: ColorMap = { ...BASE_LIGHT, chart1: '#c04000', chart2: '#5a8f00' }
    const warnings = auditChartSeries(colors)
    const cvd = warnings.find((w) => w.message.includes('merge for'))
    expect(cvd).toBeDefined()
    expect(cvd?.tokens).toEqual(['chart1', 'chart2'])
  })

  it('does not flag series that survive simulation', () => {
    const warnings = auditChartSeries(BASE_LIGHT).filter((w) => w.message.includes('merge for'))
    expect(warnings).toEqual([])
  })
})

describe('thresholds', () => {
  it('uses the WCAG minimums the messages quote', () => {
    expect(THRESHOLDS.bodyText).toBe(4.5)
    expect(THRESHOLDS.nonText).toBe(3)
  })
})
