import { cn } from '@/lib/utils'

/** The OpenRep barbell symbol (from assets/logo/openrep-symbol-mono.svg),
 * inlined so the bar follows currentColor and the center plate follows the
 * user's brand accent. */
export function LogoSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      <rect x="0" y="29.5" width="64" height="5" fill="currentColor" />
      <rect x="27" y="29.5" width="10" height="5" fill="var(--accent)" />
      <rect x="14" y="12" width="6" height="40" fill="currentColor" />
      <rect x="14" y="12" width="13" height="6" fill="currentColor" />
      <rect x="14" y="46" width="13" height="6" fill="currentColor" />
      <rect x="44" y="12" width="6" height="40" fill="currentColor" />
      <rect x="37" y="12" width="13" height="6" fill="currentColor" />
      <rect x="37" y="46" width="13" height="6" fill="currentColor" />
    </svg>
  )
}

/** The "openrep" wordmark: regular "open", semibold "rep" (matches
 * assets/logo/openrep-wordmark.svg, rendered as text so it inherits theme
 * colors and needs no font asset). */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-base tracking-tight', className)}>
      <span className="font-normal">open</span>
      <span className="font-semibold">rep</span>
    </span>
  )
}
