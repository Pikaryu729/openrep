// `beforeinstallprompt` has no official TS DOM type (it's Chromium-only, not
// part of any web standard) — declare the shape we actually use rather than
// pulling in a dependency for it.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** Shared, app-shell-scoped capture of Chromium's `beforeinstallprompt`.
 *
 * Chrome fires the event once per page load, shortly after the service worker
 * activates and the manifest validates — long before the user is likely to
 * open Settings, where `<InstallPrompt>` lives. The event is dropped outright
 * if nothing is listening at that moment, so a listener owned by the Settings
 * card missed it for the entire SPA session: the install card then rendered
 * nothing at all, and the Android/Chrome install path silently disappeared
 * until a full reload performed with Settings already open.
 *
 * Capture therefore starts once from `main.tsx`, at the app shell, and the
 * card reads whatever was captured from here. This module owns only the
 * *event*; whether the app is already running standalone stays a per-render
 * check in the hook, since that answer can differ per platform and per call.
 */

type InstallCapture = {
  deferredEvent: BeforeInstallPromptEvent | null
  /** Set by the `appinstalled` event. Distinct from a `display-mode:
   * standalone` check, which the hook evaluates separately at render time. */
  installed: boolean
}

// `useSyncExternalStore` compares snapshots by reference and re-renders on any
// change, so this object is replaced only when the capture actually changes —
// never rebuilt per `getInstallCapture()` call.
let capture: InstallCapture = { deferredEvent: null, installed: false }

const listeners = new Set<() => void>()
let stopCapture: (() => void) | null = null

function setCapture(next: InstallCapture): void {
  capture = next
  for (const listener of listeners) listener()
}

export function getInstallCapture(): InstallCapture {
  return capture
}

export function subscribeToInstallCapture(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Runs the captured prompt, if any. The browser allows a captured event to be
 * used only once, so it is cleared either way — a dismissed prompt must not
 * leave a dead "Install" button behind. */
export async function promptInstall(): Promise<void> {
  const event = capture.deferredEvent
  if (!event) return
  setCapture({ ...capture, deferredEvent: null })
  await event.prompt()
}

/** Starts listening for install-related events. Called once from `main.tsx`
 * so capture is live for the whole session regardless of the current route —
 * that placement is the entire point (see the module comment). Idempotent;
 * returns a stop function used by tests. */
export function startInstallPromptCapture(): () => void {
  if (stopCapture) return stopCapture

  const onBeforeInstallPrompt = (event: Event) => {
    // Chrome only re-offers the prompt later, on demand, if this default is
    // suppressed here.
    event.preventDefault()
    setCapture({ ...capture, deferredEvent: event as BeforeInstallPromptEvent })
  }
  const onAppInstalled = () => {
    setCapture({ deferredEvent: null, installed: true })
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)

  stopCapture = () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onAppInstalled)
    stopCapture = null
    // Reset silently rather than through `setCapture`: teardown must not
    // re-render subscribers that are on their way out, and nothing in the app
    // ever stops capture — only tests do.
    capture = { deferredEvent: null, installed: false }
  }
  return stopCapture
}
