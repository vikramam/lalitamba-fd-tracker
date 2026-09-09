import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BackLink, Page } from '@/components/Page'
import { ShimmerFormPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { canManageMembers, createFamily, updateFamily } from '@/lib/members'
import type { Household } from '@/lib/types'

export function FamilyFormPage() {
  const { familyId } = useParams()
  const { household, loading, reload } = useHousehold()
  const isNew = !familyId || familyId === 'new'
  const family = household?.families.find((row) => row.id === familyId)
  const canManage = household ? canManageMembers(household) : false

  if (loading || !household) {
    return <ShimmerFormPage />
  }

  if (!isNew && !family) {
    return (
      <Page>
        <p className="type-body text-muted">Family not found, or you cannot see it.</p>
        <Link to="/settings/families" className="mt-4 inline-block type-body text-accent">
          Back to family
        </Link>
      </Page>
    )
  }

  if (!canManage) {
    return (
      <Page>
        <p className="type-body text-muted">You cannot manage families.</p>
        <Link to="/settings/families" className="mt-4 inline-block type-body text-accent">
          Back to family
        </Link>
      </Page>
    )
  }

  return (
    <FamilyForm
      household={household}
      familyId={isNew ? undefined : family?.id}
      initialName={family?.name ?? ''}
      isNew={isNew}
      reload={reload}
    />
  )
}

function FamilyForm({
  household,
  familyId,
  initialName,
  isNew,
  reload,
}: {
  household: Household
  familyId?: string
  initialName: string
  isNew: boolean
  reload: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { alertError } = useDialog()
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      if (isNew) {
        if (!user) throw new Error('Sign in again.')
        await createFamily(name, user.id)
      } else if (familyId) {
        await updateFamily(familyId, name)
      }
      await reload()
      navigate('/settings/families')
    } catch (cause) {
      await alertError(cause, 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to="/settings/families" />
      <h1 className="mt-4 type-page-title">
        {isNew ? 'Add family' : 'Edit family'}
      </h1>
      {household.families.length > 0 && isNew ? (
        <p className="mt-2 type-body text-muted">
          People and FDs you add next can sit under this family.
        </p>
      ) : null}

      <form className="mt-8 space-y-5 pb-8" onSubmit={(event) => void onSubmit(event)}>
        <div className="space-y-2">
          <Label htmlFor="familyName">Family name</Label>
          <Input
            id="familyName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Mulgund family"
          />
        </div>

        <div className="sticky bottom-20 space-y-3 bg-canvas pt-4 md:bottom-0">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
