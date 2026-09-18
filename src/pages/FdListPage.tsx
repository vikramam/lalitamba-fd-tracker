import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { BottomSheet } from '@/components/BottomSheet'
import { Chip, ChipGroup } from '@/components/Chip'
import { CollapseAllControls, CollapseGroups, useCollapseGroup } from '@/components/CollapseGroups'
import { ChevronIcon, PencilIcon, TrashIcon } from '@/components/icons'
import { ListRow } from '@/components/ListRow'
import { AddIconLink, BackLink, Page, ScreenTitle } from '@/components/Page'
import { ShimmerListPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { daysUntil, interestCreditedToDate, isDueThisMonth } from '@/lib/dashboard'
import { canWriteFds } from '@/lib/fds'
import {
  defaultFdSortDir,
  fdSortLabel,
  filterFdRows,
  FD_SORTS,
  readFdSort,
  readFdSortDir,
  receiptDateOf,
  rememberFdListSearch,
  sortFds,
  type FdListQuery,
  type FdSort,
  type FdSortDir,
} from '@/lib/fd-list'
import { formatDateLong, formatDueChip, formatInr, formatInterestMode } from '@/lib/format'
import { initials } from '@/lib/initials'
import { canManageMembers, deleteMember, memberDeleteError } from '@/lib/members'
import type { Family, FamilyMember, FixedDeposit, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function FdListPage() {
  const { household, loading, error, reload } = useHousehold()
  const { alert, confirm, alertError } = useDialog()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [busyMember, setBusyMember] = useState(false)
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null)

  useEffect(() => {
    if (error) void alert('Could not load', error)
  }, [alert, error])
  useEffect(() => {
    rememberFdListSearch(params.toString())
  }, [params])
  const searchParam = params.get('q') ?? ''
  const [search, setSearch] = useState(searchParam)
  useEffect(() => {
    setSearch(searchParam)
  }, [searchParam])
  const sort = readFdSort(params.get('sort'))
  const dir = readFdSortDir(params.get('dir'), sort)
  const query: FdListQuery = {
    q: search,
    mode: params.get('mode'),
    due: params.get('due'),
    member: params.get('member'),
    status: params.get('status'),
    view: params.get('view'),
    current: params.get('current'),
    sort,
    dir,
  }
  const deposits = household?.deposits ?? []
  const members = household?.members ?? []
  const selectedMember = members.find((row) => row.id === query.member)
  const rows = sortFds(filterFdRows(deposits, members, query), sort, members, dir)
  const canWrite = household ? canWriteFds(household) : false
  const canManage = household ? canManageMembers(household) : false
  const hasMembers = members.length > 0
  const memberGroups = groupByMember(rows, members, sort, dir)
  const familyGroups = groupByFamily(memberGroups, members, household?.families ?? [], sort, dir)
  const memberName = selectedMember
    ? selectedMember.display_name || selectedMember.full_name
    : query.member
      ? 'Member'
      : null
  const title = query.due === 'overdue'
    ? 'Overdue'
    : query.due === 'month'
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
  const intro = query.due === 'overdue'
    ? memberName
      ? `Overdue deposits held by ${memberName}.`
      : 'Active FDs that have already passed maturity.'
    : query.due === 'month'
    ? memberName
      ? `Deposits held by ${memberName} that mature this month.`
      : 'Active FDs maturing this month.'
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
                    : `${sortIntro(sort, dir)} Closed FDs stay hidden unless you ask for them.`
  const filtered =
    Boolean(query.q?.trim()) ||
    Boolean(query.mode) ||
    Boolean(query.due) ||
    Boolean(query.member) ||
    Boolean(query.status) ||
    Boolean(query.view) ||
    query.current === '0'
  const empty = search.trim()
    ? 'No deposits match that search.'
    : query.due === 'overdue'
      ? 'Nothing overdue.'
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
    if (merged.q?.trim()) paramsNext.set('q', merged.q)
    if (merged.mode) paramsNext.set('mode', merged.mode)
    if (merged.due) paramsNext.set('due', merged.due)
    if (merged.member) paramsNext.set('member', merged.member)
    if (merged.status) paramsNext.set('status', merged.status)
    if (merged.view) paramsNext.set('view', merged.view)
    if (merged.current) paramsNext.set('current', merged.current)
    const nextSort = merged.sort ?? 'maturity'
    const nextDir = merged.dir ?? defaultFdSortDir(nextSort)
    if (nextSort !== 'maturity') paramsNext.set('sort', nextSort)
    if (nextDir !== defaultFdSortDir(nextSort)) paramsNext.set('dir', nextDir)
    setParams(paramsNext, { replace: true })
  }

  if (loading) return <ShimmerListPage />

  return (
    <Page>
      {selectedMember ? <BackLink to="/members" /> : null}
      <div className={selectedMember ? 'mt-4' : undefined}>
        <ScreenTitle
          eyebrow="Deposits"
          title={title}
          action={canWrite && hasMembers ? <AddIconLink to="/fds/new" label="Add FD" /> : null}
        />
      </div>

      <p className="mt-3 type-body text-muted">
        {intro}
        {filtered ? (
          <>
            {' '}
            <Link to="/fds" className="text-accent">
              Show all
            </Link>
          </>
        ) : null}
      </p>

      {selectedMember ? (
        <MemberSummaryCard
          member={selectedMember}
          household={household}
          canManage={canManage}
          busy={busyMember}
          onDelete={async () => {
            if (!household) return
            const blocked = memberDeleteError(household, selectedMember.id)
            if (blocked) {
              await alert('Cannot delete', blocked)
              return
            }
            const ok = await confirm({
              title: 'Delete member',
              message: `Delete ${selectedMember.full_name}? This cannot be undone.`,
              confirmLabel: 'Delete',
              tone: 'danger',
            })
            if (!ok) return
            setBusyMember(true)
            try {
              await deleteMember(household, selectedMember.id)
              await reload()
              navigate('/members')
            } catch (cause) {
              await alertError(cause, 'Could not delete that person.', 'Cannot delete')
            } finally {
              setBusyMember(false)
            }
          }}
        />
      ) : null}

      {hasMembers ? (
        <CollapseGroups scope="fds">
          <FdSearchFilters
            search={search}
            onSearch={(value) => {
              setSearch(value)
              applyFilters({ q: value })
            }}
            query={query}
            sort={sort}
            dir={dir}
            sheet={sheet}
            onSheet={setSheet}
            groupsToggle={!selectedMember && familyGroups.length > 0}
            onChange={(next) => applyFilters(next)}
            onReset={() => {
              setSearch('')
              applyFilters({
                q: '',
                mode: null,
                due: null,
                view: null,
                status: null,
                current: null,
                sort: 'maturity',
                dir: 'asc',
                member: query.member,
              })
              setSheet(null)
            }}
          />

          <div className="mt-6">
            {selectedMember ? (
              <ul className="space-y-2">
                {rows.map((fd) => (
                  <FdRow key={fd.id} fd={fd} household={household} view={query.view} />
                ))}
              </ul>
            ) : (
              <div className="space-y-5">
                {familyGroups.map((group) => (
                  <FamilyFdGroup key={group.id} group={group} household={household} view={query.view} />
                ))}
              </div>
            )}
          </div>
        </CollapseGroups>
      ) : null}

      {household && household.families.length === 0 ? (
        <div className="surface-card mt-8 p-5">
          <p className="type-card-title text-ink">No family yet.</p>
          <p className="mt-2 type-body text-muted">Create a family before adding deposits.</p>
          <Button asChild className="mt-6" size="lg">
            <Link to="/members/new">Create family</Link>
          </Button>
        </div>
      ) : null}

      {household && household.families.length > 0 && !hasMembers ? (
        <div className="surface-card mt-8 p-5">
          <p className="type-card-title text-ink">No members yet.</p>
          <p className="mt-2 type-body text-muted">
            Every FD belongs to a person. Add someone first.
          </p>
          <Button asChild className="mt-6" size="lg">
            <Link to="/members/new">Add member</Link>
          </Button>
        </div>
      ) : null}

      {hasMembers && rows.length === 0 ? (
        <p className="mt-8 type-body text-muted">{empty}</p>
      ) : null}
    </Page>
  )
}

function MemberSummaryCard({
  member,
  household,
  canManage,
  busy,
  onDelete,
}: {
  member: FamilyMember
  household: Household | null
  canManage: boolean
  busy: boolean
  onDelete: () => void
}) {
  const familyName = household?.families.find((family) => family.id === member.family_id)?.name
  const fds = (household?.deposits ?? []).filter(
    (fd) => fd.family_member_id === member.id && fd.status === 'active',
  )
  const principal = fds.reduce((sum, fd) => sum + fd.principal_amount, 0)

  return (
    <section className="hero-card mt-5 p-4">
      <div className="flex items-start gap-3">
        <span className="type-micro flex size-10 shrink-0 items-center justify-center rounded-xl bg-inner font-semibold text-ink">
          {initials(member.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-card-title text-ink">{member.full_name}</p>
          <p className="mt-0.5 type-small">
            {member.bank_customer_id ? (
              <>
                CID <span className="type-num">{member.bank_customer_id}</span>
              </>
            ) : (
              'No CID'
            )}
            {familyName ? ` · ${familyName}` : ''}
          </p>
          <p className="mt-2 type-small">
            <span className="type-num">{fds.length}</span> {fds.length === 1 ? 'FD' : 'FDs'}
            {' · '}
            <span className="type-num">{formatInr(principal)}</span>
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center">
            <Link
              to={`/members/${member.id}`}
              aria-label={`Edit ${member.full_name}`}
              className="flex size-8 items-center justify-center rounded-lg text-accent"
            >
              <PencilIcon className="size-4" />
            </Link>
            <button
              type="button"
              aria-label={`Delete ${member.full_name}`}
              disabled={busy}
              className="flex size-8 items-center justify-center rounded-lg text-danger disabled:opacity-50"
              onClick={() => void onDelete()}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function FamilyFdGroup({
  group,
  household,
  view,
}: {
  group: FamilyFdGroupData
  household: Household | null
  view?: string | null
}) {
  const [open, setOpen] = useCollapseGroup(true, `family-${group.id}`)
  const panelId = `family-${group.id}`
  const fdCount = group.members.reduce((sum, member) => sum + member.fds.length, 0)
  const principal = group.members.reduce(
    (sum, member) => sum + member.fds.reduce((total, fd) => total + fd.principal_amount, 0),
    0,
  )

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl py-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate type-card-title text-ink">{group.name}</span>
          <span className="type-small mt-0.5 block">
            <span className="type-num">{group.members.length}</span>{' '}
            {group.members.length === 1 ? 'member' : 'members'}
            {' · '}
            <span className="type-num">{fdCount}</span> {fdCount === 1 ? 'FD' : 'FDs'}
            {' · '}
            <span className="type-num">{formatInr(principal)}</span>
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
        <div id={panelId} className="mt-3 space-y-4">
          {group.members.map((member) => (
            <MemberFdGroup key={member.id} group={member} household={household} view={view} />
          ))}
        </div>
      ) : null}
    </section>
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
  const [open, setOpen] = useCollapseGroup(false, `member-${group.id}`)
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
        <span className="type-micro flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner font-semibold text-ink">
          {initials(group.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate type-card-title text-ink">{group.name}</span>
          <span className="type-small mt-0.5 block">
            <span className="type-num">{group.fds.length}</span>{' '}
            {group.fds.length === 1 ? 'FD' : 'FDs'}
            {' · '}
            <span className="type-num">{formatInr(principal)}</span>
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
  const mode = formatInterestMode(fd.interest_mode)
  const closedLabel =
    fd.status === 'closed' && closure ? `Closed ${formatDateLong(closure.closed_on)}` : null
  const dateLabel = fd.maturity_date ? formatDateLong(fd.maturity_date) : null
  const subtitle = closedLabel
    ? `${closedLabel} · ${mode}`
    : dateLabel
      ? `${dateLabel} · ${mode}`
      : mode
  const chip =
    fd.status === 'active' && days !== null ? formatDueChip(days) : null
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
      subtitle={subtitle}
      middle={
        chip ? (
          <span
            className={cn(
              'due-chip',
              tone === 'danger' && 'due-chip-danger',
              tone === 'warn' && 'due-chip-warn',
            )}
          >
            {chip}
          </span>
        ) : undefined
      }
      trailing={<span className="type-list-value">{trailing}</span>}
      muted={quiet}
    />
  )
}

type MemberFdGroupData = {
  id: string
  familyId: string
  name: string
  fds: FixedDeposit[]
}

type FamilyFdGroupData = {
  id: string
  name: string
  members: MemberFdGroupData[]
}

const SHOW_FILTERS = [
  { id: 'current', label: 'Current' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'month', label: 'Due this month' },
  { id: 'soon', label: 'Due soon' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'closed', label: 'Closed' },
] as const

function filterTag(query: FdListQuery) {
  if (query.due === 'overdue') return 'Overdue'
  if (query.due === 'month') return 'Due this month'
  if (query.due === '90') return 'Due soon'
  if (query.mode === 'monthly') return 'Monthly'
  if (query.mode === 'quarterly') return 'Quarterly'
  if (query.mode === 'on_maturity') return 'Locked interest'
  if (query.status === 'closed') return 'Closed'
  if (query.view === 'maturity') return 'Maturity'
  if (query.view === 'credited') return 'Interest credited'
  return null
}

function sortTag(sort: FdSort, dir: FdSortDir) {
  if (sort === 'maturity' && dir === 'asc') return null
  const name = sort === 'maturity' ? 'Maturity' : sort === 'receipt' ? 'Receipt' : fdSortLabel(sort)
  return `${name} ${dir === 'asc' ? '↑' : '↓'}`
}

function showFilterId(query: FdListQuery) {
  if (query.due === 'overdue') return 'overdue'
  if (query.due === 'month') return 'month'
  if (query.due === '90') return 'soon'
  if (query.mode === 'monthly') return 'monthly'
  if (query.mode === 'quarterly') return 'quarterly'
  if (query.status === 'closed') return 'closed'
  if (!query.mode && !query.due && !query.view && !query.status) return 'current'
  return null
}

function applyShowFilter(id: (typeof SHOW_FILTERS)[number]['id'], member: string | null) {
  const base = {
    mode: null,
    due: null,
    view: null,
    status: null,
    current: null,
    member,
  }
  if (id === 'overdue') return { ...base, due: 'overdue' }
  if (id === 'month') return { ...base, due: 'month' }
  if (id === 'soon') return { ...base, due: '90' }
  if (id === 'monthly') return { ...base, mode: 'monthly' }
  if (id === 'quarterly') return { ...base, mode: 'quarterly' }
  if (id === 'closed') return { ...base, status: 'closed', current: '0' }
  return base
}

function FdSearchFilters({
  search,
  onSearch,
  query,
  sort,
  dir,
  sheet,
  onSheet,
  groupsToggle,
  onChange,
  onReset,
}: {
  search: string
  onSearch: (value: string) => void
  query: FdListQuery
  sort: FdSort
  dir: FdSortDir
  sheet: 'filter' | 'sort' | null
  onSheet: (sheet: 'filter' | 'sort' | null) => void
  groupsToggle?: boolean
  onChange: (next: Partial<FdListQuery>) => void
  onReset: () => void
}) {
  const show = filterTag(query)
  const order = sortTag(sort, dir)
  const keyword = search.trim() ? `Search “${search.trim()}”` : null
  const dirty = Boolean(show || order || keyword)
  const selectedShow = showFilterId(query)

  return (
    <>
      <div className="mt-5 flex items-center gap-2">
        <Input
          className="flex-1"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search FD no, name, or CID"
          type="search"
        />
        <button
          type="button"
          onClick={() => onSheet(sheet === 'filter' ? null : 'filter')}
          className={cn(
            'h-11 shrink-0 rounded-xl border px-3.5 type-small font-semibold',
            show ? 'border-ink bg-inner text-ink' : 'border-line bg-surface text-ink',
          )}
        >
          Filter
        </button>
        <button
          type="button"
          onClick={() => onSheet(sheet === 'sort' ? null : 'sort')}
          className={cn(
            'h-11 shrink-0 rounded-xl border px-3.5 type-small font-semibold',
            order ? 'border-ink bg-inner text-ink' : 'border-line bg-surface text-ink',
          )}
        >
          Sort
        </button>
        {groupsToggle ? <CollapseAllControls boxed /> : null}
      </div>

      {dirty ? (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {keyword ? (
              <span className="max-w-full truncate rounded-full border border-line bg-inner px-2.5 py-1 type-small font-semibold text-ink">
                {keyword}
              </span>
            ) : null}
            {show ? (
              <span className="rounded-full border border-line bg-inner px-2.5 py-1 type-small font-semibold text-ink">
                {show}
              </span>
            ) : null}
            {order ? (
              <span className="rounded-full border border-line bg-inner px-2.5 py-1 type-small font-semibold text-ink">
                {order}
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onReset} className="shrink-0 type-small text-accent">
            Reset
          </button>
        </div>
      ) : null}

      <BottomSheet open={sheet === 'filter'} onClose={() => onSheet(null)} title="Filter">
        <div className="flex items-center justify-between gap-3 pb-2">
          <p className="type-small">What to show</p>
          {dirty ? (
            <button type="button" onClick={onReset} className="type-small text-accent">
              Reset
            </button>
          ) : null}
        </div>
        <ChipGroup>
          {SHOW_FILTERS.map((option) => (
            <Chip
              key={option.id}
              selected={selectedShow === option.id}
              onClick={() => {
                onChange(applyShowFilter(option.id, query.member ?? null))
                onSheet(null)
              }}
            >
              {option.label}
            </Chip>
          ))}
        </ChipGroup>
      </BottomSheet>

      <BottomSheet open={sheet === 'sort'} onClose={() => onSheet(null)} title="Sort">
        <div className="flex items-center justify-between gap-3 pb-2">
          <p className="type-small">Order of the list</p>
          {dirty ? (
            <button type="button" onClick={onReset} className="type-small text-accent">
              Reset
            </button>
          ) : null}
        </div>
        <ChipGroup>
          {FD_SORTS.map((option) => (
            <Chip
              key={option}
              selected={sort === option}
              onClick={() => {
                onChange({
                  sort: option,
                  dir: sort === option ? dir : defaultFdSortDir(option),
                })
                onSheet(null)
              }}
            >
              {option === 'maturity'
                ? 'Maturity'
                : option === 'receipt'
                  ? 'Receipt'
                  : fdSortLabel(option)}
            </Chip>
          ))}
        </ChipGroup>
        <div className="mt-3">
          <ChipGroup>
            <Chip selected={dir === 'asc'} onClick={() => onChange({ dir: 'asc' })}>
              Ascending
            </Chip>
            <Chip selected={dir === 'desc'} onClick={() => onChange({ dir: 'desc' })}>
              Descending
            </Chip>
          </ChipGroup>
        </div>
      </BottomSheet>
    </>
  )
}

function sortIntro(sort: FdSort, dir: FdSortDir) {
  if (sort === 'person') return dir === 'desc' ? 'People Z–A.' : 'People A–Z.'
  if (sort === 'amount') {
    return dir === 'asc' ? 'Smallest principal first.' : 'Largest principal first.'
  }
  if (sort === 'receipt') {
    return dir === 'asc' ? 'Oldest receipt date first.' : 'Newest receipt date first.'
  }
  return dir === 'desc' ? 'Latest maturity first.' : 'Soonest maturity first.'
}

function groupByMember(
  rows: FixedDeposit[],
  members: FamilyMember[],
  sort: FdSort,
  dir: FdSortDir,
): MemberFdGroupData[] {
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
      familyId: member?.family_id || fd.family_id || 'unknown',
      name: member?.display_name || member?.full_name || 'Unknown',
      fds: [fd],
    })
  }

  return [...groups.values()]
    .map((group) => ({ ...group, fds: sortFds(group.fds, sort, members, dir) }))
    .sort((left, right) => compareMemberGroups(left, right, sort, dir))
}

function groupByFamily(
  memberGroups: MemberFdGroupData[],
  members: FamilyMember[],
  families: Array<Family & { role?: string }>,
  sort: FdSort,
  dir: FdSortDir,
): FamilyFdGroupData[] {
  const groups = new Map<string, FamilyFdGroupData>()
  for (const memberGroup of memberGroups) {
    const member = members.find((row) => row.id === memberGroup.id)
    const familyId = member?.family_id || memberGroup.familyId || 'unknown'
    const existing = groups.get(familyId)
    if (existing) {
      existing.members.push(memberGroup)
      continue
    }
    groups.set(familyId, {
      id: familyId,
      name: families.find((family) => family.id === familyId)?.name || 'No family',
      members: [memberGroup],
    })
  }
  return [...groups.values()].sort((left, right) => compareFamilyGroups(left, right, sort, dir))
}

function withDir(result: number, dir: FdSortDir) {
  return dir === 'desc' ? -result : result
}

function compareMemberGroups(
  left: MemberFdGroupData,
  right: MemberFdGroupData,
  sort: FdSort,
  dir: FdSortDir,
) {
  if (sort === 'person') return withDir(left.name.localeCompare(right.name), dir)
  if (sort === 'amount') return withDir(groupPrincipal(left.fds) - groupPrincipal(right.fds), dir)
  if (sort === 'receipt') {
    return withDir(oldestReceiptDate(left.fds).localeCompare(oldestReceiptDate(right.fds)), dir)
  }
  return withDir(soonestMaturity(left.fds).localeCompare(soonestMaturity(right.fds)), dir)
}

function compareFamilyGroups(
  left: FamilyFdGroupData,
  right: FamilyFdGroupData,
  sort: FdSort,
  dir: FdSortDir,
) {
  if (sort === 'person') return withDir(left.name.localeCompare(right.name), dir)
  const leftFds = left.members.flatMap((member) => member.fds)
  const rightFds = right.members.flatMap((member) => member.fds)
  if (sort === 'amount') return withDir(groupPrincipal(leftFds) - groupPrincipal(rightFds), dir)
  if (sort === 'receipt') {
    return withDir(oldestReceiptDate(leftFds).localeCompare(oldestReceiptDate(rightFds)), dir)
  }
  return withDir(soonestMaturity(leftFds).localeCompare(soonestMaturity(rightFds)), dir)
}

function groupPrincipal(fds: FixedDeposit[]) {
  return fds.reduce((sum, fd) => sum + fd.principal_amount, 0)
}

function oldestReceiptDate(fds: FixedDeposit[]) {
  return fds.reduce((oldest, fd) => {
    const date = receiptDateOf(fd)
    return date && date < oldest ? date : oldest
  }, '9999-12-31')
}

function soonestMaturity(fds: FixedDeposit[]) {
  return fds.reduce((soonest, fd) => {
    const date = fd.maturity_date ?? '9999-12-31'
    return date < soonest ? date : soonest
  }, '9999-12-31')
}
