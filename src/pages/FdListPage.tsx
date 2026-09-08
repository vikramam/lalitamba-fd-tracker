import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Chip, ChipGroup } from '@/components/Chip'
import { ChevronIcon } from '@/components/icons'
import { ListRow } from '@/components/ListRow'
import { AddIconLink, Page, ScreenTitle } from '@/components/Page'
import { ShimmerListPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { daysUntil, interestCreditedToDate, isDueThisMonth } from '@/lib/dashboard'
import { canWriteFds } from '@/lib/fds'
import {
  currentOnlyDefault,
  filterFdRows,
  sortFdsByMaturity,
  type FdListQuery,
} from '@/lib/fd-list'
import { formatDate, formatDaysUntil, formatInr, formatInterestMode } from '@/lib/format'
import { initials } from '@/lib/initials'
import { canManageMembers } from '@/lib/members'
import type { FamilyMember, FixedDeposit, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function FdListPage() {
  const { household, loading, error } = useHousehold()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const query: FdListQuery = {
    q: search,
    mode: params.get('mode'),
    due: params.get('due'),
    member: params.get('member'),
    status: params.get('status'),
    view: params.get('view'),
    current: params.get('current'),
  }
  const deposits = household?.deposits ?? []
  const members = household?.members ?? []
  const selectedMember = members.find((row) => row.id === query.member)
  const rows = sortFdsByMaturity(filterFdRows(deposits, members, query))
  const canWrite = household ? canWriteFds(household) : false
  const canManage = household ? canManageMembers(household) : false
  const hasMembers = members.length > 0
  const groups = groupByMember(rows, members)
  const currentOnly = currentOnlyDefault(query)
  const memberName = selectedMember
    ? selectedMember.display_name || selectedMember.full_name
    : query.member
      ? 'Member'
      : null
  const title = query.due === 'month'
    ? 'Due this month'
    : query.due === '90'
      ? 'Due in 90 days'
      : query.view === 'maturity'
        ? 'Maturity'
        : query.view === 'credited'
          ? 'Interest credited'
          : query.mode === 'on_maturity'
            ? 'Locked interest'
            : memberName
              ? memberName
              : query.mode === 'monthly'
                ? 'Monthly interest'
                : query.mode === 'quarterly'
                  ? 'Quarterly interest'
                  : query.status === 'closed'
                    ? 'Closed FDs'
                    : 'Fixed deposits'
  const intro = query.due === 'month'
    ? 'Active FDs maturing this month.'
    : query.due === '90'
      ? 'Active FDs maturing in the next 90 days.'
      : query.view === 'maturity'
        ? 'Active deposits and what they return at maturity.'
        : query.view === 'credited'
          ? 'Monthly FDs with interest already credited.'
          : query.mode === 'on_maturity'
            ? 'FDs that lock interest until maturity.'
            : memberName
              ? `Deposits held by ${memberName}.`
              : query.mode === 'monthly'
                ? 'FDs that pay interest every month.'
                : query.mode === 'quarterly'
                  ? 'FDs that pay interest every quarter.'
                  : query.status === 'closed'
                    ? 'Deposits that have been closed.'
                    : 'Soonest maturity first. Closed FDs stay hidden unless you ask for them.'
  const filtered =
    Boolean(query.mode) ||
    Boolean(query.due) ||
    Boolean(query.member) ||
    Boolean(query.status) ||
    Boolean(query.view) ||
    query.current === '0'
  const empty = search.trim()
    ? 'No deposits match that search.'
    : query.due === 'month'
      ? 'Nothing maturing this month.'
      : query.due === '90'
        ? 'Nothing maturing in the next 90 days.'
        : memberName
          ? 'No deposits for this member yet.'
          : query.mode === 'monthly'
            ? 'No monthly-interest deposits yet.'
            : query.mode === 'quarterly'
              ? 'No quarterly-interest deposits yet.'
              : query.status === 'closed'
                ? 'No closed deposits.'
                : 'No deposits yet.'

  function applyFilters(next: Partial<FdListQuery>) {
    const merged = { ...query, ...next }
    const paramsNext = new URLSearchParams()
    if (merged.mode) paramsNext.set('mode', merged.mode)
    if (merged.due) paramsNext.set('due', merged.due)
    if (merged.member) paramsNext.set('member', merged.member)
    if (merged.status) paramsNext.set('status', merged.status)
    if (merged.view) paramsNext.set('view', merged.view)
    if (merged.current) paramsNext.set('current', merged.current)
    setParams(paramsNext, { replace: true })
  }

  if (loading) return <ShimmerListPage />

  return (
    <Page>
      <ScreenTitle
        eyebrow="Deposits"
        title={title}
        action={canWrite && hasMembers ? <AddIconLink to="/fds/new" label="Add FD" /> : null}
      />

      <p className="mt-3 text-[13px] text-muted">
        {intro}
        {filtered ? (
          <>
            {' '}
            <Link to="/fds" className="text-accent">
              Show all
            </Link>
          </>
        ) : null}
        {memberName && canManage && selectedMember ? (
          <>
            {' '}
            <Link to={`/members/${selectedMember.id}`} className="text-accent">
              Edit member
            </Link>
          </>
        ) : null}
      </p>

      {hasMembers ? (
        <>
          <Input
            className="mt-5"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search FD no, name, or CID"
            type="search"
          />
          <div className="mt-3">
            <ChipGroup>
              <Chip
                selected={currentOnly && !query.mode && !query.due && !query.view && !query.status}
                onClick={() =>
                  applyFilters({
                    mode: null,
                    due: null,
                    view: null,
                    status: null,
                    current: null,
                    member: query.member,
                  })
                }
              >
                Current
              </Chip>
              <Chip
                selected={query.due === '90'}
                onClick={() =>
                  applyFilters({
                    due: '90',
                    mode: null,
                    view: null,
                    status: null,
                    current: null,
                    member: query.member,
                  })
                }
              >
                Due soon
              </Chip>
              <Chip
                selected={query.mode === 'monthly'}
                onClick={() =>
                  applyFilters({
                    mode: 'monthly',
                    due: null,
                    view: null,
                    status: null,
                    current: null,
                    member: query.member,
                  })
                }
              >
                Monthly
              </Chip>
              <Chip
                selected={query.mode === 'quarterly'}
                onClick={() =>
                  applyFilters({
                    mode: 'quarterly',
                    due: null,
                    view: null,
                    status: null,
                    current: null,
                    member: query.member,
                  })
                }
              >
                Quarterly
              </Chip>
              <Chip
                selected={query.status === 'closed'}
                onClick={() =>
                  applyFilters({
                    status: 'closed',
                    mode: null,
                    due: null,
                    view: null,
                    current: '0',
                    member: query.member,
                  })
                }
              >
                Closed
              </Chip>
            </ChipGroup>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="mt-6 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {household && household.families.length === 0 ? (
        <div className="surface-card mt-8 p-5">
          <p className="text-[13.5px] font-medium text-ink">No family yet.</p>
          <p className="mt-2 text-[13px] text-muted">Create a family before adding deposits.</p>
          <Button asChild className="mt-6" size="lg">
            <Link to="/members/new">Create family</Link>
          </Button>
        </div>
      ) : null}

      {household && household.families.length > 0 && !hasMembers ? (
        <div className="surface-card mt-8 p-5">
          <p className="text-[13.5px] font-medium text-ink">No members yet.</p>
          <p className="mt-2 text-[13px] text-muted">
            Every FD belongs to a person. Add someone first.
          </p>
          <Button asChild className="mt-6" size="lg">
            <Link to="/members/new">Add member</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-6 space-y-5">
        {groups.map((group) => (
          <MemberFdGroup key={group.id} group={group} household={household} view={query.view} />
        ))}
      </div>

      {hasMembers && rows.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted">{empty}</p>
      ) : null}
    </Page>
  )
}

function MemberFdGroup({
  group,
  household,
  view,
}: {
  group: MemberFdGroupData
  household: Household | null
  view?: string | null
}) {
  const [open, setOpen] = useState(true)
  const panelId = `fds-${group.id}`
  const principal = group.fds.reduce((sum, fd) => sum + fd.principal_amount, 0)

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl py-1 text-left"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner text-[10px] font-semibold text-ink">
          {initials(group.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink">{group.name}</span>
          <span className="mt-0.5 block text-[12px] text-muted">
            {group.fds.length} {group.fds.length === 1 ? 'FD' : 'FDs'}
            {' · '}
            {formatInr(principal)}
          </span>
        </span>
        <ChevronIcon
          className={cn(
            'shrink-0 text-[color:var(--text-tertiary)] transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>

      {open ? (
        <ul id={panelId} className="mt-2 space-y-2">
          {group.fds.map((fd) => (
            <FdRow key={fd.id} fd={fd} household={household} view={view} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function FdRow({
  fd,
  household,
  view,
}: {
  fd: FixedDeposit
  household: Household | null
  view?: string | null
}) {
  const closure = household?.closures.find((row) => row.fd_id === fd.id)
  const days = daysUntil(fd.maturity_date)
  const quiet = fd.status === 'renewed' || fd.status === 'closed'
  const dueThisMonth = isDueThisMonth(fd)
  const when =
    fd.status === 'active' && days !== null
      ? formatDaysUntil(days)
      : fd.maturity_date
        ? `Matures ${formatDate(fd.maturity_date)}`
        : formatInterestMode(fd.interest_mode)
  const closedLabel =
    fd.status === 'closed' && closure ? `Closed ${formatDate(closure.closed_on)}` : null
  const tone =
    fd.status === 'active' && days !== null && days < 0
      ? 'danger'
      : fd.status === 'active' && (dueThisMonth || (days !== null && days <= 30))
        ? 'warn'
        : 'default'
  const credit = interestCreditedToDate(fd, { asOf: closure?.closed_on ?? null })
  const trailing =
    view === 'maturity' && fd.maturity_value !== null
      ? formatInr(fd.maturity_value)
      : view === 'credited' && credit
        ? formatInr(credit.amount)
        : formatInr(fd.principal_amount)

  return (
    <ListRow
      to={`/fds/${fd.id}`}
      title={fd.fd_account_no ?? 'FD'}
      subtitle={`${closedLabel ?? when}${dueThisMonth ? ' · Due this month' : ''} · ${formatInterestMode(fd.interest_mode)}`}
      trailing={<span className="font-mono text-[13px]">{trailing}</span>}
      muted={quiet}
      tone={tone}
    />
  )
}

type MemberFdGroupData = {
  id: string
  name: string
  fds: FixedDeposit[]
}

function groupByMember(rows: FixedDeposit[], members: FamilyMember[]): MemberFdGroupData[] {
  const groups = new Map<string, MemberFdGroupData>()

  for (const fd of rows) {
    const id = fd.family_member_id || 'unknown'
    const existing = groups.get(id)
    if (existing) {
      existing.fds.push(fd)
      continue
    }
    const member = members.find((row) => row.id === id)
    groups.set(id, {
      id,
      name: member?.display_name || member?.full_name || 'Unknown',
      fds: [fd],
    })
  }

  return [...groups.values()]
    .map((group) => ({ ...group, fds: sortFdsByMaturity(group.fds) }))
    .sort((left, right) => {
      const leftDate = left.fds[0]?.maturity_date ?? '9999-12-31'
      const rightDate = right.fds[0]?.maturity_date ?? '9999-12-31'
      return leftDate.localeCompare(rightDate)
    })
}
