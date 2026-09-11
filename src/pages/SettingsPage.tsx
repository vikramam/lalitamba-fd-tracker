import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Page } from '@/components/Page'
import { ShimmerSettingsHome } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { exportHouseholdExcel } from '@/lib/export-household'
import {
  applyFontScale,
  fontScaleLabel,
  readFontScale,
  stepFontScale,
  type FontScale,
} from '@/lib/font-scale'
import { ALL_FAMILIES_SCOPE } from '@/lib/household-scope'
import { initials } from '@/lib/initials'
import { canManageMembers } from '@/lib/members'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'
import type { Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { household, allHousehold, loading, familyScope } = useHousehold()
  const { alertError } = useDialog()
  const canManage = household ? canManageMembers(household) : false
  const [theme, setTheme] = useState<Theme>(() => readTheme())
  const [fontScale, setFontScale] = useState<FontScale>(() => readFontScale())
  const [exporting, setExporting] = useState(false)

  if (loading) return <ShimmerSettingsHome />

  const displayName = accountName(user?.id, user?.email, allHousehold)
  const roleLabel = accountRole(household)
  const familyLabel = familyPill(familyScope, household)

  function onTheme(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  function onFontScale(delta: -1 | 1) {
    const next = stepFontScale(fontScale, delta)
    setFontScale(next)
    applyFontScale(next)
  }

  async function onExport() {
    if (!household || exporting) return
    setExporting(true)
    try {
      exportHouseholdExcel(household)
    } catch (cause) {
      void alertError(cause, 'Could not export that file.')
    } finally {
      setExporting(false)
    }
  }

  const tools: ToolTileProps[] = []
  if (household?.isAppAdmin) {
    tools.push({ title: 'Accounts', hint: 'Approvals', to: '/settings/accounts' })
  }
  if (household && canManage) {
    tools.push({ title: 'Family', hint: 'Add or edit', to: '/settings/families' })
    tools.push({ title: 'Move FDs', hint: 'Reassign', to: '/settings/move-fds' })
  }
  if (household) {
    tools.push({
      title: 'Export',
      hint: exporting ? 'Exporting…' : 'Excel file',
      disabled: exporting,
      onClick: () => void onExport(),
    })
  }

  return (
    <Page>
      <h1 className="type-page-title text-ink">Settings</h1>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-inner type-micro font-semibold text-ink">
            {initials(displayName)}
          </span>
          <div className="min-w-0">
            <p className="type-card-title truncate text-ink">{displayName}</p>
            <p className="type-small">{roleLabel}</p>
          </div>
        </div>
        <span className="max-w-[9.5rem] shrink-0 truncate rounded-full border border-line px-2.5 py-0.5 type-small">
          {familyLabel}
        </span>
      </div>

      {tools.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {tools.map((tool, index) => (
            <ToolTile
              key={tool.title}
              {...tool}
              wide={tools.length % 2 === 1 && index === tools.length - 1}
            />
          ))}
        </div>
      ) : null}

      <section className="surface-card mt-3.5 divide-y divide-line overflow-hidden">
        <SettingsRow label="Theme">
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((option) => (
              <Segment
                key={option}
                selected={theme === option}
                onClick={() => onTheme(option)}
              >
                {option === 'dark' ? 'Dark' : 'Light'}
              </Segment>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Text size">
          <div className="flex items-center gap-2">
            <Segment
              compact
              disabled={fontScale === 0.9}
              ariaLabel="Decrease text size"
              onClick={() => onFontScale(-1)}
            >
              A−
            </Segment>
            <p className="type-small min-w-16 text-center text-ink" aria-live="polite">
              {fontScaleLabel(fontScale)}
            </p>
            <Segment
              compact
              disabled={fontScale === 1.3}
              ariaLabel="Increase text size"
              onClick={() => onFontScale(1)}
            >
              A+
            </Segment>
          </div>
        </SettingsRow>
        <SettingsRow label="Email">
          <p className="type-small max-w-[14rem] truncate text-right">{user?.email}</p>
        </SettingsRow>
      </section>

      <Button variant="outline" size="lg" className="mt-4 text-danger" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Page>
  )
}

function accountName(userId: string | undefined, email: string | undefined, household: Household | null) {
  const linked = household?.members.find((member) => member.linked_user_id === userId)
  const fromMember = linked?.display_name?.trim() || linked?.full_name?.trim()
  if (fromMember) return fromMember
  const local = email?.split('@')[0]?.trim()
  if (!local) return 'Account'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function accountRole(household: Household | null) {
  if (!household) return 'Member'
  if (household.isSuperAdmin) return 'Super admin'
  if (household.isAppAdmin) return 'App admin'
  if (household.families[0]?.role === 'family_admin') return 'Family admin'
  if (household.families.length === 0) return 'No family yet'
  return 'Member'
}

function familyPill(familyScope: string, household: Household | null) {
  if (!household || household.families.length === 0) return 'No family'
  if (household.families.length === 1) return household.families[0].name
  if (familyScope === ALL_FAMILIES_SCOPE) return 'All families'
  return household.families[0]?.name ?? 'No family'
}

function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <p className="type-body text-ink">{label}</p>
      {children}
    </div>
  )
}

function Segment({
  children,
  selected,
  compact,
  disabled,
  ariaLabel,
  onClick,
}: {
  children: string
  selected?: boolean
  compact?: boolean
  disabled?: boolean
  ariaLabel?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border type-small font-semibold disabled:opacity-50',
        compact ? 'px-2 py-1' : 'px-3 py-1',
        selected ? 'border-line bg-inner text-ink' : 'border-line bg-transparent text-muted',
      )}
    >
      {children}
    </button>
  )
}

type ToolTileProps = {
  title: string
  hint: string
  to?: string
  onClick?: () => void
  disabled?: boolean
  wide?: boolean
}

function ToolTile({ title, hint, to, onClick, disabled, wide }: ToolTileProps) {
  const className = cn(
    'surface-card flex min-h-[84px] flex-col items-start justify-center p-3.5 text-left',
    wide && 'col-span-2',
    disabled && 'opacity-60',
  )
  const body = (
    <>
      <p className="type-card-title text-ink">{title}</p>
      <p className="type-small mt-0.5">{hint}</p>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {body}
    </button>
  )
}
