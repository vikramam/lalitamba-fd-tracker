import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Chip, ChipGroup } from '@/components/Chip'
import { Page, ScreenTitle } from '@/components/Page'
import { ShimmerSettingsPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { exportHouseholdExcel } from '@/lib/export-household'
import { canManageMembers } from '@/lib/members'
import { canResetTestData, resetTestData } from '@/lib/reset-test-data'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'

export function SettingsPage() {
  const { user, signOut, mode } = useAuth()
  const { household, loading, reload } = useHousehold()
  const needsFamily = Boolean(household && household.families.length === 0)
  const canManage = household ? canManageMembers(household) : false
  const [confirm, setConfirm] = useState('')
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(() => readTheme())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const canClear = household ? canResetTestData(household) : false

  if (loading) return <ShimmerSettingsPage />

  function onTheme(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <Page>
      <ScreenTitle eyebrow="Account" title="Settings" />

      <section className="mt-6">
        <p className="mb-3 text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          Appearance
        </p>
        <ChipGroup>
          {(['dark', 'light'] as const).map((option) => (
            <Chip key={option} selected={theme === option} onClick={() => onTheme(option)}>
              {option === 'dark' ? 'Dark' : 'Light'}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <dl className="surface-card mt-6 space-y-4 p-4 text-[13.5px]">
        <div>
          <dt className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Email
          </dt>
          <dd className="mt-1 font-mono text-[13px] text-ink">{user?.email}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Role
          </dt>
          <dd className="mt-1 text-ink">
            {household?.isSuperAdmin
              ? 'Super admin'
              : household?.isAppAdmin
              ? 'App admin'
              : household?.families[0]?.role === 'family_admin'
                ? 'Family admin'
                : needsFamily
                  ? 'No family yet'
                  : 'Member'}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Family
          </dt>
          <dd className="mt-1 text-ink">
            {household?.families.map((family) => family.name).join(', ') || 'None'}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Mode
          </dt>
          <dd className="mt-1 text-ink">{mode === 'demo' ? 'Demo' : 'Supabase'}</dd>
        </div>
      </dl>

      {household?.isAppAdmin ? (
        <section className="surface-card mt-6 space-y-4 p-4">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Accounts
          </p>
          <p className="text-[13px] text-muted">
            Approve new sign-ups, reject or delete accounts
            {household.isSuperAdmin ? ', and make or remove admins' : ''}.
          </p>
          <Button asChild variant="outline" size="lg">
            <Link to="/settings/accounts">Manage accounts</Link>
          </Button>
        </section>
      ) : null}

      {household && canManage ? (
        <section className="surface-card mt-6 space-y-4 p-4">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Family
          </p>
          {household.families.length === 0 ? (
            <p className="text-[13px] text-muted">
              No family yet. Add one to start adding people and FDs.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {household.families.map((family) => (
                <li key={family.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-[13px] text-ink">{family.name}</p>
                  <Link
                    to={`/families/${family.id}`}
                    className="mt-2 inline-block text-[13px] text-accent"
                  >
                    Edit family
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="lg">
            <Link to="/families/new">Add family</Link>
          </Button>
        </section>
      ) : null}

      {household ? (
        <section className="surface-card mt-6 space-y-4 p-4">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Export
          </p>
          <p className="text-[13px] text-muted">
            Download every person and deposit you can see, plus closures, renewals, and
            receipt file names.
          </p>
          {exportError ? (
            <p className="text-[13px] text-danger" role="alert">
              {exportError}
            </p>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            disabled={exporting}
            onClick={() => {
              setExportError(null)
              setExporting(true)
              try {
                exportHouseholdExcel(household)
              } catch (cause) {
                setExportError(
                  cause instanceof Error ? cause.message : 'Could not export that file.',
                )
              } finally {
                setExporting(false)
              }
            }}
          >
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </Button>
        </section>
      ) : null}

      {canClear ? (
        <section className="surface-card mt-6 space-y-4 p-4">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Testing
          </p>
          <p className="text-[13px] text-muted">
            Deletes every deposit, OCR run, and receipt file. Family members stay.
            Type DELETE to confirm.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirmDelete">Confirm</Label>
            <Input
              id="confirmDelete"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value)
                setCleared(false)
              }}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          {cleared ? (
            <p className="text-[13px] text-muted" role="status">
              Deposits and receipt files are gone.
            </p>
          ) : null}
          {clearError ? (
            <p className="text-[13px] text-danger" role="alert">
              {clearError}
            </p>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            disabled={clearing || confirm !== 'DELETE'}
            onClick={() => {
              void (async () => {
                if (!household) return
                setClearError(null)
                setClearing(true)
                try {
                  await resetTestData(household)
                  setConfirm('')
                  setCleared(true)
                  await reload()
                } catch (cause) {
                  setClearError(cause instanceof Error ? cause.message : 'Could not clear data.')
                } finally {
                  setClearing(false)
                }
              })()
            }}
          >
            {clearing ? 'Clearing…' : 'Clear test data'}
          </Button>
        </section>
      ) : null}

      <Button variant="outline" size="lg" className="mt-8 text-danger" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Page>
  )
}
