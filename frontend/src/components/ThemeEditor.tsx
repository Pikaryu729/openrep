import { ChevronDown, RotateCcw, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/NativeSelect'
import { Textarea } from '@/components/ui/textarea'
import { normalizeHex } from '@/lib/color'
import { auditTheme, type ThemeWarning } from '@/lib/themeAudit'
import { parseThemeCss } from '@/lib/themeCss'
import { resolveColors, resolveGlobal, resolveShadow, type ResolvedMode } from '@/lib/theme'
import {
  COLOR_TOKENS,
  FONT_STACKS,
  GROUP_LABELS,
  type ColorTokenKey,
  type GlobalTokens,
  type ShadowTokens,
  type TokenGroup,
} from '@/lib/themeTokens'
import { cn } from '@/lib/utils'
import type { useTheme } from '@/lib/theme'

type ThemeApi = ReturnType<typeof useTheme>

const GROUP_ORDER: TokenGroup[] = ['brand', 'surface', 'ui', 'sidebar', 'chart']

const EDIT_MODES: { value: ResolvedMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeEditor({ api }: { api: ThemeApi }) {
  const { theme, update, setColor, setShadow, setGlobal, resetOverrides } = api
  // Which mode's tokens are being edited. Switching also switches what the app
  // is showing — editing dark tokens while looking at the light theme is a
  // guessing game.
  const [editMode, setEditMode] = useState<ResolvedMode>(theme.mode === 'dark' ? 'dark' : 'light')

  const colors = useMemo(
    () => resolveColors(editMode, theme.preset, theme.overrides),
    [editMode, theme.preset, theme.overrides],
  )
  const warnings = useMemo(() => auditTheme(colors), [colors])
  const global = resolveGlobal(theme.preset, theme.overrides)
  const shadow = resolveShadow(editMode, theme.preset, theme.overrides)

  const overrideCount =
    Object.keys(theme.overrides.colors.light).length +
    Object.keys(theme.overrides.colors.dark).length +
    Object.keys(theme.overrides.shadow.light).length +
    Object.keys(theme.overrides.shadow.dark).length +
    Object.keys(theme.overrides.global).length

  const chooseEditMode = (mode: ResolvedMode) => {
    setEditMode(mode)
    update({ mode })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex overflow-hidden rounded-md border bg-card"
          role="group"
          aria-label="Editing mode"
        >
          {EDIT_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              data-testid={`edit-mode-${mode.value}`}
              aria-pressed={editMode === mode.value}
              onClick={() => chooseEditMode(mode.value)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors not-first:border-l',
                editMode === mode.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {overrideCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetOverrides}>
            <RotateCcw />
            Reset {overrideCount} customization{overrideCount === 1 ? '' : 's'}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Editing the <strong>{editMode}</strong> palette. Every token is per-mode; typography and
        shape are shared.
      </p>

      <WarningList warnings={warnings} />

      {GROUP_ORDER.map((group) => (
        <TokenGroupSection
          key={group}
          group={group}
          editMode={editMode}
          colors={colors}
          overrides={theme.overrides.colors[editMode]}
          setColor={setColor}
          warnings={warnings}
        />
      ))}

      <TypographySection global={global} setGlobal={setGlobal} />
      <ShadowSection editMode={editMode} shadow={shadow} setShadow={setShadow} />
      <ImportSection api={api} />
    </div>
  )
}

// --- warnings ----------------------------------------------------------------

function WarningList({ warnings }: { warnings: ThemeWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <div
      role="status"
      aria-label="Theme warnings"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <TriangleAlert className="size-4" />
        {warnings.length} accessibility {warnings.length === 1 ? 'warning' : 'warnings'}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
        {warnings.map((warning) => (
          <li key={`${warning.tokens.join('-')}-${warning.message}`}>{warning.message}</li>
        ))}
      </ul>
    </div>
  )
}

// --- color tokens ------------------------------------------------------------

function TokenGroupSection({
  group,
  editMode,
  colors,
  overrides,
  setColor,
  warnings,
}: {
  group: TokenGroup
  editMode: ResolvedMode
  colors: Record<ColorTokenKey, string>
  overrides: Partial<Record<ColorTokenKey, string>>
  setColor: ThemeApi['setColor']
  warnings: ThemeWarning[]
}) {
  const tokens = COLOR_TOKENS.filter((token) => token.group === group)
  const flagged = new Set(warnings.flatMap((warning) => warning.tokens))
  const changed = tokens.filter((token) => token.key in overrides).length

  return (
    <Collapsible defaultOpen={group === 'brand'} className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted">
        <span className="flex items-center gap-2">
          {GROUP_LABELS[group]}
          <span className="flex -space-x-1">
            {tokens.slice(0, 5).map((token) => (
              <span
                key={token.key}
                className="size-3 rounded-full border border-border"
                style={{ background: colors[token.key] }}
              />
            ))}
          </span>
          {changed > 0 && <span className="text-xs text-muted-foreground">{changed} changed</span>}
        </span>
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 border-t p-3">
        {tokens.map((token) => (
          <ColorTokenRow
            key={token.key}
            label={token.label}
            hint={token.hint}
            value={colors[token.key]}
            overridden={token.key in overrides}
            flagged={flagged.has(token.key)}
            onChange={(value) => setColor(editMode, token.key, value)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ColorTokenRow({
  label,
  hint,
  value,
  overridden,
  flagged,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  overridden: boolean
  flagged: boolean
  onChange: (value: string | null) => void
}) {
  // The hex field is kept as local text so a half-typed "#12" does not get
  // committed as a color on every keystroke.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (text: string) => {
    const hex = normalizeHex(text)
    if (hex) onChange(hex)
    setDraft(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-card p-1',
          flagged && 'ring-2 ring-destructive',
        )}
      />
      <div className="min-w-40 flex-1">
        <Label className="text-sm font-normal">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Input
        aria-label={`${label} hex`}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
        }}
        className="h-8 w-28 font-mono text-xs"
      />
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Reset ${label}`}
        disabled={!overridden}
        onClick={() => onChange(null)}
        className={cn(!overridden && 'invisible')}
      >
        <RotateCcw />
      </Button>
    </div>
  )
}

// --- typography and shape ----------------------------------------------------

function TypographySection({
  global,
  setGlobal,
}: {
  global: GlobalTokens
  setGlobal: ThemeApi['setGlobal']
}) {
  const fontRow = (key: keyof GlobalTokens, label: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <Label className="min-w-32 text-sm font-normal">{label}</Label>
      <NativeSelect
        aria-label={label}
        value={global[key]}
        onChange={(event) => setGlobal(key, event.target.value)}
      >
        {FONT_STACKS.every((font) => font.value !== global[key]) && (
          <option value={global[key]}>Custom ({global[key].split(',')[0]})</option>
        )}
        {FONT_STACKS.map((font) => (
          <option key={font.label} value={font.value}>
            {font.label}
          </option>
        ))}
      </NativeSelect>
      <span className="text-sm text-muted-foreground" style={{ fontFamily: global[key] }}>
        Aa Bb 123
      </span>
    </div>
  )

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted">
        Typography &amp; shape
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
        {fontRow('fontSans', 'Sans')}
        {fontRow('fontSerif', 'Serif')}
        {fontRow('fontMono', 'Mono')}
        <RangeRow
          label="Corner radius"
          value={Number.parseFloat(global.radius) || 0}
          min={0}
          max={2}
          step={0.025}
          format={(n) => `${n}rem`}
          onChange={(n) => setGlobal('radius', `${n}rem`)}
        />
        <RangeRow
          label="Letter spacing"
          value={Number.parseFloat(global.letterSpacing) || 0}
          min={-0.05}
          max={0.15}
          step={0.005}
          format={(n) => `${n}em`}
          onChange={(n) => setGlobal('letterSpacing', `${n}em`)}
        />
        <RangeRow
          label="Spacing unit"
          value={Number.parseFloat(global.spacing) || 0.25}
          min={0.15}
          max={0.4}
          step={0.01}
          format={(n) => `${n}rem`}
          onChange={(n) => setGlobal('spacing', `${n}rem`)}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

function ShadowSection({
  editMode,
  shadow,
  setShadow,
}: {
  editMode: ResolvedMode
  shadow: ShadowTokens
  setShadow: ThemeApi['setShadow']
}) {
  const pxRow = (key: keyof ShadowTokens, label: string, min: number, max: number) => (
    <RangeRow
      label={label}
      value={Number.parseFloat(shadow[key]) || 0}
      min={min}
      max={max}
      step={1}
      format={(n) => `${n}px`}
      onChange={(n) => setShadow(editMode, key, `${n}px`)}
    />
  )

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted">
        <span className="flex items-center gap-2">
          Shadows
          <span
            className="size-4 rounded-sm bg-card"
            style={{ boxShadow: `0 2px 6px rgba(0,0,0,${shadow.opacity})` }}
          />
        </span>
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="min-w-32 text-sm font-normal">Shadow color</Label>
          <input
            type="color"
            aria-label="Shadow color"
            value={normalizeHex(shadow.color) ?? '#000000'}
            onChange={(event) => setShadow(editMode, 'color', event.target.value)}
            className="h-8 w-10 cursor-pointer rounded-md border bg-card p-1"
          />
        </div>
        <RangeRow
          label="Opacity"
          value={Number.parseFloat(shadow.opacity) || 0}
          min={0}
          max={1}
          step={0.01}
          format={(n) => n.toFixed(2)}
          onChange={(n) => setShadow(editMode, 'opacity', String(n))}
        />
        {pxRow('blur', 'Blur', 0, 40)}
        {pxRow('spread', 'Spread', -10, 20)}
        {pxRow('offsetX', 'Offset X', -20, 20)}
        {pxRow('offsetY', 'Offset Y', -20, 20)}
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * A labelled range input.
 *
 * Native `<input type=range>` rather than a Radix slider, for the reason
 * documented on NativeSelect: everything here is driven by fireEvent in jsdom
 * and selectOption in Playwright.
 */
function RangeRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Label className="min-w-32 text-sm font-normal">{label}</Label>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="h-2 flex-1 cursor-pointer accent-primary"
      />
      <span className="w-16 text-right font-mono text-xs text-muted-foreground">
        {format(value)}
      </span>
    </div>
  )
}

// --- import ------------------------------------------------------------------

function ImportSection({ api }: { api: ThemeApi }) {
  const [css, setCss] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onImport = () => {
    const parsed = parseThemeCss(css)
    if (parsed.error) {
      setError(parsed.error)
      setResult(null)
      return
    }
    api.update({ overrides: parsed.overrides })
    setError(null)
    const { light, dark, global } = parsed.applied
    const ignored = parsed.ignored.length
      ? ` Ignored ${parsed.ignored.length} unrecognised variable${parsed.ignored.length === 1 ? '' : 's'}.`
      : ''
    setResult(
      `Imported ${light} light, ${dark} dark and ${global} shared values.${ignored}`,
    )
    setCss('')
  }

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted">
        Import a theme
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 border-t p-3">
        <p className="text-xs text-muted-foreground">
          Paste the CSS from{' '}
          <a
            href="https://tweakcn.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            tweakcn
          </a>{' '}
          or any shadcn theme. OpenRep&apos;s <code>--accent</code> is the brand color, so a
          theme&apos;s <code>--primary</code> is mapped onto it and its <code>--accent</code>{' '}
          becomes the hover wash.
        </p>
        <Textarea
          aria-label="Theme CSS"
          value={css}
          onChange={(event) => setCss(event.target.value)}
          placeholder={':root {\n  --primary: oklch(0.55 0.22 264);\n}'}
          className="min-h-32 font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={onImport} disabled={!css.trim()}>
            Import
          </Button>
          {result && <span className="text-xs text-muted-foreground">{result}</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
