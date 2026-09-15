import { afterEach, describe, expect, it } from 'vitest'

import { demoDeposits } from '@/lib/demo-data'
import { addDemoMember, addDemoPassbook, resetDemoStore } from '@/lib/demo-store'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'
import { isPassbookPublicId, nextPublicId } from '@/lib/passbook-id'
import {
  addCalendarMonths,
  interestPeriodDates,
  msAccountsForMember,
  subsequentInterestDates,
} from '@/lib/passbook-interest'
import {
  currentBalance,
  filterByDateRange,
  groupByMonth,
  paginateRows,
  withRunningBalances,
  wouldGoNegative,
} from '@/lib/passbook-ledger'
import { generateMissingPassbooks, deletePassbookTransaction, syncHouseholdPassbookInterest, syncPassbookInterest } from '@/lib/passbooks'
import type { PassbookTransaction } from '@/lib/types'

const memory = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
})

afterEach(() => {
  resetDemoStore()
  memory.clear()
})

function tx(
  partial: Partial<PassbookTransaction> &
    Pick<PassbookTransaction, 'id' | 'txn_date' | 'txn_type' | 'amount'>,
): PassbookTransaction {
  return {
    family_id: DEMO_IDS.mulgundFamily,
    passbook_id: 'pb',
    public_id: 'PB-260101-0001',
    balance_after: 0,
    reference: null,
    remarks: null,
    source_type: 'manual',
    source_fd_id: null,
    interest_period_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('passbook transaction ids', () => {
  it('builds PB-YYMMDD-NNNN ids in date order', () => {
    expect(nextPublicId('2026-09-14', [])).toBe('PB-260914-0001')
    expect(nextPublicId('2026-09-14', ['PB-260914-0001', 'PB-260913-0009'])).toBe(
      'PB-260914-0002',
    )
    expect(isPassbookPublicId('PB-260914-0002')).toBe(true)
  })
})

describe('interest schedule', () => {
  it('credits monthly interest on the FD anniversary, not the start date', () => {
    const monthly = demoDeposits[0]!
    expect(addCalendarMonths('2025-09-10', 1)).toBe('2025-10-10')
    expect(interestPeriodDates(monthly, '2025-06-25')).toEqual([])
    expect(interestPeriodDates(monthly, '2025-06-26')).toEqual(['2025-06-26'])
  })

  it('skips maturity FDs and periods before the passbook was created', () => {
    const monthly = demoDeposits[0]!
    const maturity = demoDeposits[1]!
    expect(interestPeriodDates(maturity, '2026-09-14')).toEqual([])
    expect(
      subsequentInterestDates(monthly, '2026-09-14', [], [], new Date('2026-09-14')),
    ).toEqual([])
    expect(
      subsequentInterestDates(monthly, '2026-08-26', [], [], new Date('2026-09-14')),
    ).toEqual(['2026-08-26'])
  })

  it('does not credit interest when the FD is already matured', () => {
    const monthly = demoDeposits[0]!
    expect(
      subsequentInterestDates(
        { ...monthly, status: 'matured' },
        '2026-08-26',
        [],
        [],
        new Date('2026-09-14'),
      ),
    ).toEqual([])
    expect(
      subsequentInterestDates(
        { ...monthly, maturity_date: '2026-08-01' },
        '2026-06-01',
        [],
        [],
        new Date('2026-09-14'),
      ),
    ).toEqual([])
  })

  it('does not pick an MS A/c when a member has more than one', () => {
    const one = msAccountsForMember(demoDeposits, DEMO_IDS.vikramMember)
    expect(one).toEqual(['01003MS001396'])
    const clash = [
      demoDeposits[0]!,
      { ...demoDeposits[0]!, id: 'other-fd', interest_credit_account: '01003MS999999' },
    ]
    expect(msAccountsForMember(clash, DEMO_IDS.vikramMember)).toHaveLength(2)
  })
})

describe('running balance', () => {
  it('recomputes later rows after a backdated credit', () => {
    const rows = withRunningBalances([
      tx({ id: 'a', txn_date: '2026-01-01', txn_type: 'credit', amount: 1000, created_at: 't1' }),
      tx({ id: 'b', txn_date: '2026-01-10', txn_type: 'credit', amount: 500, created_at: 't2' }),
      tx({ id: 'c', txn_date: '2026-01-20', txn_type: 'debit', amount: 200, created_at: 't3' }),
      tx({ id: 'd', txn_date: '2026-01-05', txn_type: 'credit', amount: 100, created_at: 't4' }),
    ])
    expect(rows.map((row) => [row.id, row.balance_after])).toEqual([
      ['a', 1000],
      ['d', 1100],
      ['b', 1600],
      ['c', 1400],
    ])
  })

  it('rejects a debit that would make any running balance negative', () => {
    const existing = withRunningBalances([
      tx({ id: 'a', txn_date: '2026-01-01', txn_type: 'credit', amount: 1000 }),
    ])
    expect(
      wouldGoNegative(existing, {
        id: 'x',
        txn_date: '2026-01-02',
        created_at: 't',
        txn_type: 'debit',
        amount: 1001,
      }),
    ).toBe(true)
    expect(currentBalance(existing)).toBe(1000)
  })

  it('filters and paginates newest first in pages of 15', () => {
    const rows = Array.from({ length: 16 }, (_, index) =>
      tx({
        id: `r${index}`,
        txn_date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        txn_type: 'credit',
        amount: 1,
      }),
    )
    const filtered = filterByDateRange(rows, '2026-01-01', '2026-01-16')
    expect(filtered).toHaveLength(16)
    const page1 = paginateRows(filtered, 1, 15)
    const page2 = paginateRows(filtered, 2, 15)
    expect(page1.pages).toBe(2)
    expect(page1.rows).toHaveLength(15)
    expect(page2.rows).toHaveLength(1)
  })

  it('groups newest-first rows by calendar month', () => {
    const groups = groupByMonth([
      tx({ id: 's1', txn_date: '2026-09-14', txn_type: 'credit', amount: 1 }),
      tx({ id: 's2', txn_date: '2026-09-01', txn_type: 'debit', amount: 1 }),
      tx({ id: 'a1', txn_date: '2026-08-26', txn_type: 'credit', amount: 1 }),
    ])
    expect(groups.map((group) => [group.key, group.rows.map((row) => row.id)])).toEqual([
      ['2026-09', ['s1', 's2']],
      ['2026-08', ['a1']],
    ])
  })
})

describe('passbook generation', () => {
  it('creates empty passbooks and does not backfill interest', async () => {
    const before = demoHousehold('vikram@family.test')
    expect(before.passbooks).toHaveLength(0)
    const first = await generateMissingPassbooks(before)
    expect(first.created).toBe(1)
    expect(first.filledAccount).toBe(1)
    const after = demoHousehold('vikram@family.test')
    expect(after.passbooks).toHaveLength(1)
    expect(after.passbookTransactions).toHaveLength(0)
    expect(after.members[0]?.account_number).toBe('01003MS001396')

    const second = await generateMissingPassbooks(after)
    expect(second.created).toBe(0)
    expect(second.alreadyHad).toBe(1)
    expect(demoHousehold('vikram@family.test').passbookTransactions).toHaveLength(0)
  })

  it('creates an empty passbook for a member with no FDs', () => {
    const member = addDemoMember({
      family_id: DEMO_IDS.mulgundFamily,
      full_name: 'No Fd Person',
      display_name: 'Empty',
      bank_customer_id: null,
      notes: null,
    })
    const household = demoHousehold('vikram@family.test')
    expect(household.passbooks.some((row) => row.family_member_id === member.id)).toBe(true)
    expect(household.passbookTransactions).toHaveLength(0)
  })

  it('posts only interest due on or after the passbook was created', async () => {
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('vikram@family.test')
    const passbook = household.passbooks[0]!
    const { added, household: next } = await syncPassbookInterest(
      household,
      passbook,
      new Date('2026-09-14'),
    )
    expect(added).toBe(1)
    expect(next.passbookTransactions).toHaveLength(1)
    expect(next.passbookTransactions[0]?.txn_date).toBe('2026-08-26')
    expect(next.passbookTransactions[0]?.source_type).toBe('fd_interest')
    expect(next.passbookTransactions[0]?.reference).toBe('01FD40599')

    const again = await syncPassbookInterest(next, passbook, new Date('2026-09-14'))
    expect(again.added).toBe(0)
    expect(again.household.passbookTransactions).toHaveLength(1)
  })

  it('refreshes interest across every member passbook', async () => {
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('vikram@family.test')
    const { added } = await syncHouseholdPassbookInterest(household, new Date('2026-09-14'))
    expect(added).toBe(1)
    expect(demoHousehold('vikram@family.test').passbookTransactions).toHaveLength(1)
  })

  it('lets a super admin delete a transaction without posting it again', async () => {
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('admin@family.test')
    const passbook = household.passbooks.find(
      (row) => row.family_member_id === DEMO_IDS.vikramMember,
    )!
    const { household: withInterest } = await syncPassbookInterest(
      household,
      passbook,
      new Date('2026-09-14'),
    )
    const row = withInterest.passbookTransactions[0]!
    expect(row.source_type).toBe('fd_interest')
    await deletePassbookTransaction(withInterest, row)
    const after = demoHousehold('admin@family.test')
    expect(after.passbookTransactions).toHaveLength(0)
    const resynced = await syncPassbookInterest(after, passbook, new Date('2026-09-14'))
    expect(resynced.added).toBe(0)
    expect(resynced.household.passbookTransactions).toHaveLength(0)
  })

  it('blocks delete for a non super admin', async () => {
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('vikram@family.test')
    const passbook = household.passbooks[0]!
    const { household: withInterest } = await syncPassbookInterest(
      household,
      passbook,
      new Date('2026-09-14'),
    )
    await expect(
      deletePassbookTransaction(withInterest, withInterest.passbookTransactions[0]!),
    ).rejects.toThrow(/super admin/)
  })
})
