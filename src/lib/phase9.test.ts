import { afterEach, describe, expect, it } from 'vitest'

import { demoDeposits, demoMembers } from '@/lib/demo-data'
import { resetDemoStore } from '@/lib/demo-store'
import { summarizeDashboard } from '@/lib/dashboard'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'
import {
  canLifecycle,
  closeFd,
  isPrematureClose,
  renewFd,
  suggestedCarry,
} from '@/lib/lifecycle'

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

const monthly = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd40599)!
const maturity = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd32450)!

describe('close', () => {
  it('marks a mid-term close as premature and drops it from totals', async () => {
    expect(isPrematureClose(monthly, '2026-09-07')).toBe(true)
    const closed = await closeFd({
      fd: monthly,
      closedOn: '2026-09-07',
      amountReceived: 148000,
    })
    expect(closed.is_premature).toBe(true)
    const household = demoHousehold('vikram@family.test')
    expect(household.deposits.find((fd) => fd.id === monthly.id)?.status).toBe('closed')
    const summary = summarizeDashboard(
      household.deposits.filter((fd) => fd.family_id === DEMO_IDS.mulgundFamily),
      household.members,
    )
    expect(summary.principal).toBe(450000)
    expect(household.closures).toHaveLength(1)
  })

  it('rejects a second close', async () => {
    await closeFd({ fd: monthly, closedOn: '2026-09-07', amountReceived: 150000 })
    const household = demoHousehold('vikram@family.test')
    const updated = household.deposits.find((fd) => fd.id === monthly.id)!
    await expect(
      closeFd({
        fd: updated,
        closedOn: '2026-09-08',
        amountReceived: 150000,
        existing: household.closures[0],
      }),
    ).rejects.toThrow('already closed')
  })
})

describe('renew', () => {
  it('creates a new active FD and keeps the old receipt on the renewed row', async () => {
    expect(suggestedCarry(maturity)).toBe(697500)
    const { next, renewal } = await renewFd({
      previous: maturity,
      members: demoMembers,
      draft: {
        family_member_id: DEMO_IDS.vikramMember,
        fd_account_no: '01FD99998',
        principal_amount: '697500',
        interest_rate_pct: '11',
        tenure_years: '3',
        interest_mode: 'monthly',
        monthly_interest_amount: '6394',
        maturity_value: '697500',
        maturity_date: '2029-10-23',
      },
    })
    expect(next.status).toBe('active')
    expect(renewal.previous_fd_id).toBe(maturity.id)
    const household = demoHousehold('vikram@family.test')
    expect(household.deposits.find((fd) => fd.id === maturity.id)?.status).toBe('renewed')
    expect(household.deposits.find((fd) => fd.id === next.id)?.fd_account_no).toBe('01FD99998')
    const summary = summarizeDashboard(
      household.deposits.filter((fd) => fd.family_id === DEMO_IDS.mulgundFamily),
      household.members,
    )
    expect(summary.principal).toBe(150000 + 697500)
    expect(household.renewals).toHaveLength(1)
  })

  it('cannot close a renewed FD or renew a closed FD', async () => {
    await renewFd({
      previous: monthly,
      members: demoMembers,
      draft: {
        family_member_id: DEMO_IDS.vikramMember,
        fd_account_no: '01FD88888',
        principal_amount: '150000',
        tenure_years: '3',
        interest_mode: 'monthly',
        maturity_date: '2029-05-25',
      },
    })
    const afterRenew = demoHousehold('vikram@family.test')
    const old = afterRenew.deposits.find((fd) => fd.id === monthly.id)!
    expect(canLifecycle(old)).toBe(false)
    await expect(
      closeFd({
        fd: old,
        closedOn: '2026-09-07',
        amountReceived: 150000,
      }),
    ).rejects.toThrow('renewed FD cannot be closed')

    await closeFd({
      fd: afterRenew.deposits.find((fd) => fd.id === DEMO_IDS.fd32450)!,
      closedOn: '2026-09-07',
      amountReceived: 450000,
    })
    const afterClose = demoHousehold('vikram@family.test')
    const closed = afterClose.deposits.find((fd) => fd.id === DEMO_IDS.fd32450)!
    await expect(
      renewFd({
        previous: closed,
        members: demoMembers,
        draft: {
          family_member_id: DEMO_IDS.vikramMember,
          principal_amount: '450000',
          tenure_years: '1',
          interest_mode: 'monthly',
          maturity_date: '2027-09-07',
        },
      }),
    ).rejects.toThrow('closed FD cannot be renewed')
  })
})
