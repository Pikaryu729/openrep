import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ThemeEditor } from '@/components/ThemeEditor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type BackupDocument, type BackupImportSummary } from '@/lib/api'
import { saveOnboardingFlag } from '@/lib/onboarding'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from '@/lib/theme'
import { THEME_PRESET_DEFINITIONS, THEME_PRESETS } from '@/lib/themePresets'
import { saveUnits, useUnits, type UnitSystem } from '@/lib/units'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function SettingsPage() {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="flex flex-col gap-4">
        <AppearanceCard />
        <UnitsCard />
        <BackupCard />
        <OnboardingCard />
      </div>
    </section>
  )
}

function OnboardingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding</CardTitle>
      </CardHeader>
      <CardContent>
        <SettingsRow label="First-run setup">
          {/* The root layout's gate subscribes to the flag, so writing
              'replay' swaps the wizard in immediately — no navigation. */}
          <Button variant="outline" onClick={() => saveOnboardingFlag('replay')}>
            Replay onboarding
          </Button>
          <span className="text-xs text-muted-foreground">
            Walk through units, theme and the starter exercise library again. Nothing is
            duplicated or deleted.
          </span>
        </SettingsRow>
      </CardContent>
    </Card>
  )
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-32 text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function AppearanceCard() {
  const api = useTheme()
  const { theme, update } = api
  const [customizing, setCustomizing] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SettingsRow label="Mode">
          <div
            className="inline-flex overflow-hidden rounded-md border bg-card"
            role="group"
            aria-label="Color mode"
          >
            {MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                data-testid={`mode-${mode.value}`}
                aria-pressed={theme.mode === mode.value}
                onClick={() => update({ mode: mode.value })}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors not-first:border-l',
                  theme.mode === mode.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Theme">
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => {
              const selected = theme.preset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  data-testid={`preset-${preset}`}
                  aria-pressed={selected}
                  onClick={() => update({ preset })}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm transition-colors',
                    selected ? 'border-primary ring-[3px] ring-primary/25' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className="size-3.5 rounded-full"
                    style={{ background: THEME_PRESET_DEFINITIONS[preset].swatch }}
                  />
                  {THEME_PRESET_DEFINITIONS[preset].label}
                </button>
              )
            })}
          </div>
        </SettingsRow>
        <SettingsRow label="Customize">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={customizing}
            onClick={() => setCustomizing((open) => !open)}
          >
            {customizing ? 'Hide theme editor' : 'Open theme editor'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Every color, font, radius and shadow — layered on top of the preset.
          </span>
        </SettingsRow>
        {customizing && <ThemeEditor api={api} />}
      </CardContent>
    </Card>
  )
}

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (kg)' },
  { value: 'imperial', label: 'Imperial (lb)' },
]

function UnitsCard() {
  const units = useUnits()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Units</CardTitle>
      </CardHeader>
      <CardContent>
        <SettingsRow label="Weight">
          <div
            className="inline-flex overflow-hidden rounded-md border bg-card"
            role="group"
            aria-label="Weight units"
          >
            {UNIT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-testid={`unit-${option.value}`}
                aria-pressed={units === option.value}
                onClick={() => saveUnits(option.value)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors not-first:border-l',
                  units === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </SettingsRow>
        <p className="mt-3 text-xs text-muted-foreground">
          Weights are always stored in kilograms; this only changes how they are entered and
          displayed.
        </p>
      </CardContent>
    </Card>
  )
}

interface PendingImport {
  document: BackupDocument
  fileName: string
}

function BackupCard() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [summary, setSummary] = useState<BackupImportSummary | null>(null)

  const exportBackup = useMutation({
    mutationFn: api.backup.exportData,
    onSuccess: (document) => {
      const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `openrep-backup-${document.exported_at.slice(0, 10)}.json`
      // Firefox only honours a programmatic click on an anchor that is in the
      // document, and revoking in the same tick races the browser's fetch of
      // the blob — either one silently downloads nothing.
      window.document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    },
  })

  const importBackup = useMutation({
    mutationFn: (body: Parameters<typeof api.backup.importData>[0]) =>
      api.backup.importData(body),
    onSuccess: (result) => {
      setSummary(result)
      setPending(null)
      queryClient.invalidateQueries()
    },
  })

  const onFileChosen = async (file: File) => {
    setFileError(null)
    setSummary(null)
    // The contents are in hand from here on, so clear the input immediately:
    // an unchanged value fires no `change` event, and picking the same file
    // again is exactly what you do after importing as merge when you meant
    // replace, or after fixing a file we rejected.
    if (fileInputRef.current) fileInputRef.current.value = ''
    try {
      const parsed = JSON.parse(await file.text()) as BackupDocument
      if (parsed.app !== 'openrep' || parsed.version !== 1) {
        setFileError('This file is not an OpenRep v1 backup.')
        return
      }
      importBackup.reset()
      setPending({ document: parsed, fileName: file.name })
    } catch {
      setFileError('Could not read that file as JSON.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SettingsRow label="Export">
          <Button
            variant="outline"
            disabled={exportBackup.isPending}
            onClick={() => exportBackup.mutate()}
          >
            Download backup JSON
          </Button>
        </SettingsRow>
        <p className="text-muted-foreground text-xs">
          This is your training data. Your dashboard layout is separate — export it from the
          dashboard's Edit mode.
        </p>
        {exportBackup.error && (
          <p className="text-sm text-destructive">{exportBackup.error.message}</p>
        )}

        <SettingsRow label="Import">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file"
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onFileChosen(file)
            }}
          />
        </SettingsRow>
        <SettingsRow label="Import mode">
          <label className="text-sm">
            <input
              type="radio"
              name="import-mode"
              className="mr-1.5 accent-primary"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            Merge — adds workouts from the backup; exercises are matched by name. Importing the
            same file twice duplicates workouts.
          </label>
        </SettingsRow>
        <SettingsRow label="">
          <label className="text-sm">
            <input
              type="radio"
              name="import-mode"
              className="mr-1.5 accent-primary"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            Replace — deletes everything first, then restores the backup.
          </label>
        </SettingsRow>
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        {summary && (
          <p className="text-sm text-muted-foreground">
            Imported ({summary.mode}): {summary.exercises_created} exercises created,{' '}
            {summary.exercises_matched} matched, {summary.workouts_created} workouts,{' '}
            {summary.sets_created} sets.
          </p>
        )}

        {pending && (
          <ConfirmDialog
            title={mode === 'replace' ? 'Replace all data?' : 'Merge backup?'}
            message={
              mode === 'replace'
                ? `This deletes all current data, then restores "${pending.fileName}".`
                : `This merges "${pending.fileName}" into your current data.`
            }
            confirmLabel={mode === 'replace' ? 'Replace everything' : 'Import'}
            danger={mode === 'replace'}
            isPending={importBackup.isPending}
            error={importBackup.error ? importBackup.error.message : null}
            onConfirm={() => importBackup.mutate({ mode, data: pending.document })}
            onCancel={() => setPending(null)}
          />
        )}
      </CardContent>
    </Card>
  )
}
