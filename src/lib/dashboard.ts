import { expectedMonthlyInterest, expectedQuarterlyInterest } from '@/lib/fd-checks'
import type { FamilyMember, FixedDeposit } from '@/lib/types'

export function parseLocalDate(iso: string | null): Date | null {
  if (!iso) return null
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function todayIso(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function daysUntil(iso: string | null, now = new Date()): number | null {
  const target = parseLocalDate(iso)
  if (!target) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

export function isDueThisMonth(fd: Pick<FixedDeposit, 'status' | 'maturity_date'>, now = new Date()) {
  if (fd.status !== 'active') return false
  const date = parseLocalDate(fd.maturity_date)
  if (!date) return false
  const days = daysUntil(fd.maturity_date, now)
  return (
    days !== null &&
    days >= 0 &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

export function completedMonthsBetween(startIso: string, endIso: string): number {
  const start = parseLocalDate(startIso)
  const end = parseLocalDate(endIso)
  if (!start || !end || end < start) return 0
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export function monthlyPayoutOf(fd: Pick<FixedDeposit, 'monthly_interest_amount' | 'interest_rate_pct' | 'principal_amount' | 'interest_mode'>): number | null {
  if (fd.interest_mode !== 'monthly') return null
  if (fd.monthly_interest_amount !== null) return fd.monthly_interest_amount
  if (fd.interest_rate_pct !== null) {
    return expectedMonthlyInterest(fd.principal_amount, fd.interest_rate_pct)
  }
  return null
}

export type InterestCredit = {
  amount: number
  months: number
  monthly: number
  start: string
  end: string
}

export function interestCreditedToDate(
  fd: Pick<
    FixedDeposit,
    | 'interest_mode'
    | 'monthly_interest_amount'
    | 'interest_rate_pct'
    | 'principal_amount'
    | 'fd_date'
    | 'transaction_date'
    | 'maturity_date'
    | 'status'
  >,
  options?: { now?: Date; asOf?: string | null },
): InterestCredit | null {
  if (fd.interest_mode !== 'monthly') return null
  const monthly = monthlyPayoutOf(fd)
  if (monthly === null) return null
  const start = fd.fd_date ?? fd.transaction_date
  if (!start) return null

  const today = todayIso(options?.now)
  const candidates = [options?.asOf, fd.maturity_date, today].filter(
    (value): value is string => Boolean(value),
  )
  const end = candidates.reduce((earliest, value) => (value < earliest ? value : earliest))
  const months = completedMonthsBetween(start, end)
  return {
    amount: Math.round(monthly * months * 100) / 100,
    months,
    monthly,
    start,
    end,
  }
}

export function monthlyIncomeOf(fd: FixedDeposit): number {
  if (fd.status !== 'active' || fd.interest_mode !== 'monthly') return 0
  if (fd.monthly_interest_amount !== null) return fd.monthly_interest_amount
  if (fd.interest_rate_pct !== null) {
    return expectedMonthlyInterest(fd.principal_amount, fd.interest_rate_pct)
  }
  return 0
}

export function quarterlyIncomeOf(fd: FixedDeposit): number {
  if (fd.status !== 'active' || fd.interest_mode !== 'quarterly') return 0
  if (fd.monthly_interest_amount !== null) return fd.monthly_interest_amount
  if (fd.interest_rate_pct !== null) {
    return expectedQuarterlyInterest(fd.principal_amount, fd.interest_rate_pct)
  }
  return 0
}

export function lockedInterestOf(fd: FixedDeposit): number {
  if (fd.status !== 'active' || fd.interest_mode !== 'on_maturity') return 0
  if (fd.maturity_value === null) return 0
  return Math.max(0, fd.maturity_value - fd.principal_amount)
}

export function maturityValueOf(fd: FixedDeposit): number {
  return fd.maturity_value ?? fd.principal_amount
}

export type MemberTotal = {
  memberId: string
  name: string
  count: number
  principal: number
}

export type DashboardSummary = {
  active: FixedDeposit[]
  activeCount: number
  principal: number
  maturityTotal: number
  monthlyIncome: number
  quarterlyIncome: number
  lockedInterest: number
  interestCredited: number
  upcoming: Array<{ fd: FixedDeposit; days: number }>
  dueThisMonth: FixedDeposit[]
  pastDue: FixedDeposit[]
  matured: FixedDeposit[]
  byMember: MemberTotal[]
}

export function summarizeDashboard(
  deposits: FixedDeposit[],
  members: FamilyMember[],
  now = new Date(),
): DashboardSummary {
  const active = deposits.filter((fd) => fd.status === 'active')
  const matured = deposits.filter((fd) => fd.status === 'matured')
  const upcoming: Array<{ fd: FixedDeposit; days: number }> = []
  const pastDue: FixedDeposit[] = []

  for (const fd of active) {
    const days = daysUntil(fd.maturity_date, now)
    if (days === null) continue
    if (days < 0) pastDue.push(fd)
    else if (days <= 90) upcoming.push({ fd, days })
  }

  upcoming.sort((left, right) => left.days - right.days)
  pastDue.sort((left, right) => (left.maturity_date ?? '').localeCompare(right.maturity_date ?? ''))

  const byMember = members
    .map((member) => {
      const rows = active.filter((fd) => fd.family_member_id === member.id)
      return {
        memberId: member.id,
        name: member.display_name || member.full_name,
        count: rows.length,
        principal: rows.reduce((sum, fd) => sum + fd.principal_amount, 0),
      }
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.principal - left.principal)

  return {
    active,
    activeCount: active.length,
    principal: active.reduce((sum, fd) => sum + fd.principal_amount, 0),
    maturityTotal: active.reduce((sum, fd) => sum + maturityValueOf(fd), 0),
    monthlyIncome: active.reduce((sum, fd) => sum + monthlyIncomeOf(fd), 0),
    quarterlyIncome: active.reduce((sum, fd) => sum + quarterlyIncomeOf(fd), 0),
    lockedInterest: active.reduce((sum, fd) => sum + lockedInterestOf(fd), 0),
    interestCredited: active.reduce((sum, fd) => {
      const credit = interestCreditedToDate(fd, { now })
      return sum + (credit?.amount ?? 0)
    }, 0),
    upcoming,
    dueThisMonth: active.filter((fd) => isDueThisMonth(fd, now)),
    pastDue,
    matured,
    byMember,
  }
}
