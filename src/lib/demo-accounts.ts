import { DEMO_IDS } from '@/lib/ids'
import type { AccountApproval, ManagedAccount } from '@/lib/types'

const ACCOUNT_KEY = 'lalitamba.demo.accounts'

export const SEED_ACCOUNTS: ManagedAccount[] = [
  {
    id: DEMO_IDS.admin,
    email: 'admin@family.test',
    full_name: 'Admin',
    approval_status: 'approved',
    is_app_admin: true,
    is_super_admin: true,
  },
  {
    id: DEMO_IDS.vikram,
    email: 'vikram@family.test',
    full_name: 'Vikram',
    approval_status: 'approved',
    is_app_admin: false,
    is_super_admin: false,
  },
  {
    id: DEMO_IDS.other,
    email: 'other@family.test',
    full_name: 'Other',
    approval_status: 'approved',
    is_app_admin: false,
    is_super_admin: false,
  },
]

function readExtras(): ManagedAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ManagedAccount[]
  } catch {
    return []
  }
}

function writeExtras(rows: ManagedAccount[]) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(rows))
}

export function resetDemoAccounts() {
  localStorage.removeItem(ACCOUNT_KEY)
}

export function listDemoAccounts(): ManagedAccount[] {
  const extras = readExtras()
  const rows = new Map(SEED_ACCOUNTS.map((row) => [row.id, row]))
  for (const row of extras) rows.set(row.id, row)
  return [...rows.values()].sort((left, right) => left.email.localeCompare(right.email))
}

export function findDemoAccount(email: string) {
  const trimmed = email.trim().toLowerCase()
  return listDemoAccounts().find((row) => row.email === trimmed) ?? null
}

export function addDemoAccount(email: string): ManagedAccount {
  const trimmed = email.trim().toLowerCase()
  const existing = findDemoAccount(trimmed)
  if (existing) return existing
  const row: ManagedAccount = {
    id: crypto.randomUUID(),
    email: trimmed,
    full_name: trimmed.split('@')[0] ?? trimmed,
    approval_status: 'pending',
    is_app_admin: false,
    is_super_admin: false,
  }
  writeExtras([...readExtras(), row])
  return row
}

export function updateDemoAccount(
  id: string,
  patch: Partial<Pick<ManagedAccount, 'approval_status' | 'is_app_admin'>>,
): ManagedAccount {
  const current = listDemoAccounts().find((row) => row.id === id)
  if (!current) throw new Error('Account not found.')
  const next: ManagedAccount = {
    ...current,
    ...patch,
    is_app_admin:
      patch.approval_status && patch.approval_status !== 'approved'
        ? false
        : (patch.is_app_admin ?? current.is_app_admin),
  }
  const extras = readExtras().filter((row) => row.id !== id)
  extras.push(next)
  writeExtras(extras)
  return next
}

export function deleteDemoAccount(id: string) {
  const current = listDemoAccounts().find((row) => row.id === id)
  if (!current) throw new Error('Account not found.')
  const extras = readExtras().filter((row) => row.id !== id)
  if (SEED_ACCOUNTS.some((row) => row.id === id)) {
    extras.push({
      ...current,
      approval_status: 'rejected',
      is_app_admin: false,
    })
  }
  writeExtras(extras)
}

export function approvalMessage(status: AccountApproval | null | undefined) {
  if (status === 'pending') {
    return 'Your account is pending approval. An admin must approve it before you can sign in.'
  }
  if (status === 'rejected') {
    return 'This account was not approved. Contact an admin if that is a mistake.'
  }
  return 'No account for that email.'
}
