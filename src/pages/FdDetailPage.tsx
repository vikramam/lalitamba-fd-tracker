import { Children, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PencilIcon, RenewIcon, StopIcon, TrashIcon } from '@/components/icons'
import { Page } from '@/components/Page'
import { ReceiptDownloadButton } from '@/components/ReceiptDownloadButton'
import { ReceiptShareButton } from '@/components/ReceiptShareButton'
import { ShimmerDetailPage } from '@/components/Shimmer'
import { StatusBadge } from '@/components/StatusBadge'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { interestCreditedToDate } from '@/lib/dashboard'
import { fdCheckMessages } from '@/lib/fd-checks'
import { canDeleteFds, canWriteFds, deleteFd } from '@/lib/fds'
import { formatDate, formatFileSize, formatInr, formatInterestMode, formatStatus, paysOutInterest } from '@/lib/format'
import { canLifecycle, carryMessage, findRenewalFor, renewalChain } from '@/lib/lifecycle'
import { currentReceipt, receiptViewUrl } from '@/lib/receipts'
import type { FdReceipt, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

function statusTone(status: string): 'success' | 'warn' | 'danger' | 'muted' {
  if (status === 'active') return 'success'
  if (status === 'matured') return 'warn'
  if (status === 'closed') return 'danger'
  return 'muted'
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const items = Children.toArray(children)
  if (items.length === 0) return null
  return (
    <section className="surface-card mt-4 p-4">
      <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
        {title}
      </p>
      <dl className="mt-3 divide-y divide-line">{items}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-1 last:pb-1">
      <dt className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="text-right text-[13px] text-ink">{value}</dd>
    </div>
  )
}

function actionClass(tone: 'default' | 'danger' = 'default') {
  return cn(
    'surface-card flex flex-1 flex-col items-center gap-0.5 px-1.5 py-1.5 text-[10px] font-semibold disabled:opacity-50',
    tone === 'danger' ? 'text-danger' : 'text-ink',
  )
}

function ActionLink({
  to,
  label,
  icon,
  tone = 'default',
}: {
  to: string
  label: string
  icon: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <Link to={to} className={actionClass(tone)}>
      {icon}
      {label}
    </Link>
  )
}

function ActionButton({
  label,
  icon,
  tone = 'default',
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={actionClass(tone)}>
      {icon}
      {label}
    </button>
  )
}

function HolderDetails({
  holder,
  address,
  nominee,
  relationship,
}: {
  holder: string | null | undefined
  address: string | null | undefined
  nominee: string | null | undefined
  relationship: string | null | undefined
}) {
  if (!holder && !address && !nominee && !relationship) return null
  return (
    <div className="mt-5 border-t border-line pt-4">
      {holder ? (
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Holder
          </p>
          <p className="mt-1 text-[13px] text-ink">{holder}</p>
        </div>
      ) : null}
      {address ? (
        <div className={holder ? 'mt-3' : undefined}>
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Address
          </p>
          <p className="mt-1 text-[13px] leading-5 text-ink">{address}</p>
        </div>
      ) : null}
      {nominee || relationship ? (
        <div className={`grid grid-cols-2 gap-3 ${holder || address ? 'mt-3' : ''}`}>
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
              Nominee
            </p>
            <p className="mt-1 text-[13px] text-ink">{nominee || '—'}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
              Relationship
            </p>
            <p className="mt-1 text-[13px] text-ink">{relationship || '—'}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function FdDetailPage() {
  const { fdId } = useParams()
  const navigate = useNavigate()
  const { household, loading, reload } = useHousehold()
  const { confirm, alertError } = useDialog()
  const [deleting, setDeleting] = useState(false)
  const fd = household?.deposits.find((row) => row.id === fdId)
  const member = household?.members.find((row) => row.id === fd?.family_member_id)
  const receipt = household && fd ? currentReceipt(household.receipts, fd.id) : null
  const canWrite = household ? canWriteFds(household) : false
  const checks = fd ? fdCheckMessages(fd) : []
  const closure = household?.closures.find((row) => row.fd_id === fd?.id)
  const links = fd && household ? findRenewalFor(fd.id, household.renewals) : {}
  const chain =
    fd && household ? renewalChain(fd.id, household.deposits, household.renewals) : []
  const reviews = household?.ocrReviews.filter((row) => row.fd_id === fd?.id) ?? []
  const corrected = reviews.filter((row) => row.was_modified)
  const previous = household?.deposits.find((row) => row.id === links.asNext?.previous_fd_id)
  const credit = fd
    ? interestCreditedToDate(fd, {
        asOf: closure?.closed_on ?? links.asPrevious?.renewed_on ?? null,
      })
    : null

  if (loading || !household) {
    return <ShimmerDetailPage />
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

  const canEdit = canWrite && fd.status !== 'closed' && fd.status !== 'renewed'
  const canDelete = canDeleteFds(household, fd.family_id)
  const deposit = fd

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete FD',
      message: `Delete ${deposit.fd_account_no ?? 'this FD'} and its receipt? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deleteFd(deposit)
      await reload()
      navigate('/fds')
    } catch (cause) {
      await alertError(cause, 'Could not delete that FD.', 'Cannot delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Page>
      <Link to="/fds" className="text-[13px] text-muted">
        Back
      </Link>
      <div className="mt-4">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          {formatInterestMode(fd.interest_mode)}
        </p>
        <h1 className="mt-1 font-display text-[20px] font-bold tracking-tight">
          {fd.fd_account_no ?? 'Fixed deposit'}
        </h1>
        <p className="mt-1 text-[13px] text-muted">{member?.full_name ?? fd.holder_name}</p>
      </div>

      <section className="hero-card mt-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-mono text-[26px] font-semibold tracking-tight">
            {formatInr(fd.principal_amount)}
          </p>
          <div className="mt-1 flex shrink-0 flex-col items-end gap-1">
            <StatusBadge tone={statusTone(fd.status)}>{formatStatus(fd.status)}</StatusBadge>
            {closure?.is_premature ? <StatusBadge tone="danger">Premature</StatusBadge> : null}
          </div>
        </div>
        {credit ? (
          <p className="mt-4 font-mono text-[18px] text-ink">{formatInr(credit.amount)}</p>
        ) : null}
        {credit ? (
          <p className="mt-1 text-[12px] text-muted">
            Interest credited
            {credit.months === 1 ? ' · 1 month' : ` · ${credit.months} months`}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-muted">Principal</p>
        )}
        <HolderDetails
          holder={fd.holder_name}
          address={fd.holder_address}
          nominee={fd.nominee_name}
          relationship={fd.nominee_relationship}
        />
      </section>

      {canWrite && (canEdit || canLifecycle(fd) || canDelete) ? (
        <div className="mt-3 flex gap-1.5">
          {canEdit ? (
            <ActionLink to={`/fds/${fd.id}/edit`} label="Edit" icon={<PencilIcon className="size-3.5" />} />
          ) : null}
          {canLifecycle(fd) ? (
            <ActionLink to={`/fds/${fd.id}/renew`} label="Renew" icon={<RenewIcon className="size-3.5" />} />
          ) : null}
          {canLifecycle(fd) ? (
            <ActionLink
              to={`/fds/${fd.id}/close`}
              label="Close"
              icon={<StopIcon className="size-3.5" />}
              tone="danger"
            />
          ) : null}
          {canDelete ? (
            <ActionButton
              label={deleting ? '…' : 'Delete'}
              icon={<TrashIcon className="size-3.5" />}
              tone="danger"
              disabled={deleting}
              onClick={() => void onDelete()}
            />
          ) : null}
        </div>
      ) : null}
      {closure ? (
        <p className="mt-6 text-[13px] text-muted">
          Received {closure.amount_received === null ? '—' : formatInr(closure.amount_received)}
          {closure.is_premature ? (
            <span className="text-danger"> · Premature</span>
          ) : null}
          {closure.notes ? ` · ${closure.notes}` : ''}
        </p>
      ) : null}

      {chain.length > 1 ? (
        <p className="mt-6 font-mono text-[12px] text-muted">
          {chain.map((row, index) => (
            <span key={row.id}>
              {index > 0 ? ' → ' : ''}
              {row.id === fd.id ? (
                <span className="text-ink">{row.fd_account_no ?? 'FD'}</span>
              ) : (
                <Link to={`/fds/${row.id}`} className="text-accent">
                  {row.fd_account_no ?? 'FD'}
                </Link>
              )}
            </span>
          ))}
        </p>
      ) : null}

      {links.asNext && previous ? (
        <p className="mt-3 text-[13px] text-muted">
          Renewed from {previous.fd_account_no ?? 'previous FD'}
          {links.asNext.suggested_carry !== null
            ? ` · ${carryMessage(links.asNext.suggested_carry, fd.principal_amount)}`
            : ''}
        </p>
      ) : null}

      {corrected.length > 0 ? (
        <p className="mt-6 text-[13px] text-muted">
          {corrected.length} {corrected.length === 1 ? 'field' : 'fields'} corrected from the
          receipt.
        </p>
      ) : reviews.length > 0 ? (
        <p className="mt-6 text-[13px] text-muted">Receipt fields confirmed without changes.</p>
      ) : null}

      {checks.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {checks.map((message) => (
            <li key={message} className="text-[13px] text-warn">
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      <SectionCard title="Terms">
        <Row
          label="Rate"
          value={fd.interest_rate_pct === null ? null : `${fd.interest_rate_pct}%`}
        />
        <Row
          label="Period"
          value={
            fd.tenure_label ||
            (fd.tenure_years ? `${fd.tenure_years} Years` : null)
          }
        />
        <Row label="Interest mode" value={formatInterestMode(fd.interest_mode)} />
        <Row
          label="Maturity"
          value={fd.maturity_value === null ? null : formatInr(fd.maturity_value)}
        />
      </SectionCard>

      {paysOutInterest(fd.interest_mode) ? (
        <SectionCard
          title={fd.interest_mode === 'quarterly' ? 'Quarterly interest' : 'Monthly interest'}
        >
          <Row
            label={fd.interest_mode === 'quarterly' ? 'Quarterly' : 'Monthly'}
            value={
              fd.monthly_interest_amount === null
                ? null
                : formatInr(fd.monthly_interest_amount)
            }
          />
          <Row
            label="Credited"
            value={
              credit
                ? `${formatInr(credit.amount)} · ${
                    credit.months === 1 ? '1 month' : `${credit.months} months`
                  }`
                : null
            }
          />
          <Row label="MS A/c" value={fd.interest_credit_account} />
        </SectionCard>
      ) : null}

      <SectionCard title="Dates">
        <Row label="FD date" value={fd.fd_date ? formatDate(fd.fd_date) : null} />
        <Row
          label="Matures on"
          value={fd.maturity_date ? formatDate(fd.maturity_date) : null}
        />
        <Row
          label="Txn date"
          value={fd.transaction_date ? formatDate(fd.transaction_date) : null}
        />
      </SectionCard>

      {fd.notes ? (
        <section className="surface-card mt-4 p-4">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Notes
          </p>
          <p className="mt-3 text-[13px] text-ink">{fd.notes}</p>
        </section>
      ) : null}

      <ReceiptSection household={household} receipt={receipt} fdId={fd.id} canWrite={canWrite} />
    </Page>
  )
}

function ReceiptSection({
  household,
  receipt,
  fdId,
  canWrite,
}: {
  household: Household
  receipt: FdReceipt | null
  fdId: string
  canWrite: boolean
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!receipt || receipt.preview_url) return
    let cancelled = false
    void receiptViewUrl(receipt, household)
      .then((value) => {
        if (!cancelled) setSignedUrl(value)
      })
      .catch(() => {
        if (!cancelled) setSignedUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [household, receipt])

  const url = receipt?.preview_url ?? signedUrl

  return (
    <section className="surface-card mt-8 p-4">
      <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">Receipt</p>
      {receipt ? (
        <div className="mt-4">
          {url && receipt.mime_type.startsWith('image/') ? (
            <Link to={`/fds/${fdId}/receipt`} className="block">
              <img
                src={url}
                alt="FD receipt"
                className="max-h-56 w-full rounded-2xl object-contain"
              />
            </Link>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link to={`/fds/${fdId}/receipt`} className="text-[13px] text-accent">
              View receipt
            </Link>
            <ReceiptDownloadButton receipt={receipt} household={household} />
            <ReceiptShareButton receipt={receipt} household={household} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {receipt.file_name}
            {receipt.file_size ? ` · ${formatFileSize(receipt.file_size)}` : ''}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          No receipt yet.
          {canWrite ? (
            <>
              {' '}
              <Link to={`/fds/${fdId}/edit`} className="text-accent">
                Add one
              </Link>
              .
            </>
          ) : null}
        </p>
      )}
    </section>
  )
}
