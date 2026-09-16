import { parseLocalDate, todayIso } from '@/lib/dashboard'
import { expectedMonthlyInterest, expectedQuarterlyInterest } from '@/lib/fd-checks'
import { paysOutInterest } from '@/lib/format'
import { roundMoney } from '@/lib/passbook-ledger'
import type { FdClosure, FdRenewal, FixedDeposit } from '@/lib/types'

export const INTEREST_CYCLE_CUTOVER_DATE = '2026-10-01'
export const INTEREST_CYCLE_CUTOVER_PERIOD_START = '2026-09-01'

export type InterestCredit = {
  periodStart: string
  periodEnd: string
  creditDate: string
  amount: number
  final?: boolean
}

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

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function monthEnd(iso: string) {
  const date = parseLocalDate(monthStart(iso))
  if (!date) return iso.slice(0, 10)
  return todayIso(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function nextDay(iso: string) {
  const date = parseLocalDate(iso)
  if (!date) return iso.slice(0, 10)
  date.setDate(date.getDate() + 1)
  return todayIso(date)
}

function previousDay(iso: string) {
  const date = parseLocalDate(iso)
  if (!date) return iso.slice(0, 10)
  date.setDate(date.getDate() - 1)
  return todayIso(date)
}

function daysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365
}

function inclusiveActualYearInterest(fd: FixedDeposit, startIso: string, endIso: string) {
  if (fd.interest_rate_pct === null) return null
  const start = parseLocalDate(startIso)
  const end = parseLocalDate(endIso)
  if (!start || !end || end < start) return null

  let amount = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const year = cursor.getFullYear()
    const endOfYear = new Date(year, 11, 31)
    const segmentEnd = end < endOfYear ? end : endOfYear
    const days = Math.round((segmentEnd.getTime() - cursor.getTime()) / 86_400_000) + 1
    amount += (fd.principal_amount * fd.interest_rate_pct * days) / 100 / daysInYear(year)
    cursor.setFullYear(year + 1, 0, 1)
  }
  return roundMoney(amount)
}

function firstCycle(fd: FixedDeposit, floor: string): InterestCredit | null {
  const fdStart = (fd.fd_date ?? fd.transaction_date)?.slice(0, 10)
  if (!fdStart) return null
  const periodStart = [fdStart, floor, INTEREST_CYCLE_CUTOVER_PERIOD_START].reduce(
    (latest, value) => (value > latest ? value : latest),
  )
  const periodEnd = monthEnd(periodStart)
  const creditDate = nextDay(periodEnd)
  if (creditDate < INTEREST_CYCLE_CUTOVER_DATE) return null

  let amount: number | null
  const fullCalendarMonth = periodStart === monthStart(periodStart)
  if (fd.interest_mode === 'monthly' && fullCalendarMonth) {
    amount = interestPayoutOf(fd)
  } else {
    amount = inclusiveActualYearInterest(fd, periodStart, periodEnd)
  }
  if (amount === null || amount <= 0) return null
  return { periodStart, periodEnd, creditDate, amount }
}

function recurringCycle(
  fd: FixedDeposit,
  periodStart: string,
): InterestCredit | null {
  const months = interestStepMonths(fd.interest_mode)
  if (!months) return null
  const periodEnd = previousDay(addCalendarMonths(periodStart, months))
  const amount = interestPayoutOf(fd)
  if (amount === null || amount <= 0) return null
  return {
    periodStart,
    periodEnd,
    creditDate: nextDay(periodEnd),
    amount,
  }
}

function finalMaturityCredit(
  fd: FixedDeposit,
  periodStart: string,
  maturity: string,
  today: string,
  stop: string,
): InterestCredit | null {
  if (today < maturity) return null
  if (maturity > stop) return null
  if (maturity < INTEREST_CYCLE_CUTOVER_DATE) return null
  if (maturity < periodStart) return null
  const amount = inclusiveActualYearInterest(fd, periodStart, maturity)
  if (amount === null || amount <= 0) return null
  return {
    periodStart,
    periodEnd: maturity,
    creditDate: maturity,
    amount,
    final: true,
  }
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

export function interestCredits(
  fd: FixedDeposit,
  passbookCreatedOn: string,
  closures: FdClosure[],
  renewals: FdRenewal[],
  now = new Date(),
): InterestCredit[] {
  if (fd.status !== 'active' && fd.status !== 'matured') return []
  if (!paysOutInterest(fd.interest_mode)) return []

  const today = todayIso(now)
  const maturity = fd.maturity_date?.slice(0, 10) || null
  const floor = passbookCreatedOn.slice(0, 10)
  const stop = fdInterestStopDate(fd, closures, renewals, now)
  const first = firstCycle(fd, floor)
  if (!first) return []

  const credits: InterestCredit[] = []
  let credit: InterestCredit | null = first
  let unfinishedStart = first.periodStart
  for (let periods = 0; credit && periods < 12 * 40; periods += 1) {
    if (credit.creditDate > today || credit.creditDate > stop) break
    if (maturity && credit.periodEnd >= maturity) break
    credits.push(credit)
    unfinishedStart = nextDay(credit.periodEnd)
    credit = recurringCycle(fd, unfinishedStart)
  }

  if (maturity) {
    const final = finalMaturityCredit(fd, unfinishedStart, maturity, today, stop)
    if (final) credits.push(final)
  }
  return credits
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
