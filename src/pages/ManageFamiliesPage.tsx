import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PencilIcon, TrashIcon } from '@/components/icons'
import { BackLink, Page, ScreenTitle } from '@/components/Page'
import { ShimmerSettingsPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { canManageMembers, deleteFamily, familyDeleteError } from '@/lib/members'

export function ManageFamiliesPage() {
  const { household, loading, reload } = useHousehold()
  const { alert, confirm, alertError } = useDialog()
  const canManage = household ? canManageMembers(household) : false
  const [busy, setBusy] = useState(false)

  if (loading) return <ShimmerSettingsPage />

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

  const families = household?.families ?? []

  async function onDelete(familyId: string, name: string) {
    if (!household) return
    const blocked = familyDeleteError(household, familyId)
    if (blocked) {
      await alert('Cannot delete', blocked)
      return
    }
    const ok = await confirm({
      title: 'Delete family',
      message: `Delete ${name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteFamily(household, familyId)
      await reload()
    } catch (cause) {
      await alertError(cause, 'Could not delete that family.', 'Cannot delete')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <BackLink to="/settings" />
      <div className="mt-4">
        <ScreenTitle eyebrow="Settings" title="Family" />
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Add or edit a family so people and FDs have a home.
      </p>

      <section className="surface-card mt-6 p-4">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          Families
        </p>
        {families.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">
            No family yet. Add one to start adding people and FDs.
          </p>
        ) : (
          <ul className="mt-3">
            {families.map((family) => (
              <li
                key={family.id}
                className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
              >
                <p className="min-w-0 truncate text-[13px] text-ink">{family.name}</p>
                <div className="flex shrink-0 items-center">
                  <Link
                    to={`/families/${family.id}`}
                    aria-label={`Edit ${family.name}`}
                    className="flex size-8 items-center justify-center rounded-lg text-accent"
                  >
                    <PencilIcon className="size-4" />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${family.name}`}
                    disabled={busy}
                    className="flex size-8 items-center justify-center rounded-lg text-danger disabled:opacity-50"
                    onClick={() => void onDelete(family.id, family.name)}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button asChild variant="outline" size="lg" className="mt-6">
        <Link to="/families/new">Add family</Link>
      </Button>
    </Page>
  )
}
