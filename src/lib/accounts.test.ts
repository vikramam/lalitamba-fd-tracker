import { afterEach, describe, expect, it } from 'vitest'

import {
  deleteManagedAccount,
  listManagedAccounts,
  registerDemoSignup,
  setAccountAdmin,
  setAccountApproval,
} from '@/lib/accounts'
import { findDemoAccount, resetDemoAccounts } from '@/lib/demo-accounts'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'

const memory = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  },
  configurable: true,
})

afterEach(() => {
  memory.clear()
  resetDemoAccounts()
})

describe('account approval', () => {
  it('puts a new sign-up in waiting status', () => {
    const account = registerDemoSignup('new.person@family.test')
    expect(account.approval_status).toBe('pending')
    expect(findDemoAccount('new.person@family.test')?.approval_status).toBe('pending')
  })

  it('lets an admin approve, reject, and delete a waiting account', async () => {
    const created = registerDemoSignup('wait@family.test')
    await setAccountApproval('admin@family.test', created.id, 'approved')
    expect(findDemoAccount('wait@family.test')?.approval_status).toBe('approved')

    await setAccountApproval('admin@family.test', created.id, 'rejected')
    expect(findDemoAccount('wait@family.test')?.approval_status).toBe('rejected')

    await deleteManagedAccount('admin@family.test', created.id)
    expect(findDemoAccount('wait@family.test')).toBeNull()
  })

  it('stops a regular admin from granting admin', async () => {
    const helper = registerDemoSignup('helper@family.test')
    const other = registerDemoSignup('next@family.test')
    await setAccountApproval('admin@family.test', helper.id, 'approved')
    await setAccountApproval('admin@family.test', other.id, 'approved')
    await setAccountAdmin('admin@family.test', helper.id, true)

    await expect(setAccountAdmin('helper@family.test', other.id, true)).rejects.toThrow(
      'Only a super admin can change admin access.',
    )
  })

  it('lets only a super admin make and remove admins', async () => {
    const created = registerDemoSignup('ledger@family.test')
    await setAccountApproval('admin@family.test', created.id, 'approved')
    await setAccountAdmin('admin@family.test', created.id, true)
    expect(findDemoAccount('ledger@family.test')?.is_app_admin).toBe(true)
    await setAccountAdmin('admin@family.test', created.id, false)
    expect(findDemoAccount('ledger@family.test')?.is_app_admin).toBe(false)
  })

  it('does not let anyone change or delete the super admin', async () => {
    await expect(
      setAccountApproval('admin@family.test', DEMO_IDS.admin, 'rejected'),
    ).rejects.toThrow('Cannot change your own account.')
    await expect(deleteManagedAccount('admin@family.test', DEMO_IDS.admin)).rejects.toThrow(
      'Cannot delete your own account.',
    )
  })

  it('hides the accounts list from a non-admin', async () => {
    await expect(listManagedAccounts('vikram@family.test')).rejects.toThrow("You don't have access")
  })

  it('marks the demo admin as super admin', () => {
    const household = demoHousehold('admin@family.test')
    expect(household.isAppAdmin).toBe(true)
    expect(household.isSuperAdmin).toBe(true)
    expect(demoHousehold('vikram@family.test').isSuperAdmin).toBe(false)
  })
})
