import { Link } from '@tanstack/react-router'
import { NAV_ITEMS } from '@/components/AppSidebar'
import { cn } from '@/lib/utils'

const activeLinkClass = 'data-[status=active]:text-sidebar-primary'

/** Fixed bottom tab bar shown in place of the sidebar/header on mobile
 * (<768px, see `useIsMobile` in `routes/__root.tsx`). Renders the same
 * `NAV_ITEMS` the desktop `AppSidebar` uses, so the two surfaces never drift
 * apart. */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-sidebar-border border-t bg-sidebar text-sidebar-foreground"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: 'exact' in item && item.exact }}
          className={cn('flex flex-1 flex-col items-center gap-1 py-2 text-xs', activeLinkClass)}
        >
          <item.icon className="size-5" />
          <span>{item.title}</span>
        </Link>
      ))}
    </nav>
  )
}
