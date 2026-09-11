import { daysUntil, interestCreditedToDate, isDueThisMonth, isPastDue } from '@/lib/dashboard'
import type { FamilyMember, FixedDeposit } from '@/lib/types'

export const FD_SORTS = ['maturity', 'person', 'amount', 'receipt'] as const
export const FD_SORT_DIRS = ['asc', 'desc'] as const

export type FdSort = (typeof FD_SORTS)[number]
export type FdSortDir = (typeof FD_SORT_DIRS)[number]

export type FdListQuery = {
  q?: string
  mode?: string | null
  due?: string | null
  member?: string | null
  status?: string | null
  view?: string | null
  current?: string | null
  sort?: FdSort | null
  dir?: FdSortDir | null
}

export function readFdSort(value: string | null): FdSort {
  return FD_SORTS.includes(value as FdSort) ? (value as FdSort) : 'maturity'
}

export function defaultFdSortDir(sort: FdSort): FdSortDir {
  return sort === 'amount' || sort === 'receipt' ? 'desc' : 'asc'
}

export function readFdSortDir(value: string | null, sort: FdSort): FdSortDir {
  return value === 'asc' || value === 'desc' ? value : defaultFdSortDir(sort)
}

export function fdSortLabel(sort: FdSort) {
  if (sort === 'person') return 'Person'
  if (sort === 'amount') return 'Amount'
  if (sort === 'receipt') return 'Receipt date'
  return 'Maturity date'
}

export function receiptDateOf(fd: Pick<FixedDeposit, 'fd_date' | 'transaction_date' | 'print_at'>) {
  return fd.fd_date ?? fd.transaction_date ?? fd.print_at?.slice(0, 10) ?? ''
}

export function isClosedOrRenewed(fd: Pick<FixedDeposit, 'status'>) {
  return fd.status === 'closed' || fd.status === 'renewed'
}

export function isDueWithin90(fd: FixedDeposit, now = new Date()) {
  if (fd.status !== 'active') return false
  const days = daysUntil(fd.maturity_date, now)
  return days !== null && days >= 0 && days <= 90
}

export function matchesFdSearch(
  fd: FixedDeposit,
  members: FamilyMember[],
  raw: string,
) {
  const query = raw.trim().toLowerCase()
  if (!query) return true
  const member = members.find((row) => row.id === fd.family_member_id)
  const haystack = [
    fd.fd_account_no,
    fd.holder_name,
    fd.bank_customer_id,
    fd.nominee_name,
    member?.full_name,
    member?.display_name,
    member?.bank_customer_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function currentOnlyDefault(query: FdListQuery) {
  if (query.status === 'closed') return false
  if (query.current === '0') return false
  return true
}

export function filterFdRows(
  deposits: FixedDeposit[],
  members: FamilyMember[],
  query: FdListQuery,
  now = new Date(),
) {
  const hideQuiet = currentOnlyDefault(query)
  return deposits.filter((fd) => {
    if (hideQuiet && isClosedOrRenewed(fd)) return false
    if (query.status === 'closed' && fd.status !== 'closed') return false
    if (query.status === 'active' && fd.status !== 'active') return false
    if (query.mode && fd.interest_mode !== query.mode) return false
    if (query.due === '90' && !isDueWithin90(fd, now)) return false
    if (query.due === 'month' && !isDueThisMonth(fd, now)) return false
    if (query.due === 'overdue' && !isPastDue(fd, now)) return false
    if (query.member && fd.family_member_id !== query.member) return false
    if (query.view === 'credited' && !interestCreditedToDate(fd, { now })) return false
    if (query.view === 'maturity' && fd.status !== 'active') return false
    if (query.q && !matchesFdSearch(fd, members, query.q)) return false
    return true
  })
}

function memberSortName(fd: FixedDeposit, members: FamilyMember[]) {
  const member = members.find((row) => row.id === fd.family_member_id)
  return (member?.display_name || member?.full_name || fd.holder_name || '').trim()
}

export function compareByMaturity(left: FixedDeposit, right: FixedDeposit) {
  return compareFds(left, right, 'maturity')
}

export function compareFds(
  left: FixedDeposit,
  right: FixedDeposit,
  sort: FdSort = 'maturity',
  members: FamilyMember[] = [],
  dir: FdSortDir = defaultFdSortDir(sort),
) {
  const leftQuiet = isClosedOrRenewed(left) ? 1 : 0
  const rightQuiet = isClosedOrRenewed(right) ? 1 : 0
  if (leftQuiet !== rightQuiet) return leftQuiet - rightQuiet

  let result = 0
  if (sort === 'amount') {
    result = left.principal_amount - right.principal_amount
  } else if (sort === 'receipt') {
    result = (receiptDateOf(left) || '9999-12-31').localeCompare(
      receiptDateOf(right) || '9999-12-31',
    )
  } else if (sort === 'person') {
    result = memberSortName(left, members).localeCompare(memberSortName(right, members))
  }
  if (result === 0) {
    result = (left.maturity_date ?? '9999-12-31').localeCompare(
      right.maturity_date ?? '9999-12-31',
    )
  }
  return dir === 'desc' ? -result : result
}

export function sortFds(
  rows: FixedDeposit[],
  sort: FdSort = 'maturity',
  members: FamilyMember[] = [],
  dir: FdSortDir = defaultFdSortDir(sort),
) {
  return [...rows].sort((left, right) => compareFds(left, right, sort, members, dir))
}

export function sortFdsByMaturity(rows: FixedDeposit[]) {
  return sortFds(rows, 'maturity')
}
