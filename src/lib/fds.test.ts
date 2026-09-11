import { afterEach, describe, expect, it } from 'vitest'

import { demoMembers } from '@/lib/demo-data'
import { resetDemoStore } from '@/lib/demo-store'
import {
  createFd,
  DUPLICATE_FD_ACCOUNT_MESSAGE,
  isDuplicateFdAccountError,
  moveFds,
} from '@/lib/fds'
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

const newDraft = {
  family_member_id: DEMO_IDS.vikramMember,
  fd_account_no: '01FD77777',
  principal_amount: '150000',
  interest_rate_pct: '11',
  tenure_years: '3',
  interest_mode: 'monthly' as const,
  monthly_interest_amount: '1375',
  maturity_value: '150000',
  maturity_date: '2028-05-25',
}

describe('fd account uniqueness', () => {
  it('maps a Postgres duplicate-key error', () => {
    expect(
      isDuplicateFdAccountError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_fds_account_unique"',
      }),
    ).toBe(true)
  })

  it('rejects an account number that already exists in another family', async () => {
    await expect(
      createFd({ ...newDraft, fd_account_no: '01FD00001' }, demoMembers),
    ).rejects.toThrow(DUPLICATE_FD_ACCOUNT_MESSAGE)
  })

  it('rejects a second upload of the same account number', async () => {
    await createFd(newDraft, demoMembers)
    await expect(createFd(newDraft, demoMembers)).rejects.toThrow(DUPLICATE_FD_ACCOUNT_MESSAGE)
  })
})

describe('move FDs', () => {
  it('moves a deposit to another family and member', async () => {
    const household = demoHousehold('admin@family.test')
    await moveFds({
      household,
      fdIds: [DEMO_IDS.fd40599],
      targetMemberId: DEMO_IDS.otherMember,
    })

    const admin = demoHousehold('admin@family.test')
    const moved = admin.deposits.find((fd) => fd.id === DEMO_IDS.fd40599)
    expect(moved?.family_id).toBe(DEMO_IDS.otherFamily)
    expect(moved?.family_member_id).toBe(DEMO_IDS.otherMember)
    expect(
      demoHousehold('vikram@family.test').deposits.find((fd) => fd.id === DEMO_IDS.fd40599),
    ).toBeUndefined()
    expect(
      demoHousehold('other@family.test').deposits.find((fd) => fd.id === DEMO_IDS.fd40599)
        ?.family_member_id,
    ).toBe(DEMO_IDS.otherMember)
  })
})
