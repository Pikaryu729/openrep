import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ChevronRightIcon,
  ChartNoAxesCombinedIcon,
  DumbbellIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  NotebookPenIcon,
  SettingsIcon,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { LogoSymbol, LogoWordmark } from '@/components/Logo'
import { api } from '@/lib/api'

const RECENT_WORKOUTS_COUNT = 5

const NAV_ITEMS = [
  { title: 'Dashboard', to: '/', exact: true, icon: LayoutDashboardIcon },
  { title: 'Workouts', to: '/workouts', icon: NotebookPenIcon },
  { title: 'Exercises', to: '/exercises', icon: DumbbellIcon },
  { title: 'Widgets', to: '/widgets', icon: ChartNoAxesCombinedIcon },
  { title: 'Settings', to: '/settings', icon: SettingsIcon },
] as const

const activeLinkClass =
  'data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-primary'

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="h-16 justify-center">
              <Link to="/" aria-label="OpenRep home">
                <LogoSymbol className="size-9" />
                <LogoWordmark className="text-xl" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.title} className={activeLinkClass}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: 'exact' in item && item.exact }}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <RecentWorkoutsGroup />
      </SidebarContent>
    </Sidebar>
  )
}

function RecentWorkoutsGroup() {
  const { data: workouts, isLoading } = useQuery({
    queryKey: ['workouts'],
    queryFn: () => api.workouts.list(),
  })
  const recent = workouts?.slice(0, RECENT_WORKOUTS_COUNT) ?? []

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger>
            <HistoryIcon className="mr-1.5 size-3.5" />
            Recent workouts
            <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))
              ) : recent.length === 0 ? (
                <SidebarMenuItem>
                  <span className="px-2 py-1.5 text-xs text-muted-foreground">
                    No workouts yet
                  </span>
                </SidebarMenuItem>
              ) : (
                <SidebarMenuSub className="mx-0 border-none px-1">
                  {recent.map((workout) => (
                    <SidebarMenuSubItem key={workout.id}>
                      <SidebarMenuSubButton asChild className={activeLinkClass}>
                        <Link
                          to="/workouts/$workoutId"
                          params={{ workoutId: String(workout.id) }}
                        >
                          <span>{workout.performed_on}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
