import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// `beforeinstallprompt` has no official TS DOM type (it's Chromium-only, not
// part of any web standard) — declare the shape we actually use rather than
// pulling in a dependency for it.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone(): boolean {
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari has no `display-mode: standalone` support pre-install; it
  // exposes this nonstandard boolean on `navigator` instead.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  return displayModeStandalone || iosStandalone
}

function isIOS(): boolean {
  // Standard iOS-detection idiom: the MSStream check excludes old IE Mobile
  // false positives (IE Mobile's UA also matches the iPad/iPhone/iPod regex).
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  )
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
  const [installed, setInstalled] = useState(isStandalone)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Chrome only offers the prompt later, on demand, if this default is
      // suppressed here.
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installEvent) return
    await installEvent.prompt()
    // The captured event can only be used once — clear it either way so a
    // dismissed prompt doesn't leave a dead "Install" button behind.
    setInstallEvent(null)
  }, [installEvent])

  if (installed) return { status: 'installed' }
  if (installEvent) return { status: 'installable', promptInstall }
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
