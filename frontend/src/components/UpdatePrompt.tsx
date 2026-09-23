import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** App-wide banner offering to activate a newly installed service worker.
 * `registerType: 'prompt'` (vite.config.ts) means the new worker sits
 * "waiting" rather than taking over silently — this is the only place that
 * calls `updateServiceWorker`, and only in response to the user clicking
 * Reload. No auto-dismiss, no auto-reload timer: a silent swap mid-set would
 * discard in-progress workout-logging state. This component owns the app's
 * one `useRegisterSW()` registration (`main.tsx` no longer calls the
 * imperative `registerSW()` — calling both would register the service
 * worker twice). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex justify-center p-3"
      style={{
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(0.75rem + env(safe-area-inset-left))',
        paddingRight: 'calc(0.75rem + env(safe-area-inset-right))',
      }}
    >
      <Card className="w-auto flex-row items-center gap-4 py-3 shadow-lg">
        <CardContent className="flex items-center gap-3 px-4">
          <span className="text-sm font-medium">Update available</span>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
