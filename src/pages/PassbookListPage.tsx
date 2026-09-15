import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { CollapseGroups, useCollapseGroup } from '@/components/CollapseGroups'
import { ChevronIcon } from '@/components/icons'
import { Page, ScreenTitle } from '@/components/Page'
import { PassbookRefreshButton } from '@/components/PassbookRefreshButton'
import { ShimmerListPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { formatDate, formatInr } from '@/lib/format'
import { initials } from '@/lib/initials'
import { canManageMembers } from '@/lib/members'
import { canWritePassbook, lastTxnDate, passbookBalance, txsForPassbook } from '@/lib/passbooks'
import type { FamilyMember, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PassbookListPage() {
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
          eyebrow="Accounts"
          title="Passbook"
          action={
            household && canRefresh ? (
              <PassbookRefreshButton household={household} onSynced={reload} />
            ) : null
          }
        />
        <p className="mt-3 type-body text-muted">
          Tap a member to open their passbook. New books start empty until you post a
          credit or debit, or later interest is due.
        </p>

        {household && household.families.length === 0 ? (
          <div className="surface-card mt-8 p-5">
            <p className="type-card-title text-ink">No family yet.</p>
            <p className="mt-2 type-body text-muted">
              Create a family first so you can add people and passbooks.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link to="/settings/families">Manage family</Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {groups.map((group) => (
            <FamilyPassbookGroup key={group.id} group={group} household={household} />
          ))}
        </div>
      </CollapseGroups>

      {household && household.members.length === 0 && household.families.length > 0 ? (
        <p className="mt-8 type-body text-muted">No members yet.</p>
      ) : null}

      {household && household.members.length > 0 && canManage ? (
        <p className="mt-8 type-body text-muted">
          Existing members without a passbook can be filled from Settings → Generate
          passbooks.
        </p>
      ) : null}
    </Page>
  )
}

function FamilyPassbookGroup({
  group,
  household,
}: {
  group: FamilyMemberGroupData
  household: Household | null
}) {
  const [open, setOpen] = useCollapseGroup()
  const panelId = `passbook-${group.id}`
  const total = group.members.reduce(
    (sum, member) => sum + (household ? passbookBalance(household, member.id) : 0),
    0,
  )

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
            {group.members.length === 1 ? 'passbook' : 'passbooks'}
            {' · '}
            <span className="type-num">{formatInr(total)}</span>
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
            <PassbookRow key={member.id} member={member} household={household} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function PassbookRow({
  member,
  household,
}: {
  member: FamilyMember
  household: Household | null
}) {
  const name = member.display_name || member.full_name
  const balance = household ? passbookBalance(household, member.id) : 0
  const passbook = household?.passbooks.find((row) => row.family_member_id === member.id)
  const last = passbook && household ? lastTxnDate(txsForPassbook(household, passbook.id)) : null

  return (
    <li>
      <Link
        to={`/passbooks/${member.id}`}
        className="surface-card flex items-center gap-3 px-3.5 py-3.5"
      >
        <span className="type-micro flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner font-semibold text-ink">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate type-card-title text-ink">{name}</p>
          <p className="mt-0.5 type-small">
            {member.account_number ? (
              <>
                A/c <span className="type-num">{member.account_number}</span>
              </>
            ) : (
              'No A/c'
            )}
            {last ? ` · Last ${formatDate(last)}` : ' · No transactions'}
          </p>
        </div>
        <p className="type-list-value shrink-0">{formatInr(balance)}</p>
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
