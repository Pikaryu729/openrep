import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getInstallCapture,
  promptInstall,
  subscribeToInstallCapture,
} from '@/lib/installPrompt'

function isStandalone(): boolean {
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari has no `display-mode: standalone` support pre-install; it
  // exposes this nonstandard boolean on `navigator` instead.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  return displayModeStandalone || iosStandalone
}

function isIOS(): boolean {
  // The MSStream check excludes old IE Mobile false positives (its UA also
  // matches the iPad/iPhone/iPod regex).
  if ((window as unknown as { MSStream?: unknown }).MSStream) return false
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true
  // iPadOS 13+ requests desktop sites by default and reports a Mac UA, so the
  // regex above misses every modern iPad. Touch points are what separate the
  // two: a real Mac reports 0, an iPad reports 5.
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
}

export type InstallState =
  | { status: 'installed' }
  | { status: 'installable'; promptInstall: () => Promise<void> }
  | { status: 'ios' }
  | { status: 'unavailable' }

/** Classifies the current platform's install affordance: already installed
 * (render nothing), a native `beforeinstallprompt` available (Android/
 * Chrome), iOS Safari with no install API (show manual instructions), or
 * neither (e.g. desktop Firefox — render nothing rather than a stale button
 * with no handler). */
export function useInstallPrompt(): InstallState {
  // The `beforeinstallprompt` event is captured at the app shell, not here:
  // it fires early and only once, so a listener owned by this card would miss
  // it whenever the user was on any other route. See `lib/installPrompt.ts`.
  const { deferredEvent, installed } = useSyncExternalStore(
    subscribeToInstallCapture,
    getInstallCapture,
  )

  if (installed || isStandalone()) return { status: 'installed' }
  if (deferredEvent) return { status: 'installable', promptInstall }
  if (isIOS()) return { status: 'ios' }
  return { status: 'unavailable' }
}

/** Settings card offering to install OpenRep to the home screen. Follows the
 * `OnboardingCard` pattern in `routes/settings.tsx`: a `Card` with a single
 * labeled row. Renders nothing once installed, and on platforms with neither
 * a native install prompt nor iOS's manual flow. */
export function InstallPrompt() {
  const install = useInstallPrompt()

  if (install.status === 'installed' || install.status === 'unavailable') {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Install OpenRep</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {install.status === 'installable' ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-32 text-sm font-medium text-muted-foreground">
              Add to your device
            </span>
            <Button onClick={() => void install.promptInstall()}>Install</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-32 text-sm font-medium text-muted-foreground">
              Add to Home Screen
            </span>
            <span className="text-sm text-muted-foreground">
              Tap the Share icon, then &quot;Add to Home Screen&quot;.
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Installs OpenRep as an app on this device, with no browser chrome.
        </p>
      </CardContent>
    </Card>
  )
}
