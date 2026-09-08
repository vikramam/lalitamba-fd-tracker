import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BackLink, Page } from '@/components/Page'
import { ShimmerFormPage } from '@/components/Shimmer'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { todayIso } from '@/lib/dashboard'
import { canWriteFds } from '@/lib/fds'
import { formatInr } from '@/lib/format'
import {
  canLifecycle,
  closeAmountNote,
  closeFd,
  isPrematureClose,
  suggestedCloseAmount,
} from '@/lib/lifecycle'

export function CloseFdPage() {
  const { fdId } = useParams()
  const navigate = useNavigate()
  const { household, loading, reload } = useHousehold()
  const fd = household?.deposits.find((row) => row.id === fdId)
  const existing = household?.closures.find((row) => row.fd_id === fdId)
  const renewal = household?.renewals.find((row) => row.previous_fd_id === fdId)
  const canWrite = household ? canWriteFds(household) : false
  const [closedOn, setClosedOn] = useState(todayIso())
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading || !household) {
    return <ShimmerFormPage />
  }

  if (!fd) {
    return (
      <Page>
        <p className="text-[13px] text-muted">Deposit not found, or you cannot see it.</p>
        <Link to="/fds" className="mt-4 inline-block text-[13px] text-accent">
          Back to FDs
        </Link>
      </Page>
    )
  }

  if (!canWrite || !canLifecycle(fd) || existing || renewal) {
    return (
      <Page>
        <p className="text-[13px] text-muted">
          {existing
            ? 'This deposit is already closed.'
            : renewal
              ? 'A renewed FD cannot be closed.'
              : 'Only an active or matured FD can be closed.'}
        </p>
        <Link to={`/fds/${fd.id}`} className="mt-4 inline-block text-[13px] text-accent">
          Back to deposit
        </Link>
      </Page>
    )
  }

  const current = fd
  const suggested = suggestedCloseAmount(current, closedOn)
  const amountValue = amountTouched ? amount : String(suggested)
  const premature = isPrematureClose(current, closedOn)
  const received = amountValue.trim() === '' ? null : Number(amountValue.replace(/,/g, ''))
  const amountNote =
    received !== null && Number.isFinite(received)
      ? closeAmountNote(current, closedOn, received)
      : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (received !== null && !Number.isFinite(received)) {
        throw new Error('Amount received is invalid.')
      }
      await closeFd({
        fd: current,
        closedOn,
        amountReceived: received,
        notes,
        existing,
      })
      await reload()
      navigate(`/fds/${current.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not close.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to={`/fds/${fd.id}`} />
      <h1 className="mt-4 font-display text-[20px] font-bold tracking-tight">Close FD</h1>
      <p className="mt-2 text-[13px] text-muted">
        {fd.fd_account_no ?? 'This deposit'} · {formatInr(fd.principal_amount)}. The
        original receipt stays on this row. A later fresh deposit is Add FD.
      </p>

      <form className="mt-8 space-y-5 pb-8" onSubmit={(event) => void onSubmit(event)}>
        <div className="space-y-2">
          <Label htmlFor="closedOn">Closed on</Label>
          <Input
            id="closedOn"
            type="date"
            value={closedOn}
            onChange={(event) => setClosedOn(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount received</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amountValue}
            onChange={(event) => {
              setAmountTouched(true)
              setAmount(event.target.value)
            }}
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

        {premature ? (
          <div className="flex items-start gap-2">
            <StatusBadge tone="danger">Premature</StatusBadge>
            <p className="text-[13px] text-danger">
              The society may pay less than principal.
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">Closing at or after maturity.</p>
        )}
        {amountNote ? <p className="text-[13px] text-warn">{amountNote}</p> : null}

        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-20 space-y-3 bg-canvas pt-4 md:bottom-0">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Closing…' : 'Confirm close'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
