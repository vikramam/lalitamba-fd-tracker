import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BackLink, Page } from '@/components/Page'
import { ShimmerFormPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <p className="text-[13px] text-muted">Family not found, or you cannot see it.</p>
        <Link to="/settings" className="mt-4 inline-block text-[13px] text-accent">
          Back to settings
        </Link>
      </Page>
    )
  }

  if (!canManage) {
    return (
      <Page>
        <p className="text-[13px] text-muted">You cannot manage families.</p>
        <Link to="/settings" className="mt-4 inline-block text-[13px] text-accent">
          Back to settings
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
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (isNew) {
        if (!user) throw new Error('Sign in again.')
        await createFamily(name, user.id)
      } else if (familyId) {
        await updateFamily(familyId, name)
      }
      await reload()
      navigate('/settings')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to="/settings" />
      <h1 className="mt-4 font-display text-[20px] font-bold tracking-tight">
        {isNew ? 'Add family' : 'Edit family'}
      </h1>
      {household.families.length > 0 && isNew ? (
        <p className="mt-2 text-[13px] text-muted">
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
