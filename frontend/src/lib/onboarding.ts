import { useSyncExternalStore } from 'react'

/**
 * First-run onboarding state.
 *
 * - `null` (key absent): auto-detect — show the wizard only for a fresh database.
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
  localStorage.setItem(ONBOARDING_STORAGE_KEY, flag)
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

/**
 * Whether the first-run wizard should take over the shell.
 *
 * `undefined` for either emptiness signal means that query is still pending or
 * failed — only data confirmed empty counts as a fresh install, so an
 * unreachable backend renders the app normally instead of trapping the user
 * in onboarding.
 */
export function shouldShowOnboarding(
  flag: OnboardingFlag,
  exercisesEmpty: boolean | undefined,
  workoutsEmpty: boolean | undefined,
): boolean {
  if (flag === 'replay') return true
  if (flag === 'done') return false
  return exercisesEmpty === true && workoutsEmpty === true
}
