import { LogoSymbol, LogoWordmark } from '@/components/Logo'

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <LogoSymbol className="size-14" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome to <LogoWordmark className="text-2xl" />
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        A local-first strength training tracker. Everything you log lives in a database on your
        own machine — no account, no cloud, no sync.
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Let&apos;s set a few preferences and stock your exercise library. It takes about a minute,
        and everything here can be changed later in Settings.
      </p>
    </div>
  )
}
