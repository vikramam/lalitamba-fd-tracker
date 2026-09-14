import { parseLocalDate, todayIso } from '@/lib/dashboard'
import { expectedMonthlyInterest, expectedQuarterlyInterest } from '@/lib/fd-checks'
import { paysOutInterest } from '@/lib/format'
import { roundMoney } from '@/lib/passbook-ledger'
import type { FdClosure, FdRenewal, FixedDeposit } from '@/lib/types'

export function addCalendarMonths(iso: string, months: number): string {
  const start = parseLocalDate(iso)
  if (!start) return iso.slice(0, 10)
  const day = start.getDate()
  const next = new Date(start.getFullYear(), start.getMonth() + months, 1)
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, last))
  return todayIso(next)
}

export function interestPayoutOf(fd: FixedDeposit): number | null {
  if (!paysOutInterest(fd.interest_mode)) return null
  if (fd.monthly_interest_amount !== null) return fd.monthly_interest_amount
  if (fd.interest_rate_pct === null) return null
  return roundMoney(
    fd.interest_mode === 'quarterly'
      ? expectedQuarterlyInterest(fd.principal_amount, fd.interest_rate_pct)
      : expectedMonthlyInterest(fd.principal_amount, fd.interest_rate_pct),
  )
}

export function interestStepMonths(mode: FixedDeposit['interest_mode']) {
  if (mode === 'monthly') return 1
  if (mode === 'quarterly') return 3
  return 0
}

export function fdInterestStopDate(
  fd: FixedDeposit,
  closures: FdClosure[],
  renewals: FdRenewal[],
  now = new Date(),
) {
  const dates = [todayIso(now)]
  if (fd.maturity_date) dates.push(fd.maturity_date.slice(0, 10))
  const closed = closures.find((row) => row.fd_id === fd.id)
  if (closed?.closed_on) dates.push(closed.closed_on.slice(0, 10))
  const renewed = renewals.find((row) => row.previous_fd_id === fd.id)
  if (renewed?.renewed_on) dates.push(renewed.renewed_on.slice(0, 10))
  return dates.reduce((earliest, value) => (value < earliest ? value : earliest))
}

export function interestPeriodDates(fd: FixedDeposit, stopIso: string): string[] {
  const start = (fd.fd_date ?? fd.transaction_date)?.slice(0, 10)
  const step = interestStepMonths(fd.interest_mode)
  if (!start || !step || interestPayoutOf(fd) === null) return []

  const dates: string[] = []
  for (let n = step; n <= 12 * 40; n += step) {
    const due = addCalendarMonths(start, n)
    if (due <= start) continue
    if (due > stopIso) break
    dates.push(due)
  }
  return dates
}

export function subsequentInterestDates(
  fd: FixedDeposit,
  passbookCreatedOn: string,
  closures: FdClosure[],
  renewals: FdRenewal[],
  now = new Date(),
) {
  const floor = passbookCreatedOn.slice(0, 10)
  const stop = fdInterestStopDate(fd, closures, renewals, now)
  return interestPeriodDates(fd, stop).filter((due) => due >= floor)
}

export function msAccountsForMember(deposits: FixedDeposit[], memberId: string) {
  const values = new Set<string>()
  for (const fd of deposits) {
    if (fd.family_member_id !== memberId) continue
    if (!paysOutInterest(fd.interest_mode)) continue
    const account = fd.interest_credit_account?.trim()
    if (account) values.add(account)
  }
  return [...values]
}
