import { afterEach, describe, expect, it } from 'vitest'

import { demoDeposits } from '@/lib/demo-data'
import {
  addDemoMember,
  addDemoPassbook,
  resetDemoStore,
  updateDemoFd,
  updateDemoMember,
} from '@/lib/demo-store'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'
import { isPassbookPublicId, nextPublicId } from '@/lib/passbook-id'
import {
  interestCredits,
  msAccountsForMember,
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

function setDemoBankTransfer(enabledAt: string, bankAccount: string | null = '123445677') {
  const member = demoHousehold('vikram@family.test').members.find(
    (row) => row.id === DEMO_IDS.vikramMember,
  )!
  updateDemoMember(member.id, {
    full_name: member.full_name,
    display_name: member.display_name,
    bank_customer_id: member.bank_customer_id,
    account_number: member.account_number,
    interest_credit_bank_account: bankAccount,
    bank_name: 'Test Bank',
    notes: member.notes,
  })
  const fd = demoDeposits[0]!
  const { id: _id, ...write } = fd
  updateDemoFd(fd.id, {
    ...write,
    credit_interest_to_bank: true,
    credit_interest_to_bank_enabled_at: enabledAt,
  })
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
  it('credits a partial first month on the following first day', () => {
    const monthly = {
      ...demoDeposits[0]!,
      fd_date: '2026-09-16',
      transaction_date: '2026-09-16',
    }
    expect(interestCredits(monthly, '2026-09-16', [], [], new Date('2026-10-01'))).toEqual([
      {
        periodStart: '2026-09-16',
        periodEnd: '2026-09-30',
        creditDate: '2026-10-01',
        amount: 678.08,
      },
    ])
    expect(interestCredits(monthly, '2026-09-16', [], [], new Date('2026-09-30'))).toEqual([])
  })

  it('uses first-of-month dates for existing monthly FDs after cutover', () => {
    const monthly = demoDeposits[0]!
    expect(interestCredits(monthly, '2026-08-26', [], [], new Date('2026-12-01'))).toEqual([
      {
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        creditDate: '2026-10-01',
        amount: 1375,
      },
      {
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        creditDate: '2026-11-01',
        amount: 1375,
      },
      {
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        creditDate: '2026-12-01',
        amount: 1375,
      },
    ])
  })

  it('handles leap-year partial months using actual days', () => {
    const monthly = {
      ...demoDeposits[0]!,
      fd_date: '2028-02-16',
      transaction_date: '2028-02-16',
    }
    expect(interestCredits(monthly, '2028-02-16', [], [], new Date('2028-03-01'))[0]).toEqual({
      periodStart: '2028-02-16',
      periodEnd: '2028-02-29',
      creditDate: '2028-03-01',
      amount: 631.15,
    })
  })

  it('uses a partial first month then rolling three-month quarterly cycles', () => {
    const quarterly = {
      ...demoDeposits[0]!,
      interest_mode: 'quarterly' as const,
      monthly_interest_amount: 4125,
      fd_date: '2026-09-16',
      transaction_date: '2026-09-16',
    }
    expect(interestCredits(quarterly, '2026-09-16', [], [], new Date('2027-01-01'))).toEqual([
      {
        periodStart: '2026-09-16',
        periodEnd: '2026-09-30',
        creditDate: '2026-10-01',
        amount: 678.08,
      },
      {
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        creditDate: '2027-01-01',
        amount: 4125,
      },
    ])
  })

  it('credits a stub from the 1st through maturity on the maturity date', () => {
    const monthly = {
      ...demoDeposits[0]!,
      fd_date: '2026-09-16',
      transaction_date: '2026-09-16',
      maturity_date: '2026-10-16',
    }
    expect(interestCredits(monthly, '2026-09-16', [], [], new Date('2026-10-15'))).toEqual([
      {
        periodStart: '2026-09-16',
        periodEnd: '2026-09-30',
        creditDate: '2026-10-01',
        amount: 678.08,
      },
    ])
    expect(interestCredits(monthly, '2026-09-16', [], [], new Date('2026-10-16'))).toEqual([
      {
        periodStart: '2026-09-16',
        periodEnd: '2026-09-30',
        creditDate: '2026-10-01',
        amount: 678.08,
      },
      {
        periodStart: '2026-10-01',
        periodEnd: '2026-10-16',
        creditDate: '2026-10-16',
        amount: 723.29,
        final: true,
      },
    ])
    expect(
      interestCredits(
        { ...monthly, maturity_date: '2028-09-16' },
        '2026-09-16',
        [],
        [],
        new Date('2028-09-16'),
      ).at(-1),
    ).toEqual({
      periodStart: '2028-09-01',
      periodEnd: '2028-09-16',
      creditDate: '2028-09-16',
      amount: 721.31,
      final: true,
    })
  })

  it('credits a stub through maturity for an unfinished quarterly cycle', () => {
    const quarterly = {
      ...demoDeposits[0]!,
      interest_mode: 'quarterly' as const,
      monthly_interest_amount: 4125,
      fd_date: '2026-09-16',
      transaction_date: '2026-09-16',
      maturity_date: '2026-12-16',
    }
    expect(interestCredits(quarterly, '2026-09-16', [], [], new Date('2026-12-16'))).toEqual([
      {
        periodStart: '2026-09-16',
        periodEnd: '2026-09-30',
        creditDate: '2026-10-01',
        amount: 678.08,
      },
      {
        periodStart: '2026-10-01',
        periodEnd: '2026-12-16',
        creditDate: '2026-12-16',
        amount: 3480.82,
        final: true,
      },
    ])
  })

  it('does not keep crediting after the FD maturity date', () => {
    const monthly = demoDeposits[0]!
    expect(
      interestCredits(
        { ...monthly, status: 'matured', maturity_date: '2026-08-01' },
        '2026-06-01',
        [],
        [],
        new Date('2026-09-14'),
      ),
    ).toEqual([])
    expect(
      interestCredits(
        { ...monthly, maturity_date: '2026-08-01' },
        '2026-06-01',
        [],
        [],
        new Date('2026-09-14'),
      ),
    ).toEqual([])
  })

  it('does not create passbook interest for other interest modes', () => {
    const onMaturity = demoDeposits[1]!
    expect(interestCredits(onMaturity, '2026-09-01', [], [], new Date('2027-01-01'))).toEqual([])
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
      new Date('2026-10-01'),
    )
    expect(added).toBe(1)
    expect(next.passbookTransactions).toHaveLength(1)
    expect(next.passbookTransactions[0]?.txn_date).toBe('2026-10-01')
    expect(next.passbookTransactions[0]?.amount).toBe(1375)
    expect(next.passbookTransactions[0]?.source_type).toBe('fd_interest')
    expect(next.passbookTransactions[0]?.reference).toBe('01FD40599')

    const again = await syncPassbookInterest(next, passbook, new Date('2026-10-01'))
    expect(again.added).toBe(0)
    expect(again.household.passbookTransactions).toHaveLength(1)
  })

  it('pairs a new interest credit with one bank-transfer debit', async () => {
    setDemoBankTransfer('2026-09-16T00:00:00.000Z')
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('vikram@family.test')
    const passbook = household.passbooks[0]!
    const first = await syncPassbookInterest(household, passbook, new Date('2026-10-01'))
    expect(first.added).toBe(2)
    expect(
      first.household.passbookTransactions.map((row) => [
        row.txn_type,
        row.amount,
        row.balance_after,
        row.source_type,
      ]),
    ).toEqual([
      ['credit', 1375, 1375, 'fd_interest'],
      ['debit', 1375, 0, 'fd_interest_bank'],
    ])
    expect(first.household.passbookTransactions[1]?.remarks).toBe(
      'Interest credited to Bank · Interest Credit Bank Ac/No: 123445677',
    )

    const again = await syncPassbookInterest(
      first.household,
      passbook,
      new Date('2026-10-01'),
    )
    expect(again.added).toBe(0)
    expect(again.household.passbookTransactions).toHaveLength(2)
  })

  it('uses a dash when the member has no bank account', async () => {
    setDemoBankTransfer('2026-09-16T00:00:00.000Z', null)
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('vikram@family.test')
    const result = await syncPassbookInterest(
      household,
      household.passbooks[0]!,
      new Date('2026-10-01'),
    )
    expect(result.household.passbookTransactions[1]?.remarks).toBe(
      'Interest credited to Bank · Interest Credit Bank Ac/No: -',
    )
  })

  it('does not transfer interest entries created before the toggle was enabled', async () => {
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const before = demoHousehold('vikram@family.test')
    const passbook = before.passbooks[0]!
    const credited = await syncPassbookInterest(before, passbook, new Date('2026-10-01'))
    const enabledAt = new Date(
      Date.parse(credited.household.passbookTransactions[0]!.created_at) + 1,
    ).toISOString()
    setDemoBankTransfer(enabledAt)
    const current = demoHousehold('vikram@family.test')
    const refreshed = await syncPassbookInterest(current, passbook, new Date('2026-10-01'))
    expect(refreshed.added).toBe(0)
    expect(refreshed.household.passbookTransactions).toHaveLength(1)
  })

  it('posts a final interest credit on the FD maturity date', async () => {
    const monthly = demoDeposits[0]!
    updateDemoFd(monthly.id, {
      family_id: monthly.family_id,
      family_member_id: monthly.family_member_id,
      fd_account_no: monthly.fd_account_no,
      bank_customer_id: monthly.bank_customer_id,
      holder_name: monthly.holder_name,
      holder_address: monthly.holder_address,
      principal_amount: monthly.principal_amount,
      principal_amount_words: monthly.principal_amount_words,
      interest_rate_pct: monthly.interest_rate_pct,
      tenure_years: monthly.tenure_years,
      tenure_months: monthly.tenure_months,
      tenure_days: monthly.tenure_days,
      tenure_label: monthly.tenure_label,
      interest_mode: monthly.interest_mode,
      monthly_interest_amount: monthly.monthly_interest_amount,
      interest_credit_account: monthly.interest_credit_account,
      credit_interest_to_bank: false,
      credit_interest_to_bank_enabled_at: null,
      maturity_value: monthly.maturity_value,
      fd_date: '2026-09-16',
      transaction_date: '2026-09-16',
      print_at: monthly.print_at,
      maturity_date: '2026-10-16',
      nominee_name: monthly.nominee_name,
      nominee_relationship: monthly.nominee_relationship,
      status: 'active',
      notes: monthly.notes,
    })
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-09-16',
    })
    const household = demoHousehold('vikram@family.test')
    const passbook = household.passbooks[0]!
    const { added, household: next } = await syncPassbookInterest(
      household,
      passbook,
      new Date('2026-10-16'),
    )
    expect(added).toBe(2)
    const final = next.passbookTransactions.find((row) => row.txn_date === '2026-10-16')
    expect(final?.amount).toBe(723.29)
    expect(final?.remarks).toBe(
      'Final interest credit for FD: 01FD40599 · 01-10-2026 to 16-10-2026',
    )
    const again = await syncPassbookInterest(next, passbook, new Date('2026-10-20'))
    expect(again.added).toBe(0)
  })

  it('refreshes interest across every member passbook', async () => {
    addDemoPassbook({
      family_id: DEMO_IDS.mulgundFamily,
      family_member_id: DEMO_IDS.vikramMember,
      created_on: '2026-08-26',
    })
    const household = demoHousehold('vikram@family.test')
    const { added } = await syncHouseholdPassbookInterest(household, new Date('2026-10-01'))
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
      new Date('2026-10-01'),
    )
    const row = withInterest.passbookTransactions[0]!
    expect(row.source_type).toBe('fd_interest')
    await deletePassbookTransaction(withInterest, row)
    const after = demoHousehold('admin@family.test')
    expect(after.passbookTransactions).toHaveLength(0)
    const resynced = await syncPassbookInterest(after, passbook, new Date('2026-10-01'))
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
      new Date('2026-10-01'),
    )
    await expect(
      deletePassbookTransaction(withInterest, withInterest.passbookTransactions[0]!),
    ).rejects.toThrow(/super admin/)
  })
})
