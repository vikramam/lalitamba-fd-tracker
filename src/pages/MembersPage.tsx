import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { CollapseGroups, useCollapseGroup } from '@/components/CollapseGroups'
import { ChevronIcon } from '@/components/icons'
import { AddIconLink, Page, ScreenTitle } from '@/components/Page'
import { PassbookRefreshButton } from '@/components/PassbookRefreshButton'
import { ShimmerListPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { formatInr } from '@/lib/format'
import { initials } from '@/lib/initials'
import { canManageMembers } from '@/lib/members'
import { canWritePassbook, passbookBalance } from '@/lib/passbooks'
import type { FamilyMember, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function MembersPage() {
  const { household, loading, error, reload } = useHousehold()
  const { alert } = useDialog()
  const canManage = household ? canManageMembers(household) : false
  const canRefresh = household ? canWritePassbook(household) : false

  useEffect(() => {
    if (error) void alert('Could not load', error)
  }, [alert, error])

  if (loading) return <ShimmerListPage />

  const groups = household ? groupMembersByFamily(household) : []

  return (
    <Page>
      <CollapseGroups>
        <ScreenTitle
          eyebrow="People"
          title="Members"
          action={
            <div className="flex items-center gap-2">
              {household && canRefresh ? (
                <PassbookRefreshButton household={household} onSynced={reload} />
              ) : null}
              {canManage ? <AddIconLink to="/members/new" label="Add member" /> : null}
            </div>
          }
        />

        <p className="mt-3 type-body text-muted">
          Tap a name to see their FDs. Refresh posts due passbook interest and updates
          balances.
        </p>

        {household && household.families.length === 0 ? (
          <div className="surface-card mt-8 p-5">
            <p className="type-card-title text-ink">No family yet.</p>
            <p className="mt-2 type-body text-muted">
              Create a family first so you can add people and their FDs.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link to="/settings/families">Manage family</Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {groups.map((group) => (
            <FamilyMemberGroup key={group.id} group={group} household={household} />
          ))}
        </div>
      </CollapseGroups>

      {household && household.members.length === 0 && household.families.length > 0 ? (
        <p className="mt-8 type-body text-muted">No members yet.</p>
      ) : null}
    </Page>
  )
}

function FamilyMemberGroup({
  group,
  household,
}: {
  group: FamilyMemberGroupData
  household: Household | null
}) {
  const [open, setOpen] = useCollapseGroup()
  const panelId = `members-${group.id}`
  const principal = group.members.reduce((sum, member) => {
    const fds = (household?.deposits ?? []).filter(
      (fd) => fd.family_member_id === member.id && fd.status === 'active',
    )
    return sum + fds.reduce((total, fd) => total + fd.principal_amount, 0)
  }, 0)

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl py-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate type-card-title text-ink">{group.name}</span>
          <span className="type-small mt-0.5 block">
            <span className="type-num">{group.members.length}</span>{' '}
            {group.members.length === 1 ? 'member' : 'members'}
            {' · '}
            <span className="type-num">{formatInr(principal)}</span>
          </span>
        </span>
        <ChevronIcon
          className={cn(
            'shrink-0 text-[color:var(--text-tertiary)] transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>

      {open ? (
        <ul id={panelId} className="mt-2 space-y-2">
          {group.members.map((member) => (
            <MemberRow key={member.id} member={member} household={household} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function MemberRow({
  member,
  household,
}: {
  member: FamilyMember
  household: Household | null
}) {
  const fds = (household?.deposits ?? []).filter(
    (fd) => fd.family_member_id === member.id && fd.status === 'active',
  )
  const balance = household ? passbookBalance(household, member.id) : 0

  return (
    <li>
      <Link
        to={`/fds?member=${member.id}`}
        className="surface-card flex items-center gap-3 px-3.5 py-3.5"
      >
        <span className="type-micro flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner font-semibold text-ink">
          {initials(member.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate type-card-title text-ink">{member.full_name}</p>
          <p className="mt-0.5 type-small">
            {member.bank_customer_id ? (
              <>
                CID <span className="type-num">{member.bank_customer_id}</span>
              </>
            ) : (
              'No CID'
            )}
            {' · '}
            <span className="type-num">{fds.length}</span> {fds.length === 1 ? 'FD' : 'FDs'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="type-list-value">{formatInr(balance)}</p>
          <p className="type-small">Passbook</p>
        </div>
      </Link>
    </li>
  )
}

type FamilyMemberGroupData = {
  id: string
  name: string
  members: FamilyMember[]
}

function groupMembersByFamily(household: Household): FamilyMemberGroupData[] {
  const groups = household.families
    .map((family) => ({
      id: family.id,
      name: family.name,
      members: household.members.filter((member) => member.family_id === family.id),
    }))
    .filter((group) => group.members.length > 0)
  const known = new Set(household.families.map((family) => family.id))
  const leftover = household.members.filter((member) => !known.has(member.family_id))
  if (leftover.length > 0) {
    groups.push({ id: 'unknown', name: 'No family', members: leftover })
  }
  return groups
}
