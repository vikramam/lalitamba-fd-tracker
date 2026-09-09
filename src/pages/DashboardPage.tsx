import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ChevronIcon } from '@/components/icons'
import { ListRow } from '@/components/ListRow'
import { Page } from '@/components/Page'
import { ShimmerDashboard } from '@/components/Shimmer'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { summarizeDashboard } from '@/lib/dashboard'
import { formatDate, formatDaysUntil, formatInr, formatInrLakhs, formatInterestMode } from '@/lib/format'

export function DashboardPage() {
  const { user } = useAuth()
  const { household, loading, error } = useHousehold()
  const { alert } = useDialog()

  useEffect(() => {
    if (error) void alert('Could not load', error)
  }, [alert, error])
  const firstName = user?.email.split('@')[0] ?? 'there'
  const summary = summarizeDashboard(household?.deposits ?? [], household?.members ?? [])
  const familyLabel = household?.isAppAdmin
    ? 'All families'
    : household?.families.map((family) => family.name).join(', ') || 'No family yet'

  if (loading) return <ShimmerDashboard />

  return (
    <Page>
      <p className="font-display text-[26px] font-bold tracking-tight text-ink">
        Hello, {firstName}
      </p>
      <p className="mt-1 text-[13px] text-muted">{familyLabel}</p>

      <section className="hero-card mt-6 p-5">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          Principal outstanding
        </p>
        <p className="mt-3 font-mono text-[26px] font-semibold tracking-tight text-ink">
          {formatInrLakhs(summary.principal)}
        </p>
        <p className="mt-1 text-[12px] text-muted">Active deposits only</p>
        {summary.dueThisMonth.length > 0 ? (
          <Link to="/fds?due=month" className="mt-3 block text-[13px] text-warn">
            {summary.dueThisMonth.length === 1
              ? '1 FD is due this month'
              : `${summary.dueThisMonth.length} FDs are due this month`}
          </Link>
        ) : null}
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="FDs" value={String(summary.activeCount)} to="/fds" />
        <Stat label="/ month" value={formatInr(summary.monthlyIncome)} to="/fds?mode=monthly" />
        <Stat label="/ quarter" value={formatInr(summary.quarterlyIncome)} to="/fds?mode=quarterly" />
        <Stat label="Maturity" value={formatInrLakhs(summary.maturityTotal)} to="/fds?view=maturity" />
        <Stat label="Credited" value={formatInr(summary.interestCredited)} to="/fds?view=credited" />
        <Stat label="People" value={String(household?.members.length ?? 0)} to="/members" />
      </div>

      <Section title="Due in 90 days" to="/fds?due=90">
        {summary.upcoming.length === 0 ? (
          <p className="px-1 py-3 text-[13px] text-muted">Nothing maturing in the next 90 days.</p>
        ) : (
          <ul className="space-y-2">
            {summary.upcoming.map(({ fd, days }) => {
              const member = household?.members.find((row) => row.id === fd.family_member_id)
              return (
                <ListRow
                  key={fd.id}
                  to={`/fds/${fd.id}`}
                  title={member?.display_name || member?.full_name || fd.holder_name || 'Unknown'}
                  subtitle={`${fd.fd_account_no ?? 'FD'} · ${formatDaysUntil(days)}`}
                  trailing={<span className="font-mono text-[13px]">{formatInr(fd.principal_amount)}</span>}
                  tone={days <= 30 ? 'warn' : 'default'}
                />
              )
            })}
          </ul>
        )}
      </Section>

      {summary.pastDue.length > 0 ? (
        <Section title="Past due">
          <ul className="space-y-2">
            {summary.pastDue.map((fd) => (
              <ListRow
                key={fd.id}
                to={`/fds/${fd.id}`}
                title={fd.fd_account_no ?? 'FD'}
                subtitle={`${formatInterestMode(fd.interest_mode)} · ${fd.maturity_date ? formatDate(fd.maturity_date) : 'no date'}`}
                trailing={<span className="font-mono text-[13px]">{formatInr(fd.principal_amount)}</span>}
                tone="danger"
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {summary.matured.length > 0 ? (
        <Section title="Already matured">
          <ul className="space-y-2">
            {summary.matured.map((fd) => (
              <ListRow
                key={fd.id}
                to={`/fds/${fd.id}`}
                title={fd.fd_account_no ?? 'FD'}
                subtitle={`${formatInterestMode(fd.interest_mode)} · ${fd.maturity_date ? formatDate(fd.maturity_date) : 'matured'}`}
                trailing={<span className="font-mono text-[13px]">{formatInr(fd.principal_amount)}</span>}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {summary.byMember.length > 0 ? (
        <Section title="By member">
          <ul className="space-y-2">
            {summary.byMember.map((row) => (
              <ListRow
                key={row.memberId}
                to={`/fds?member=${row.memberId}`}
                title={row.name}
                subtitle={`${row.count} ${row.count === 1 ? 'FD' : 'FDs'}`}
                trailing={<span className="font-mono text-[13px]">{formatInr(row.principal)}</span>}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {household && household.families.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted">
          Create a family on Members or Settings, then add people.
        </p>
      ) : summary.activeCount === 0 ? (
        <p className="mt-8 text-[13px] text-muted">No active deposits in your access scope.</p>
      ) : null}
    </Page>
  )
}

function Stat({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = (
    <>
      <p className="font-mono text-[14px] text-ink">{value}</p>
      <p className="mt-1 text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase">
        {label}
      </p>
    </>
  )

  if (to) {
    return (
      <Link to={to} className="surface-card block px-2 py-3 text-center hover:bg-inner">
        {body}
      </Link>
    )
  }

  return <div className="surface-card px-2 py-3 text-center">{body}</div>
}

function Section({
  title,
  to,
  children,
}: {
  title: string
  to?: string
  children: ReactNode
}) {
  return (
    <section className="mt-8">
      {to ? (
        <Link to={to} className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            {title}
          </p>
          <ChevronIcon className="text-[color:var(--text-tertiary)]" />
        </Link>
      ) : (
        <p className="mb-3 text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          {title}
        </p>
      )}
      {children}
    </section>
  )
}
