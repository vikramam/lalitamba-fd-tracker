import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ChevronIcon } from '@/components/icons'
import { ListRow } from '@/components/ListRow'
import { Page } from '@/components/Page'
import { ShimmerDashboard } from '@/components/Shimmer'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { daysUntil, summarizeDashboard, type DashboardSummary, type MemberTotal } from '@/lib/dashboard'
import { ALL_FAMILIES_SCOPE } from '@/lib/household-scope'
import {
  formatDate,
  formatDateShort,
  formatDaysOverdue,
  formatDaysUntil,
  formatInr,
  formatInrLakhs,
  formatInterestMode,
} from '@/lib/format'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { user } = useAuth()
  const { household, loading, error, familyScope } = useHousehold()
  const { alert } = useDialog()

  useEffect(() => {
    if (error) void alert('Could not load', error)
  }, [alert, error])
  const firstName = user?.email.split('@')[0] ?? 'there'
  const summary = summarizeDashboard(household?.deposits ?? [], household?.members ?? [])
  const familyLabel =
    familyScope === ALL_FAMILIES_SCOPE
      ? 'All families'
      : household?.families.map((family) => family.name).join(', ') || 'No family yet'

  if (loading) return <ShimmerDashboard />

  return (
    <Page>
      <p className="type-hero-heading text-ink">
        Hello, {firstName}
      </p>
      <p className="mt-1 type-body text-muted">{familyLabel}</p>

      <SummaryCarousel
        summary={summary}
        people={household?.members.length ?? 0}
        eyebrow={familyLabel === 'No family yet' ? 'Household' : familyLabel}
      />

      {summary.pastDue.length > 0 ? (
        <Section title="Past due" to="/fds?due=overdue">
          <ul className="space-y-2">
            {summary.pastDue.map((fd) => {
              const member = household?.members.find((row) => row.id === fd.family_member_id)
              const owner = member?.display_name || member?.full_name || fd.holder_name || 'Unknown'
              const days = daysUntil(fd.maturity_date)
              const dueDate = fd.maturity_date ? formatDateShort(fd.maturity_date) : 'no date'
              const overdue = days !== null && days < 0 ? formatDaysOverdue(days) : null
              return (
                <ListRow
                  key={fd.id}
                  to={`/fds/${fd.id}`}
                  title={fd.fd_account_no ?? 'FD'}
                  subtitle={`${owner} · ${formatInterestMode(fd.interest_mode)} · ${dueDate}${overdue ? ` · ${overdue}` : ''}`}
                  trailing={<span className="type-list-value">{formatInr(fd.principal_amount)}</span>}
                  tone="danger"
                />
              )
            })}
          </ul>
        </Section>
      ) : null}

      <Section title="Due in 90 days" to="/fds?due=90">
        {summary.upcoming.length === 0 ? (
          <p className="px-1 py-3 type-body text-muted">Nothing maturing in the next 90 days.</p>
        ) : (
          <ul className="space-y-2">
            {summary.upcoming.map(({ fd, days }) => {
              const member = household?.members.find((row) => row.id === fd.family_member_id)
              const owner = member?.display_name || member?.full_name || fd.holder_name || 'Unknown'
              return (
                <ListRow
                  key={fd.id}
                  to={`/fds/${fd.id}`}
                  title={fd.fd_account_no ?? 'FD'}
                  subtitle={`${owner} · ${formatDaysUntil(days)}`}
                  trailing={<span className="type-list-value">{formatInr(fd.principal_amount)}</span>}
                  tone={days <= 30 ? 'warn' : 'default'}
                />
              )
            })}
          </ul>
        )}
      </Section>

      {summary.matured.length > 0 ? (
        <Section title="Already matured">
          <ul className="space-y-2">
            {summary.matured.map((fd) => (
              <ListRow
                key={fd.id}
                to={`/fds/${fd.id}`}
                title={fd.fd_account_no ?? 'FD'}
                subtitle={`${formatInterestMode(fd.interest_mode)} · ${fd.maturity_date ? formatDate(fd.maturity_date) : 'matured'}`}
                trailing={<span className="type-list-value">{formatInr(fd.principal_amount)}</span>}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {household && household.families.length === 0 ? (
        <p className="mt-8 type-body text-muted">
          Create a family on Members or Settings, then add people.
        </p>
      ) : summary.activeCount === 0 ? (
        <p className="mt-8 type-body text-muted">No active deposits in your access scope.</p>
      ) : null}
    </Page>
  )
}

function SummaryCarousel({
  summary,
  people,
  eyebrow,
}: {
  summary: DashboardSummary
  people: number
  eyebrow: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const slides = [
    { id: 'all', kind: 'overall' as const },
    ...summary.byMember.map((member) => ({ id: member.memberId, kind: 'member' as const, member })),
  ]

  function goTo(index: number) {
    const node = scroller.current
    if (!node) return
    const child = node.children[index] as HTMLElement | undefined
    child?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    setActive(index)
  }

  function onScroll() {
    const node = scroller.current
    if (!node) return
    const slide = node.children[0] as HTMLElement | undefined
    if (!slide) return
    const gap = Number.parseFloat(getComputedStyle(node).columnGap || '0') || 0
    const step = slide.offsetWidth + gap
    if (step === 0) return
    const next = Math.round(node.scrollLeft / step)
    if (next !== active) setActive(next)
  }

  return (
    <div className="mt-6">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar grid auto-cols-[100%] grid-flow-col items-start gap-3 overflow-x-auto snap-x snap-mandatory"
      >
        <div className="flex h-full snap-start flex-col">
          <OverallSlide summary={summary} people={people} eyebrow={eyebrow} />
        </div>
        {summary.byMember.map((member) => (
          <div key={member.memberId} className="flex h-full snap-start flex-col">
            <MemberSlide member={member} />
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={slide.kind === 'overall' ? 'Show all families' : `Show ${slide.member.name}`}
                onClick={() => goTo(index)}
                className={cn(
                  'h-2 rounded-full border-0 p-0',
                  index === active ? 'w-[18px] bg-accent' : 'w-2 bg-inner',
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  'rounded-full px-3 py-1 type-small',
                  index === active
                    ? 'brand-gradient'
                    : 'border border-line bg-surface text-[color:var(--chip-text)]',
                )}
              >
                {slide.kind === 'overall' ? 'All' : slide.member.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function OverallSlide({
  summary,
  people,
  eyebrow,
}: {
  summary: DashboardSummary
  people: number
  eyebrow: string
}) {
  return (
    <section className="hero-card relative flex flex-col overflow-hidden p-5">
      <img src="/updated_logo_2.jpeg" alt="" aria-hidden="true" className="hero-logo-mark" />
      <div className="relative z-10 max-w-[62%]">
        <p className="type-label">{eyebrow}</p>
        <p className="type-card-title mt-1.5 text-ink">Principal outstanding</p>
        <p className="type-stat-hero mt-3 text-ink">{formatInrLakhs(summary.principal)}</p>
        {summary.dueThisMonth.length > 0 ? (
          <Link to="/fds?due=month" className="type-body mt-2 block text-warn">
            <span className="type-num">{summary.dueThisMonth.length}</span>
            {summary.dueThisMonth.length === 1 ? ' FD is due this month' : ' FDs are due this month'}
          </Link>
        ) : null}
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-3 grid-rows-2 gap-2">
        <Stat label="FDs" value={String(summary.activeCount)} to="/fds" wash />
        <Stat
          label="/ month"
          value={formatInr(summary.monthlyIncome)}
          count={summary.monthlyFdCount}
          to="/fds?mode=monthly"
          wash
        />
        <Stat
          label="/ quarter"
          value={formatInr(summary.quarterlyIncome)}
          count={summary.quarterlyFdCount}
          to="/fds?mode=quarterly"
          wash
        />
        <Stat
          label="Maturity"
          value={formatInrLakhs(summary.maturityTotal)}
          count={summary.onMaturityFdCount}
          to="/fds?view=maturity"
          wash
        />
        <Stat label="Credited" value={formatInr(summary.interestCredited)} to="/fds?view=credited" wash />
        <Stat label="People" value={String(people)} to="/members" wash />
      </div>
    </section>
  )
}

function MemberSlide({ member }: { member: MemberTotal }) {
  const memberQuery = `member=${member.memberId}`
  return (
    <section className="hero-card relative flex flex-col overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner type-micro font-semibold text-ink">
              {initials(member.name)}
            </span>
            <p className="type-card-title truncate text-ink">{member.name}</p>
          </div>
          <p className="type-stat-hero mt-3 text-ink">{formatInrLakhs(member.principal)}</p>
        </div>
        <div className="flex w-[7.25rem] shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full border border-line px-2.5 py-0.5 type-small">Member</span>
          {member.pastDueCount > 0 ? (
            <Link
              to={`/fds?${memberQuery}&due=overdue`}
              className="due-chip-3d due-chip-3d-danger"
            >
              {member.pastDueCount} overdue
            </Link>
          ) : null}
          {member.dueThisMonthCount > 0 ? (
            <Link
              to={`/fds?${memberQuery}&due=month`}
              className="due-chip-3d due-chip-3d-warn"
            >
              {member.dueThisMonthCount} this month
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 grid-rows-2 gap-2">
        <Stat label="FDs" value={String(member.count)} to={`/fds?${memberQuery}`} />
        <Stat
          label="/ month"
          value={formatInr(member.monthlyIncome)}
          count={member.monthlyFds}
          to={`/fds?${memberQuery}&mode=monthly`}
        />
        <Stat
          label="/ quarter"
          value={formatInr(member.quarterlyIncome)}
          count={member.quarterlyFds}
          to={`/fds?${memberQuery}&mode=quarterly`}
        />
        <Stat
          label="Maturity"
          value={formatInrLakhs(member.maturityTotal)}
          count={member.onMaturityFds}
          to={`/fds?${memberQuery}&view=maturity`}
        />
        <Stat
          label="Credited"
          value={formatInr(member.interestCredited)}
          to={`/fds?${memberQuery}&view=credited`}
        />
        <div className="invisible" aria-hidden="true" />
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  count,
  to,
  wash,
}: {
  label: string
  value: string
  count?: number
  to?: string
  wash?: boolean
}) {
  const body = (
    <>
      <div className="mb-0.5 flex h-4 w-full justify-end">
        {count != null ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-inner px-1 type-micro font-semibold">
            {count}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'type-stat-secondary w-full whitespace-nowrap text-ink [overflow-wrap:normal]',
          value.length >= 10 && 'text-[14px]',
          value.length >= 12 && 'text-[12.5px]',
        )}
      >
        {value}
      </p>
      <p className="type-label mt-0.5">{label}</p>
    </>
  )
  const className = cn(
    'surface-card relative flex flex-col items-center px-2 py-2 text-center',
    wash && 'hero-stat',
    to && 'hover:bg-inner',
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
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
          <p className="type-card-title text-ink">{title}</p>
          <ChevronIcon className="text-[color:var(--text-tertiary)]" />
        </Link>
      ) : (
        <p className="type-card-title mb-3 text-ink">{title}</p>
      )}
      {children}
    </section>
  )
}
