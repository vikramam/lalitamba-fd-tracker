import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { BackLink, Page, ScreenTitle } from '@/components/Page'
import { ShimmerSettingsPage } from '@/components/Shimmer'
import { StatusBadge } from '@/components/StatusBadge'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import {
  deleteManagedAccount,
  listManagedAccounts,
  setAccountAdmin,
  setAccountApproval,
} from '@/lib/accounts'
import type { AccountApproval, ManagedAccount } from '@/lib/types'

function statusTone(status: AccountApproval): 'success' | 'warn' | 'danger' | 'muted' {
  if (status === 'approved') return 'success'
  if (status === 'pending') return 'warn'
  return 'danger'
}

function roleLabel(account: ManagedAccount) {
  if (account.is_super_admin) return 'Super admin'
  if (account.is_app_admin) return 'Admin'
  return 'User'
}

export function AdminAccountsPage() {
  const { user } = useAuth()
  const { household, loading } = useHousehold()
  const { confirm, alertError } = useDialog()
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const canManage = Boolean(household?.isAppAdmin)
  const isSuperAdmin = Boolean(household?.isSuperAdmin)

  async function reloadAccounts() {
    if (!user || !canManage) return
    const rows = await listManagedAccounts(user.email)
    setAccounts(rows)
  }

  useEffect(() => {
    if (!user || !canManage) return
    void reloadAccounts().catch((cause) => {
      void alertError(cause, 'Could not load accounts.', 'Could not load')
    })
  }, [user, canManage])

  const groups = useMemo(
    () => ({
      pending: accounts.filter((row) => row.approval_status === 'pending'),
      rejected: accounts.filter((row) => row.approval_status === 'rejected'),
      approved: accounts.filter((row) => row.approval_status === 'approved'),
    }),
    [accounts],
  )

  if (loading) return <ShimmerSettingsPage />

  if (!canManage) {
    return (
      <Page>
        <p className="text-[13px] text-muted">Only an app admin can manage accounts.</p>
        <Link to="/settings" className="mt-4 inline-block text-[13px] text-accent">
          Back to settings
        </Link>
      </Page>
    )
  }

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id)
    try {
      await action()
      await reloadAccounts()
    } catch (cause) {
      await alertError(cause, 'Could not update that account.')
    } finally {
      setBusyId(null)
    }
  }

  function AccountRow({ account }: { account: ManagedAccount }) {
    const self = account.id === user?.id
    const locked = account.is_super_admin || self
    const working = busyId === account.id

    return (
      <li className="border-t border-line py-3 first:border-t-0 first:pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] text-ink">{account.email}</p>
            <p className="mt-1 text-[12px] text-muted">{roleLabel(account)}</p>
          </div>
          <StatusBadge tone={statusTone(account.approval_status)}>
            {account.approval_status}
          </StatusBadge>
        </div>
        {locked ? (
          <p className="mt-2 text-[12px] text-muted">
            {self ? 'This is you.' : 'Super admin accounts cannot be changed here.'}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {account.approval_status !== 'approved' ? (
              <button
                type="button"
                disabled={working}
                className="text-[13px] text-accent disabled:opacity-50"
                onClick={() =>
                  void run(account.id, () =>
                    setAccountApproval(user!.email, account.id, 'approved'),
                  )
                }
              >
                Approve
              </button>
            ) : null}
            {account.approval_status !== 'rejected' ? (
              <button
                type="button"
                disabled={working}
                className="text-[13px] text-accent disabled:opacity-50"
                onClick={() =>
                  void run(account.id, () =>
                    setAccountApproval(user!.email, account.id, 'rejected'),
                  )
                }
              >
                Reject
              </button>
            ) : null}
            {isSuperAdmin && account.approval_status === 'approved' && !account.is_app_admin ? (
              <button
                type="button"
                disabled={working}
                className="text-[13px] text-accent disabled:opacity-50"
                onClick={() =>
                  void run(account.id, () => setAccountAdmin(user!.email, account.id, true))
                }
              >
                Make admin
              </button>
            ) : null}
            {isSuperAdmin && account.is_app_admin ? (
              <button
                type="button"
                disabled={working}
                className="text-[13px] text-accent disabled:opacity-50"
                onClick={() =>
                  void run(account.id, () => setAccountAdmin(user!.email, account.id, false))
                }
              >
                Remove admin
              </button>
            ) : null}
            <button
              type="button"
              disabled={working}
              className="text-[13px] text-danger disabled:opacity-50"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: 'Delete account',
                    message: `Delete ${account.email}? They will not be able to sign in.`,
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                  if (!ok) return
                  await run(account.id, () => deleteManagedAccount(user!.email, account.id))
                })()
              }}
            >
              Delete
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <Page>
      <BackLink to="/settings" />
      <div className="mt-4">
        <ScreenTitle eyebrow="Admin" title="Accounts" />
      </div>
      <p className="mt-3 text-[13px] text-muted">
        New sign-ups wait here until you approve them.
        {isSuperAdmin ? ' Only you can make or remove admins.' : ''}
      </p>

      <AccountSection title="Waiting for approval" empty="No one is waiting." rows={groups.pending} />
      <AccountSection title="Rejected" empty="No rejected accounts." rows={groups.rejected} />
      <AccountSection title="Approved" empty="No approved accounts." rows={groups.approved} />
    </Page>
  )

  function AccountSection({
    title,
    empty,
    rows,
  }: {
    title: string
    empty: string
    rows: ManagedAccount[]
  }) {
    return (
      <section className="surface-card mt-6 p-4">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          {title}
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">{empty}</p>
        ) : (
          <ul className="mt-3">
            {rows.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ul>
        )}
      </section>
    )
  }
}
