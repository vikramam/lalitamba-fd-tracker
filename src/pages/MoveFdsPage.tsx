import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { CollapseAllControls, CollapseGroups, useCollapseGroup } from '@/components/CollapseGroups'
import { ChevronIcon } from '@/components/icons'
import { PickerAvatar, SheetPicker } from '@/components/SheetPicker'
import { BackLink, Page, ScreenTitle } from '@/components/Page'
import { ShimmerSettingsPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { canMoveFds, moveFds } from '@/lib/fds'
import { formatInr } from '@/lib/format'
import { initials } from '@/lib/initials'
import { canManageMembers } from '@/lib/members'
import type { Family, FamilyMember, FixedDeposit, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

function memberLabel(member: FamilyMember) {
  return member.display_name || member.full_name
}

function familyName(families: Family[], familyId: string) {
  return families.find((family) => family.id === familyId)?.name ?? 'No family'
}

export function MoveFdsPage() {
  const { allHousehold: household, loading, reload } = useHousehold()
  const { alert, confirm, alertError } = useDialog()
  const navigate = useNavigate()
  const canManage = household ? canManageMembers(household) && canMoveFds(household) : false
  const [selected, setSelected] = useState<string[]>([])
  const [familyId, setFamilyId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [busy, setBusy] = useState(false)

  const families = household?.families ?? []
  const members = useMemo(
    () => (household?.members ?? []).filter((row) => row.family_id === familyId),
    [household?.members, familyId],
  )
  const deposits = household?.deposits ?? []
  const grouped = useMemo(() => groupFds(deposits, household), [deposits, household])

  if (loading) return <ShimmerSettingsPage />

  if (!canManage || !household) {
    return (
      <Page>
        <p className="type-body text-muted">You cannot move FDs.</p>
        <Link to="/settings" className="mt-4 inline-block type-body text-accent">
          Back to settings
        </Link>
      </Page>
    )
  }

  const destFamily = families.find((family) => family.id === familyId)
  const destMember = members.find((row) => row.id === memberId)

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    )
  }

  function toggleGroup(ids: string[]) {
    setSelected((current) => {
      const allIn = ids.every((id) => current.includes(id))
      if (allIn) return current.filter((id) => !ids.includes(id))
      return [...new Set([...current, ...ids])]
    })
  }

  async function onMove() {
    if (!household || !destFamily || !destMember) return
    if (selected.length === 0) {
      await alert('Choose FDs', 'Select at least one FD to move.')
      return
    }
    const ok = await confirm({
      title: 'Move FDs',
      message: `Move ${selected.length} ${selected.length === 1 ? 'FD' : 'FDs'} to ${memberLabel(destMember)} in ${destFamily.name}? Linked renewals move together.`,
      confirmLabel: 'Move',
    })
    if (!ok) return
    setBusy(true)
    try {
      await moveFds({
        household,
        fdIds: selected,
        targetMemberId: destMember.id,
      })
      await reload()
      setSelected([])
      navigate('/settings')
    } catch (cause) {
      await alertError(cause, 'Could not move those FDs.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <BackLink to="/settings" />
      <div className="mt-4">
        <ScreenTitle eyebrow="Settings" title="Move FDs" />
      </div>
      <p className="mt-3 type-body text-muted">
        Choose a destination family and person, then pick the FDs to move.
      </p>

      {families.length < 2 ? (
        <p className="surface-card mt-6 p-4 type-body text-muted">
          Add another family first. You need at least two families to move FDs between them.
        </p>
      ) : deposits.length === 0 ? (
        <p className="surface-card mt-6 p-4 type-body text-muted">No deposits to move yet.</p>
      ) : (
        <>
          <section className="mt-6 space-y-3">
            <SheetPicker
              id="destFamily"
              title="Destination family"
              hint="Family the FDs should belong to"
              valueLabel={destFamily?.name ?? 'Choose family'}
              options={families.map((family) => ({
                id: family.id,
                label: family.name,
              }))}
              selectedId={familyId || null}
              onSelect={(id) => {
                setFamilyId(id)
                setMemberId('')
              }}
            />
            <SheetPicker
              id="destMember"
              title="Assign to"
              hint={destFamily ? 'Person in that family' : 'Choose a family first'}
              valueLabel={destMember ? memberLabel(destMember) : 'Choose person'}
              leading={destMember ? <PickerAvatar name={memberLabel(destMember)} /> : undefined}
              disabled={!familyId}
              options={members.map((member) => ({
                id: member.id,
                label: memberLabel(member),
                secondary: member.full_name,
                leading: <PickerAvatar name={memberLabel(member)} />,
              }))}
              selectedId={memberId || null}
              onSelect={setMemberId}
              footer={
                familyId && members.length === 0 ? (
                  <Link to="/members/new" className="type-body text-accent">
                    Add a person in this family first
                  </Link>
                ) : null
              }
            />
          </section>

          <section className="mt-6">
            <CollapseGroups>
              <div className="flex items-center justify-between gap-3">
                <p className="type-card-title text-ink">FDs to move</p>
                <CollapseAllControls />
              </div>
              <div className="mt-3 space-y-5">
                {grouped.map((group) => (
                  <FamilyMoveGroup
                    key={group.id}
                    group={group}
                    selected={selected}
                    onToggle={toggle}
                    onToggleGroup={toggleGroup}
                  />
                ))}
              </div>
            </CollapseGroups>
          </section>

          <Button
            size="lg"
            className="mt-6"
            disabled={busy || selected.length === 0 || !memberId}
            onClick={() => void onMove()}
          >
            {busy ? 'Moving…' : 'Move selected FDs'}
          </Button>
        </>
      )}
    </Page>
  )
}

type MemberMoveGroupData = {
  id: string
  name: string
  fds: FixedDeposit[]
}

type FamilyMoveGroupData = {
  id: string
  name: string
  members: MemberMoveGroupData[]
}

function FamilyMoveGroup({
  group,
  selected,
  onToggle,
  onToggleGroup,
}: {
  group: FamilyMoveGroupData
  selected: string[]
  onToggle: (id: string) => void
  onToggleGroup: (ids: string[]) => void
}) {
  const [open, setOpen] = useCollapseGroup()
  const panelId = `move-family-${group.id}`
  const fds = group.members.flatMap((member) => member.fds)
  const principal = fds.reduce((sum, fd) => sum + fd.principal_amount, 0)

  return (
    <section>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate type-card-title text-ink">{group.name}</span>
            <span className="type-small mt-0.5 block">
              <span className="type-num">{group.members.length}</span>{' '}
              {group.members.length === 1 ? 'member' : 'members'}
              {' · '}
              <span className="type-num">{fds.length}</span> {fds.length === 1 ? 'FD' : 'FDs'}
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
        <SelectAllButton ids={fds.map((fd) => fd.id)} selected={selected} onToggle={onToggleGroup} />
      </div>
      {open ? (
        <div id={panelId} className="mt-3 space-y-4">
          {group.members.map((member) => (
            <MemberMoveGroup
              key={member.id}
              group={member}
              selected={selected}
              onToggle={onToggle}
              onToggleGroup={onToggleGroup}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function MemberMoveGroup({
  group,
  selected,
  onToggle,
  onToggleGroup,
}: {
  group: MemberMoveGroupData
  selected: string[]
  onToggle: (id: string) => void
  onToggleGroup: (ids: string[]) => void
}) {
  const [open, setOpen] = useCollapseGroup()
  const panelId = `move-member-${group.id}`
  const principal = group.fds.reduce((sum, fd) => sum + fd.principal_amount, 0)

  return (
    <section>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
        >
          <span className="type-micro flex size-7 shrink-0 items-center justify-center rounded-lg bg-inner font-semibold text-ink">
            {initials(group.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate type-card-title text-ink">{group.name}</span>
            <span className="type-small mt-0.5 block">
              <span className="type-num">{group.fds.length}</span>{' '}
              {group.fds.length === 1 ? 'FD' : 'FDs'}
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
        <SelectAllButton
          ids={group.fds.map((fd) => fd.id)}
          selected={selected}
          onToggle={onToggleGroup}
        />
      </div>
      {open ? (
        <ul id={panelId} className="mt-2 space-y-1">
          {group.fds.map((fd) => {
            const checked = selected.includes(fd.id)
            return (
              <li key={fd.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--accent)]"
                    checked={checked}
                    onChange={() => onToggle(fd.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="type-card-title block truncate text-ink">
                      {fd.fd_account_no ?? 'FD'}
                    </span>
                    <span className="type-small mt-0.5 block">
                      <span className="type-num">{formatInr(fd.principal_amount)}</span>
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function SelectAllButton({
  ids,
  selected,
  onToggle,
}: {
  ids: string[]
  selected: string[]
  onToggle: (ids: string[]) => void
}) {
  const allIn = ids.length > 0 && ids.every((id) => selected.includes(id))
  return (
    <button type="button" className="shrink-0 type-small text-accent" onClick={() => onToggle(ids)}>
      {allIn ? 'Clear' : 'Select all'}
    </button>
  )
}

function groupFds(deposits: FixedDeposit[], household: Household | null): FamilyMoveGroupData[] {
  const families = household?.families ?? []
  const members = household?.members ?? []
  const byFamily = new Map<string, Map<string, MemberMoveGroupData>>()

  for (const fd of deposits) {
    const member = members.find((row) => row.id === fd.family_member_id) ?? null
    const familyId = member?.family_id || fd.family_id || 'unknown'
    const memberId = member?.id || fd.family_member_id || 'unknown'
    const familyGroups = byFamily.get(familyId) ?? new Map<string, MemberMoveGroupData>()
    const current = familyGroups.get(memberId)
    if (current) {
      current.fds.push(fd)
    } else {
      familyGroups.set(memberId, {
        id: memberId,
        name: member ? memberLabel(member) : 'Unknown',
        fds: [fd],
      })
    }
    byFamily.set(familyId, familyGroups)
  }

  return [...byFamily.entries()]
    .map(([id, memberGroups]) => ({
      id,
      name: familyName(families, id),
      members: [...memberGroups.values()]
        .map((group) => ({
          ...group,
          fds: [...group.fds].sort((left, right) =>
            (left.fd_account_no ?? '').localeCompare(right.fd_account_no ?? ''),
          ),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
