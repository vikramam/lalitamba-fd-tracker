import { afterEach, describe, expect, it } from 'vitest'

import { demoMembers } from '@/lib/demo-data'
import { addDemoFd, resetDemoStore } from '@/lib/demo-store'
import { fdCheckMessages } from '@/lib/fd-checks'
import { normalizeFdInput } from '@/lib/fd-input'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'

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

const monthlyDraft = {
  family_member_id: DEMO_IDS.vikramMember,
  fd_account_no: '01FD99999',
  principal_amount: '150000',
  interest_rate_pct: '11',
  tenure_years: '3',
  interest_mode: 'monthly' as const,
  monthly_interest_amount: '1375',
  maturity_value: '150000',
  maturity_date: '2028-05-25',
}

describe('normalizeFdInput', () => {
  it('rejects principal 0', () => {
    expect(() =>
      normalizeFdInput({ ...monthlyDraft, principal_amount: '0' }, demoMembers),
    ).toThrow('Principal must be greater than 0.')
  })

  it('rejects rate 80', () => {
    expect(() =>
      normalizeFdInput({ ...monthlyDraft, interest_rate_pct: '80' }, demoMembers),
    ).toThrow('Interest rate must be between 0 and 30%.')
  })

  it('rejects a missing member', () => {
    expect(() =>
      normalizeFdInput(
        { ...monthlyDraft, family_member_id: 'not-a-member' },
        demoMembers,
      ),
    ).toThrow('Choose a member.')
  })

  it('accepts the monthly sample', () => {
    const row = normalizeFdInput(monthlyDraft, demoMembers)
    expect(row.family_id).toBe(DEMO_IDS.mulgundFamily)
    expect(row.principal_amount).toBe(150000)
    expect(row.interest_rate_pct).toBe(11)
    expect(row.tenure_label).toBe('3 Years')
    expect(fdCheckMessages({ ...row, id: 'x' })).toEqual([])
  })

  it('accepts the on-maturity sample', () => {
    const row = normalizeFdInput(
      {
        family_member_id: DEMO_IDS.vikramMember,
        principal_amount: '450000',
        interest_rate_pct: '11',
        tenure_years: '5',
        interest_mode: 'on_maturity',
        maturity_value: '697500',
        maturity_date: '2028-10-23',
      },
      demoMembers,
    )
    expect(row.monthly_interest_amount).toBeNull()
    expect(fdCheckMessages({ ...row, id: 'x' })).toEqual([])
  })

  it('keeps the payout amount for a quarterly FD', () => {
    const row = normalizeFdInput(
      {
        family_member_id: DEMO_IDS.vikramMember,
        principal_amount: '150000',
        interest_rate_pct: '11',
        tenure_years: '3',
        interest_mode: 'quarterly',
        monthly_interest_amount: '4125',
        interest_credit_account: '01003MS001396',
        maturity_value: '150000',
      },
      demoMembers,
    )
    expect(row.interest_mode).toBe('quarterly')
    expect(row.monthly_interest_amount).toBe(4125)
    expect(row.interest_credit_account).toBe('01003MS001396')
    expect(fdCheckMessages({ ...row, id: 'x' })).toEqual([])
  })
})

describe('fd isolation', () => {
  it('hides another family’s deposit from member URLs', () => {
    const other = demoHousehold('other@family.test')
    expect(other.deposits.find((fd) => fd.id === DEMO_IDS.fd40599)).toBeUndefined()
    expect(other.deposits.map((fd) => fd.fd_account_no)).toEqual(['01FD00001'])
  })

  it('does not show a newly added Mulgund FD to the other family', () => {
    const row = normalizeFdInput(monthlyDraft, demoMembers)
    addDemoFd(row)
    const vikram = demoHousehold('vikram@family.test')
    const other = demoHousehold('other@family.test')
    expect(vikram.deposits.map((fd) => fd.fd_account_no)).toContain('01FD99999')
    expect(other.deposits.map((fd) => fd.fd_account_no)).not.toContain('01FD99999')
  })
})
