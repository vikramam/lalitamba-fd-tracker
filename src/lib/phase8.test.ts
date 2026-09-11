import { describe, expect, it } from 'vitest'

import { interestCreditedToDate, summarizeDashboard } from '@/lib/dashboard'
import { demoDeposits, demoMembers } from '@/lib/demo-data'
import { filterFdRows, matchesFdSearch, sortFds, sortFdsByMaturity } from '@/lib/fd-list'
import { fdShareText } from '@/lib/fd-share'
import { DEMO_IDS } from '@/lib/ids'

describe('dashboard totals', () => {
  it('matches the two Lalitamba samples for the Mulgund household', () => {
    const deposits = demoDeposits.filter((fd) => fd.family_id === DEMO_IDS.mulgundFamily)
    const members = demoMembers.filter((member) => member.family_id === DEMO_IDS.mulgundFamily)
    const summary = summarizeDashboard(deposits, members, new Date('2026-09-07'))
    expect(summary.principal).toBe(600000)
    expect(summary.monthlyIncome).toBe(1375)
    expect(summary.maturityTotal).toBe(847500)
    expect(summary.lockedInterest).toBe(247500)
    expect(summary.activeCount).toBe(2)
    expect(summary.byMember[0]?.principal).toBe(600000)
    expect(summary.byMember[0]?.monthlyFds).toBe(1)
    expect(summary.byMember[0]?.onMaturityFds).toBe(1)
    expect(summary.monthlyFdCount).toBe(1)
    expect(summary.onMaturityFdCount).toBe(1)
    expect(summary.interestCredited).toBe(20625)
    expect(summary.quarterlyIncome).toBe(0)
    expect(summary.dueThisMonth).toEqual([])
  })

  it('credits monthly interest for completed months only', () => {
    const monthly = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd40599)!
    const credit = interestCreditedToDate(monthly, { now: new Date('2026-09-07') })
    expect(credit).toEqual({
      amount: 20625,
      months: 15,
      monthly: 1375,
      start: '2025-05-26',
      end: '2026-09-07',
    })
    expect(interestCreditedToDate(monthly, { now: new Date('2025-06-25') })?.amount).toBe(0)
    expect(interestCreditedToDate(monthly, { now: new Date('2025-06-26') })?.amount).toBe(1375)
    const onMaturity = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd32450)!
    expect(interestCreditedToDate(onMaturity, { now: new Date('2026-09-07') })).toBeNull()
  })

  it('drops renewed and closed rows from outstanding totals', () => {
    const deposits = demoDeposits.map((fd) =>
      fd.id === DEMO_IDS.fd40599 ? { ...fd, status: 'renewed' as const } : fd,
    )
    const summary = summarizeDashboard(
      deposits.filter((fd) => fd.family_id === DEMO_IDS.mulgundFamily),
      demoMembers,
      new Date('2026-09-07'),
    )
    expect(summary.principal).toBe(450000)
    expect(summary.monthlyIncome).toBe(0)
    expect(summary.maturityTotal).toBe(697500)
  })

  it('lists an FD due within 90 days', () => {
    const soon = {
      ...demoDeposits[0],
      id: 'soon',
      maturity_date: '2026-10-01',
    }
    const summary = summarizeDashboard([soon], demoMembers, new Date('2026-09-07'))
    expect(summary.upcoming).toHaveLength(1)
    expect(summary.upcoming[0]?.days).toBe(24)
  })

  it('flags an FD due this month', () => {
    const soon = {
      ...demoDeposits[0],
      id: 'month',
      maturity_date: '2026-09-20',
    }
    const summary = summarizeDashboard([soon], demoMembers, new Date('2026-09-07'))
    expect(summary.dueThisMonth).toHaveLength(1)
  })
})

describe('fd list helpers', () => {
  it('finds an FD by account number or CID', () => {
    const monthly = demoDeposits[0]!
    expect(matchesFdSearch(monthly, demoMembers, '40599')).toBe(true)
    expect(matchesFdSearch(monthly, demoMembers, '1700')).toBe(true)
    expect(matchesFdSearch(monthly, demoMembers, 'nobody')).toBe(false)
  })

  it('lists overdue FDs for a member', () => {
    const overdue = { ...demoDeposits[0]!, id: 'overdue', maturity_date: '2026-08-01' }
    const later = { ...demoDeposits[1]!, maturity_date: '2028-12-01' }
    const rows = filterFdRows(
      [overdue, later],
      demoMembers,
      { due: 'overdue', member: overdue.family_member_id },
      new Date('2026-09-07'),
    )
    expect(rows.map((fd) => fd.id)).toEqual(['overdue'])
  })

  it('hides closed FDs by default and sorts soonest maturity first', () => {
    const closed = { ...demoDeposits[0]!, status: 'closed' as const, maturity_date: '2026-01-01' }
    const later = { ...demoDeposits[1]!, maturity_date: '2028-12-01' }
    const sooner = { ...demoDeposits[2]!, maturity_date: '2027-03-01' }
    const hidden = filterFdRows([closed, later, sooner], demoMembers, {})
    expect(hidden.map((fd) => fd.id)).toEqual([later.id, sooner.id])
    expect(sortFdsByMaturity([later, sooner]).map((fd) => fd.id)).toEqual([sooner.id, later.id])
  })

  it('sorts by person, amount, and newest receipt date', () => {
    const vikramSmall = demoDeposits[0]!
    const vikramLarge = demoDeposits[1]!
    const other = demoDeposits[2]!
    expect(sortFds([vikramLarge, other, vikramSmall], 'person', demoMembers).map((fd) => fd.id)).toEqual([
      other.id,
      vikramSmall.id,
      vikramLarge.id,
    ])
    expect(sortFds([other, vikramSmall, vikramLarge], 'amount', demoMembers).map((fd) => fd.id)).toEqual([
      vikramLarge.id,
      vikramSmall.id,
      other.id,
    ])
    expect(sortFds([vikramSmall, vikramLarge, other], 'receipt', demoMembers).map((fd) => fd.id)).toEqual([
      other.id,
      vikramSmall.id,
      vikramLarge.id,
    ])
    expect(sortFds([other, vikramSmall, vikramLarge], 'amount', demoMembers, 'asc').map((fd) => fd.id)).toEqual([
      other.id,
      vikramSmall.id,
      vikramLarge.id,
    ])
  })
})

describe('fd share text', () => {
  it('includes the holder and maturity date', () => {
    const text = fdShareText(demoDeposits[0]!, demoMembers[0])
    expect(text).toContain('01FD40599')
    expect(text).toContain('Vikram')
    expect(text).toContain('25-05-2028')
  })
})
