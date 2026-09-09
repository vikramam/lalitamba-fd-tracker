import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Chip, ChipGroup } from '@/components/Chip'
import { Page, ScreenTitle } from '@/components/Page'
import { ShimmerSettingsPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { exportHouseholdExcel } from '@/lib/export-household'
import { canManageMembers } from '@/lib/members'
import { canResetTestData, resetTestData } from '@/lib/reset-test-data'
import {
  applyFontScale,
  fontScaleLabel,
  readFontScale,
  stepFontScale,
  type FontScale,
} from '@/lib/font-scale'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'

export function SettingsPage() {
  const { user, signOut, mode } = useAuth()
  const { household, loading, reload } = useHousehold()
  const { alert, alertError } = useDialog()
  const needsFamily = Boolean(household && household.families.length === 0)
  const canManage = household ? canManageMembers(household) : false
  const [confirm, setConfirm] = useState('')
  const [clearing, setClearing] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => readTheme())
  const [fontScale, setFontScale] = useState<FontScale>(() => readFontScale())
  const [exporting, setExporting] = useState(false)
  const canClear = household ? canResetTestData(household) : false

  if (loading) return <ShimmerSettingsPage />

  function onTheme(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  function onFontScale(delta: -1 | 1) {
    const next = stepFontScale(fontScale, delta)
    setFontScale(next)
    applyFontScale(next)
  }

  return (
    <Page>
      <ScreenTitle eyebrow="Account" title="Settings" />

      <section className="mt-6">
        <p className="type-card-title mb-3 text-ink">Appearance</p>
        <ChipGroup>
          {(['dark', 'light'] as const).map((option) => (
            <Chip key={option} selected={theme === option} onClick={() => onTheme(option)}>
              {option === 'dark' ? 'Dark' : 'Light'}
            </Chip>
          ))}
        </ChipGroup>
        <p className="type-card-title mt-5 mb-3 text-ink">Text size</p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Decrease text size"
            disabled={fontScale === 0.9}
            onClick={() => onFontScale(-1)}
          >
            A−
          </Button>
          <p className="type-body min-w-24 text-center text-ink" aria-live="polite">
            {fontScaleLabel(fontScale)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Increase text size"
            disabled={fontScale === 1.3}
            onClick={() => onFontScale(1)}
          >
            A+
          </Button>
        </div>
      </section>

      <dl className="surface-card mt-6 space-y-4 p-4">
        <div>
          <dt className="type-label">
            Email
          </dt>
          <dd className="type-body mt-1 text-ink">{user?.email}</dd>
        </div>
        <div>
          <dt className="type-label">
            Role
          </dt>
          <dd className="type-body mt-1 text-ink">
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
          <dt className="type-label">
            Family
          </dt>
          <dd className="type-body mt-1 text-ink">
            {household?.families.map((family) => family.name).join(', ') || 'None'}
          </dd>
        </div>
        <div>
          <dt className="type-label">
            Mode
          </dt>
          <dd className="type-body mt-1 text-ink">{mode === 'demo' ? 'Demo' : 'Supabase'}</dd>
        </div>
      </dl>

      {household?.isAppAdmin ? (
        <section className="surface-card mt-6 space-y-4 p-4">
          <p className="type-card-title text-ink">Accounts</p>
          <p className="type-body text-muted">
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
          <p className="type-card-title text-ink">Family</p>
          <p className="type-body text-muted">
            Add or edit a family so people and FDs have a home.
          </p>
          <Button asChild variant="outline" size="lg">
            <Link to="/settings/families">Manage family</Link>
          </Button>
        </section>
      ) : null}

      {household ? (
        <section className="surface-card mt-6 space-y-4 p-4">
          <p className="type-card-title text-ink">Export</p>
          <p className="type-body text-muted">
            Download every person and deposit you can see, plus closures, renewals, and
            receipt file names.
          </p>
          <Button
            variant="outline"
            size="lg"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              try {
                exportHouseholdExcel(household)
              } catch (cause) {
                void alertError(cause, 'Could not export that file.')
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
          <p className="type-card-title text-ink">Testing</p>
          <p className="type-body text-muted">
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
              }}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <Button
            variant="outline"
            size="lg"
            disabled={clearing || confirm !== 'DELETE'}
            onClick={() => {
              void (async () => {
                if (!household) return
                setClearing(true)
                try {
                  await resetTestData(household)
                  setConfirm('')
                  await reload()
                  await alert('Test data cleared', 'Deposits and receipt files are gone.')
                } catch (cause) {
                  await alertError(cause, 'Could not clear data.')
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
