import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PeopleIcon } from '@/components/icons'
import { BackLink, Page } from '@/components/Page'
import { PickerAvatar, SheetPicker } from '@/components/SheetPicker'
import { ShimmerFormPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { canManageMembers, createFamily, createMember, updateMember } from '@/lib/members'
import type { FamilyMember, Household } from '@/lib/types'

export function MemberFormPage() {
  const { memberId } = useParams()
  const { household, loading, reload } = useHousehold()
  const isNew = !memberId || memberId === 'new'
  const member = household?.members.find((row) => row.id === memberId)
  const canManage = household ? canManageMembers(household) : false

  if (loading || !household) {
    return <ShimmerFormPage />
  }

  if (!isNew && !member) {
    return (
      <Page>
        <p className="text-[13px] text-muted">Member not found, or you cannot see them.</p>
        <Link to="/members" className="mt-4 inline-block text-[13px] text-accent">
          Back to members
        </Link>
      </Page>
    )
  }

  if (!canManage) {
    return (
      <Page>
        <p className="text-[13px] text-muted">You cannot manage members.</p>
        <Link to="/members" className="mt-4 inline-block text-[13px] text-accent">
          Back to members
        </Link>
      </Page>
    )
  }

  return (
    <MemberForm
      household={household}
      member={member}
      memberId={memberId}
      isNew={isNew}
      reload={reload}
    />
  )
}

function MemberForm({
  household,
  member,
  memberId,
  isNew,
  reload,
}: {
  household: Household
  member?: FamilyMember
  memberId?: string
  isNew: boolean
  reload: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const needsFamily = household.families.length === 0

  const [familyId, setFamilyId] = useState(
    member?.family_id ?? household.families[0]?.id ?? '',
  )
  const [familyName, setFamilyName] = useState('Mulgund family')
  const [fullName, setFullName] = useState(member?.full_name ?? '')
  const [displayName, setDisplayName] = useState(member?.display_name ?? '')
  const [cid, setCid] = useState(member?.bank_customer_id ?? '')
  const [notes, setNotes] = useState(member?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      let targetFamily = familyId || household.families[0]?.id || ''
      if (needsFamily) {
        if (!user) throw new Error('Sign in again.')
        const family = await createFamily(familyName, user.id)
        targetFamily = family.id
      }
      const payload = {
        family_id: targetFamily,
        full_name: fullName,
        display_name: displayName,
        bank_customer_id: cid,
        notes,
      }
      if (isNew) {
        await createMember(payload)
      } else if (memberId) {
        await updateMember(memberId, payload)
      }
      await reload()
      navigate('/members')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to="/members" />
      <h1 className="mt-4 font-display text-[20px] font-bold tracking-tight">
        {needsFamily ? 'Create family' : isNew ? 'Add member' : 'Edit member'}
      </h1>

      <form className="mt-8 space-y-5 pb-8" onSubmit={(event) => void onSubmit(event)}>
        {needsFamily ? (
          <div className="space-y-2">
            <Label htmlFor="familyName">Family name</Label>
            <Input
              id="familyName"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              required
            />
          </div>
        ) : household.families.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="family">Family</Label>
            <SheetPicker
              id="family"
              title="Choose family"
              hint="Tap to choose family"
              selectedId={familyId || household.families[0]?.id || null}
              valueLabel={
                household.families.find(
                  (family) => family.id === (familyId || household.families[0]?.id),
                )?.name ?? 'Choose family'
              }
              leading={
                <PickerAvatar>
                  <PeopleIcon className="size-4 text-muted" />
                </PickerAvatar>
              }
              options={household.families.map((family) => ({
                id: family.id,
                label: family.name,
                leading: (
                  <PickerAvatar>
                    <PeopleIcon className="size-4 text-muted" />
                  </PickerAvatar>
                ),
              }))}
              onSelect={setFamilyId}
              disabled={!isNew}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cid">CID</Label>
          <Input
            id="cid"
            inputMode="numeric"
            value={cid}
            onChange={(event) => setCid(event.target.value)}
            placeholder="1700"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-20 space-y-3 bg-canvas pt-4 md:bottom-0">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
