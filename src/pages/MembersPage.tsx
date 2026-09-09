import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PencilIcon, TrashIcon } from '@/components/icons'
import { AddIconLink, Page, ScreenTitle } from '@/components/Page'
import { ShimmerListPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { formatInr } from '@/lib/format'
import { initials } from '@/lib/initials'
import { canManageMembers, deleteMember, memberDeleteError } from '@/lib/members'

export function MembersPage() {
  const { household, loading, error, reload } = useHousehold()
  const { alert, confirm, alertError } = useDialog()
  const canManage = household ? canManageMembers(household) : false
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (error) void alert('Could not load', error)
  }, [alert, error])

  if (loading) return <ShimmerListPage />

  async function onDelete(memberId: string, name: string) {
    if (!household) return
    const blocked = memberDeleteError(household, memberId)
    if (blocked) {
      await alert('Cannot delete', blocked)
      return
    }
    const ok = await confirm({
      title: 'Delete member',
      message: `Delete ${name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(memberId)
    try {
      await deleteMember(household, memberId)
      await reload()
    } catch (cause) {
      await alertError(cause, 'Could not delete that person.', 'Cannot delete')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Page>
      <ScreenTitle
        eyebrow="People"
        title="Members"
        action={canManage ? <AddIconLink to="/members/new" label="Add member" /> : null}
      />

      <p className="mt-3 text-[13px] text-muted">
        Tap a name to see their FDs. Use the pencil to change their details.
        Add or edit a family in Settings.
      </p>

      {household && household.families.length === 0 ? (
        <div className="surface-card mt-8 p-5">
          <p className="text-[13.5px] font-medium text-ink">No family yet.</p>
          <p className="mt-2 text-[13px] text-muted">
            Create a family first so you can add people and their FDs.
          </p>
          <Button asChild className="mt-6" size="lg">
            <Link to="/settings/families">Manage family</Link>
          </Button>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2">
        {household?.members.map((member) => {
          const fds = household.deposits.filter(
            (fd) => fd.family_member_id === member.id && fd.status === 'active',
          )
          const principal = fds.reduce((sum, fd) => sum + fd.principal_amount, 0)
          const familyName = household.families.find(
            (family) => family.id === member.family_id,
          )?.name

          return (
            <li key={member.id} className="surface-card flex items-center gap-3 px-3.5 py-3.5">
              <Link to={`/fds?member=${member.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner text-[10px] font-semibold text-ink">
                  {initials(member.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">{member.full_name}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {member.bank_customer_id ? `CID ${member.bank_customer_id}` : 'No CID'}
                    {familyName ? ` · ${familyName}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[13px]">{formatInr(principal)}</p>
                  <p className="text-[11px] text-muted">
                    {fds.length} {fds.length === 1 ? 'FD' : 'FDs'}
                  </p>
                </div>
              </Link>
              {canManage ? (
                <div className="flex shrink-0 items-center">
                  <Link
                    to={`/members/${member.id}`}
                    aria-label={`Edit ${member.full_name}`}
                    className="flex size-8 items-center justify-center rounded-lg text-accent"
                  >
                    <PencilIcon className="size-4" />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${member.full_name}`}
                    disabled={busyId === member.id}
                    className="flex size-8 items-center justify-center rounded-lg text-danger disabled:opacity-50"
                    onClick={() => void onDelete(member.id, member.full_name)}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {household && household.members.length === 0 && household.families.length > 0 ? (
        <p className="mt-8 text-[13px] text-muted">No members yet.</p>
      ) : null}
    </Page>
  )
}
