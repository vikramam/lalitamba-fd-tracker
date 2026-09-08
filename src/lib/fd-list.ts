import { daysUntil, interestCreditedToDate, isDueThisMonth } from '@/lib/dashboard'
import type { FamilyMember, FixedDeposit } from '@/lib/types'

export type FdListQuery = {
  q?: string
  mode?: string | null
  due?: string | null
  member?: string | null
  status?: string | null
  view?: string | null
  current?: string | null
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
    if (query.member && fd.family_member_id !== query.member) return false
    if (query.view === 'credited' && !interestCreditedToDate(fd, { now })) return false
    if (query.view === 'maturity' && fd.status !== 'active') return false
    if (query.q && !matchesFdSearch(fd, members, query.q)) return false
    return true
  })
}

export function compareByMaturity(left: FixedDeposit, right: FixedDeposit) {
  const leftQuiet = isClosedOrRenewed(left) ? 1 : 0
  const rightQuiet = isClosedOrRenewed(right) ? 1 : 0
  if (leftQuiet !== rightQuiet) return leftQuiet - rightQuiet
  return (left.maturity_date ?? '9999-12-31').localeCompare(right.maturity_date ?? '9999-12-31')
}

export function sortFdsByMaturity(rows: FixedDeposit[]) {
  return [...rows].sort(compareByMaturity)
}
