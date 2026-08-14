import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'

/**
 * First-run onboarding state.
 *
 * - `null` (key absent): auto-detect — probe the database once and decide.
 * - `'done'`: the wizard was completed or skipped; never show it again.
 * - `'replay'`: force the wizard on next render (Settings → Replay onboarding).
 */
export type OnboardingFlag = 'done' | 'replay' | null

export const ONBOARDING_STORAGE_KEY = 'openrep.onboarding'

const listeners = new Set<() => void>()

export function loadOnboardingFlag(): OnboardingFlag {
  try {
    const value = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    return value === 'done' || value === 'replay' ? value : null
  } catch {
    return null
  }
}

export function saveOnboardingFlag(flag: 'done' | 'replay'): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, flag)
  } catch {
    // Storage full or unavailable. The flag is a convenience, not a lock:
    // losing it only means the gate probes again next boot, whereas throwing
    // here would trap the user in the wizard (every exit path saves first).
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Reactive onboarding flag — re-renders subscribers when it changes. */
export function useOnboardingFlag(): OnboardingFlag {
  return useSyncExternalStore(subscribe, loadOnboardingFlag, () => null)
}

export type FirstRunDecision = 'wizard' | 'app' | 'app-mark-done'

/**
 * What a flag-absent boot does once both probe queries have settled.
 *
 * `undefined` for either emptiness signal means that query failed — an
 * unreachable backend renders the app without persisting anything: it must
 * neither trap the user in onboarding nor mark done a database it never saw.
 * Existing data means a pre-feature install: mark 'done' so future boots
 * skip the probe entirely.
 */
export function decideFirstRun(
  exercisesEmpty: boolean | undefined,
  workoutsEmpty: boolean | undefined,
): FirstRunDecision {
  if (exercisesEmpty === undefined || workoutsEmpty === undefined) return 'app'
  return exercisesEmpty && workoutsEmpty ? 'wizard' : 'app-mark-done'
}

export type OnboardingGateStatus = 'pending' | 'wizard' | 'app'

/**
 * First-run gate: decides ONCE per session whether the wizard takes over.
 *
 * - flag `'done'` → app immediately, probe queries never run.
 * - flag `'replay'` → wizard, at any time (Settings writes it live).
 * - flag absent → probe the two lists (`retry: false`, so a downed backend
 *   errors fast instead of blank-screening through retries) and decide
 *   permanently for the session; `'pending'` until then, so a genuine first
 *   run never flashes the shell before the wizard.
 *
 * The decision is sticky state, not derived: deleting the last exercise or
 * importing an empty backup mid-session must not re-summon the wizard when
 * the shared queries refetch to empty. Only flag transitions ('replay'
 * written, or the wizard finishing) change what renders after that.
 */
export function useOnboardingGate(): { status: OnboardingGateStatus; onDone: () => void } {
  const flag = useOnboardingFlag()
  const [decision, setDecision] = useState<'wizard' | 'app' | null>(null)
  // The wizard can exit without managing to persist 'done' (storage
  // unavailable); dismissal still has to land the user in the app.
  const [dismissed, setDismissed] = useState(false)

  const probing = flag === null && decision === null
  const exercises = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
    enabled: probing,
    retry: false,
  })
  const workouts = useQuery({
    queryKey: ['workouts'],
    queryFn: () => api.workouts.list(),
    enabled: probing,
    retry: false,
  })

  useEffect(() => {
    if (flag === 'replay') setDismissed(false)
  }, [flag])

  const exercisesEmpty = exercises.isSuccess ? exercises.data.length === 0 : undefined
  const workoutsEmpty = workouts.isSuccess ? workouts.data.length === 0 : undefined
  const settled =
    (exercises.isSuccess || exercises.isError) && (workouts.isSuccess || workouts.isError)

  useEffect(() => {
    if (!probing || !settled) return
    const result = decideFirstRun(exercisesEmpty, workoutsEmpty)
    if (result === 'app-mark-done') saveOnboardingFlag('done')
    setDecision(result === 'wizard' ? 'wizard' : 'app')
  }, [probing, settled, exercisesEmpty, workoutsEmpty])

  const onDone = () => setDismissed(true)

  if (flag === 'replay') return { status: dismissed ? 'app' : 'wizard', onDone }
  if (flag === 'done') return { status: 'app', onDone }
  if (decision === null) return { status: 'pending', onDone }
  return { status: decision === 'wizard' && !dismissed ? 'wizard' : 'app', onDone }
}
