import { useSyncExternalStore } from 'react'

export type UnitSystem = 'metric' | 'imperial'

export const UNITS_STORAGE_KEY = 'openrep.units'

const KG_PER_LB = 0.45359237

const listeners = new Set<() => void>()

export function loadUnits(): UnitSystem {
  try {
    return localStorage.getItem(UNITS_STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export function saveUnits(units: UnitSystem): void {
  localStorage.setItem(UNITS_STORAGE_KEY, units)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Reactive units preference — re-renders subscribers when settings change it. */
export function useUnits(): UnitSystem {
  return useSyncExternalStore(subscribe, loadUnits, () => 'metric')
}

export function weightUnit(units: UnitSystem): 'kg' | 'lb' {
  return units === 'metric' ? 'kg' : 'lb'
}

/** Canonical kg → display number. Metric passes through untouched; imperial
 * converts to pounds rounded to one decimal. */
export function kgToDisplay(kg: number, units: UnitSystem): number {
  if (units === 'metric') return kg
  return Math.round((kg / KG_PER_LB) * 10) / 10
}

/** User-entered display number → canonical kg for the API. Metric passes
 * through untouched; imperial converts from pounds rounded to two decimals. */
export function displayToKg(value: number, units: UnitSystem): number {
  if (units === 'metric') return value
  return Math.round(value * KG_PER_LB * 100) / 100
}
