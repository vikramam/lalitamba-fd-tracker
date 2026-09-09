import { NavLink, Outlet } from 'react-router-dom'

import { AppLogo } from '@/components/AppLogo'
import { DemoBanner } from '@/components/DemoBanner'
import { SetupBanner } from '@/components/SetupBanner'
import { GearIcon, HomeIcon, LedgerIcon, PeopleIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/dashboard', label: 'Home', end: true, icon: HomeIcon },
  { to: '/members', label: 'Members', end: false, icon: PeopleIcon },
  { to: '/fds', label: 'FDs', end: true, icon: LedgerIcon },
  { to: '/settings', label: 'Settings', end: true, icon: GearIcon },
]

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <DemoBanner />
      <SetupBanner />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="hidden w-52 shrink-0 border-r border-line px-4 py-8 md:block">
          <div className="flex items-center gap-2.5 px-2">
            <AppLogo className="size-10 rounded-xl" />
            <div>
              <p className="type-app-bar">Lalitamba FD</p>
              <p className="type-small">Gadag</p>
            </div>
          </div>
          <nav className="mt-8 flex flex-col gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'type-body flex items-center gap-2 rounded-xl px-2 py-2 font-medium',
                    isActive ? 'bg-surface text-accent' : 'text-muted hover:text-ink',
                  )
                }
              >
                <tab.icon className="size-4" />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <Outlet />
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        style={{ background: 'var(--bar-bg)' }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'type-micro relative flex flex-col items-center gap-1 py-2.5 font-medium',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon className="size-[18px]" />
                  {tab.label}
                  {isActive ? (
                    <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-accent" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
