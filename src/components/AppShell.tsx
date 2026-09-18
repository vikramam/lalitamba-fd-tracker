import { useLayoutEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { AppLogo } from '@/components/AppLogo'
import { DemoBanner } from '@/components/DemoBanner'
import { FamilySwitcher } from '@/components/FamilySwitcher'
import { SetupBanner } from '@/components/SetupBanner'
import { GearIcon, HomeIcon, LedgerIcon, PassbookIcon, PeopleIcon } from '@/components/icons'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/dashboard', label: 'Home', end: true, icon: HomeIcon },
  { to: '/fds', label: 'FDs', end: true, icon: LedgerIcon },
  { to: '/passbooks', label: 'Passbook', end: false, icon: PassbookIcon },
  { to: '/members', label: 'Members', end: false, icon: PeopleIcon },
  { to: '/settings', label: 'Settings', end: true, icon: GearIcon },
]

export function AppShell() {
  const { canSwitchFamily } = useHousehold()
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-canvas supports-[height:100dvh]:h-dvh">
      <DemoBanner />
      <SetupBanner />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-line px-4 py-8 md:block">
          <div className="flex items-center gap-2.5 px-2">
            <AppLogo className="size-10" />
            <div>
              <p className="type-app-bar">Lalitamba FD</p>
              <p className="type-small">Gadag</p>
            </div>
          </div>
          <FamilySwitcher className="mt-6" />
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

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-none"
        >
          <Outlet />
        </div>
      </div>

      <nav
        className="z-10 shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        style={{ background: 'var(--bar-bg)' }}
      >
        <div
          className={cn(
            'mx-auto grid max-w-lg',
            canSwitchFamily ? 'grid-cols-6' : 'grid-cols-5',
          )}
        >
          {tabs.slice(0, 4).map((tab) => (
            <MobileTab key={tab.to} tab={tab} />
          ))}
          <FamilySwitcher variant="tab" />
          <MobileTab tab={tabs[4]!} />
        </div>
      </nav>
    </div>
  )
}

function MobileTab({
  tab,
}: {
  tab: (typeof tabs)[number]
}) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium leading-tight',
          isActive ? 'text-accent' : 'text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <tab.icon className="size-[22px]" />
          {tab.label}
          {isActive ? (
            <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-accent" />
          ) : null}
        </>
      )}
    </NavLink>
  )
}
