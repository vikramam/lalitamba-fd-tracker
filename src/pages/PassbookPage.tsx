import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { BottomSheet } from '@/components/BottomSheet'
import { Chip, ChipGroup } from '@/components/Chip'
import { FamilyIcon, MinusIcon, PlusIcon, ShareIcon, TrashIcon } from '@/components/icons'
import { BackLink, Page } from '@/components/Page'
import { ShimmerDetailPage } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { todayIso } from '@/lib/dashboard'
import { formatDate, formatInr, formatMonthHeading } from '@/lib/format'
import { initials } from '@/lib/initials'
import {
  filterByDateRange,
  groupByMonth,
  newestFirst,
  paginateRows,
  parsePassbookAmount,
} from '@/lib/passbook-ledger'
import { PASSBOOK_PAGE_SIZE } from '@/lib/passbook-id'
import {
  addPassbookTransaction,
  canDeletePassbookTx,
  canWritePassbook,
  deletePassbookTransaction,
  ensurePassbook,
  exportPassbookExcel,
  passbookForMember,
  syncPassbookInterest,
  txsForPassbook,
} from '@/lib/passbooks'
import type { PassbookTransaction, PassbookTxnType } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PassbookPage() {
  const { memberId } = useParams()
  const { user } = useAuth()
  const { household, loading, reload } = useHousehold()
  const { alert, alertError, confirm } = useDialog()
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<PassbookTxnType | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const synced = useRef(false)

  const member = household?.members.find((row) => row.id === memberId)
  const passbook = member && household ? passbookForMember(household, member.id) : null

  useEffect(() => {
    synced.current = false
  }, [memberId])

  useEffect(() => {
    if (!household || !member || synced.current) return
    synced.current = true
    void (async () => {
      try {
        const existed = Boolean(passbookForMember(household, member.id))
        const book = await ensurePassbook(household, member)
        const nextHousehold = {
          ...household,
          passbooks: household.passbooks.some((row) => row.id === book.id)
            ? household.passbooks
            : [...household.passbooks, book],
        }
        const { added } = await syncPassbookInterest(nextHousehold, book)
        if (added > 0 || !existed) await reload()
      } catch (cause) {
        synced.current = false
        void alertError(cause, 'Could not open that passbook.')
      }
    })()
  }, [alertError, household, member, reload])

  if (loading || !household) return <ShimmerDetailPage />

  if (!member) {
    return (
      <Page>
        <p className="type-body text-muted">Member not found, or you cannot see them.</p>
        <Link to="/passbooks" className="mt-4 inline-block type-body text-accent">
          Back to passbooks
        </Link>
      </Page>
    )
  }

  const name = member.display_name || member.full_name
  const familyName =
    household.families.find((family) => family.id === member.family_id)?.name ?? null
  const rows = passbook ? txsForPassbook(household, passbook.id) : []
  const range = readPassbookRange(params.get('range'))
  const today = todayIso()
  const from =
    range === 'month' ? monthStartIso() : range === 'custom' ? params.get('from') : null
  const to = range === 'month' ? today : range === 'custom' ? params.get('to') : null
  const page = Number(params.get('page') || '1') || 1
  const filtered = filterByDateRange(rows, from, to)
  const visible = paginateRows(newestFirst(filtered), page, PASSBOOK_PAGE_SIZE)
  const groups = groupByMonth(visible.rows)
  const balance = rows.reduce(
    (sum, row) => sum + (row.txn_type === 'credit' ? row.amount : -row.amount),
    0,
  )
  const canWrite = canWritePassbook(household)
  const canDelete = canDeletePassbookTx(household)

  function setFilter(next: {
    range?: PassbookRange
    from?: string | null
    to?: string | null
    page?: number
  }) {
    const copy = new URLSearchParams(params)
    const nextRange = next.range ?? range
    if (nextRange === 'all') copy.delete('range')
    else copy.set('range', nextRange)
    if (nextRange === 'custom') {
      const nextFrom = 'from' in next ? next.from : from
      const nextTo = 'to' in next ? next.to : to
      if (nextFrom) copy.set('from', nextFrom)
      else copy.delete('from')
      if (nextTo) copy.set('to', nextTo)
      else copy.delete('to')
    } else {
      copy.delete('from')
      copy.delete('to')
    }
    if (next.page && next.page > 1) copy.set('page', String(next.page))
    else copy.delete('page')
    setParams(copy, { replace: true })
  }

  async function onExport() {
    if (exporting) return
    setExporting(true)
    try {
      exportPassbookExcel({
        memberName: name,
        accountNumber: member?.account_number ?? null,
        rows: filtered,
      })
    } catch (cause) {
      void alertError(cause, 'Could not export that file.')
    } finally {
      setExporting(false)
    }
  }

  async function onDeleteTx(row: PassbookTransaction) {
    if (!household) return
    const ok = await confirm({
      title: 'Delete transaction',
      message: `Delete ${row.public_id} (${row.txn_type === 'credit' ? 'credit' : 'debit'} ${formatInr(row.amount)})? Later balances will be recalculated. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setDeletingId(row.id)
    try {
      await deletePassbookTransaction(household, row)
      await reload()
    } catch (cause) {
      await alertError(cause, 'Could not delete that transaction.')
    } finally {
      setDeletingId(null)
    }
  }

  async function onPosted(type: PassbookTxnType, amount: number) {
    await reload()
    setSheet(null)
    await alert(
      type === 'credit' ? 'Credit posted' : 'Debit posted',
      `${formatInr(amount)} has been added to ${name}'s passbook.`,
    )
  }

  return (
    <Page>
      <div className="relative flex items-center py-0.5">
        <span className="relative z-10">
          <BackLink to="/passbooks">‹ Back</BackLink>
        </span>
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center type-card-title text-ink">
          Passbook
        </p>
      </div>
      <h1 className="mt-5 type-hero-heading text-ink">{name}</h1>
      {familyName ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-accent">
          <FamilyIcon className="size-3.5" />
          {familyName}
        </p>
      ) : null}

      <div className={cn('relative mt-5', canWrite && 'mb-16')}>
        <section className="passbook-card px-5 pb-7 pt-5">
          <div className="relative z-10 flex items-start gap-3">
            <span className="passbook-card-initials inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tracking-wide">
              {initials(member.full_name || name)}
            </span>
            <div className="min-w-0">
              <p className="type-label">Account</p>
              <p className="mt-0.5 truncate font-mono text-[13.5px] text-ink">
                {member.account_number || 'No account number'}
              </p>
            </div>
          </div>
          <p className="relative z-10 mt-6 font-mono text-[30px] font-semibold tracking-[-0.03em] text-ink">
            {formatInr(balance)}
          </p>
          <p className="relative z-10 mt-1 type-small">
            {rows.length === 0
              ? 'No transactions yet'
              : `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}`}
          </p>
        </section>
        {canWrite ? (
          <div className="absolute inset-x-0 top-full z-20 flex -translate-y-6 justify-center gap-14">
            <PassbookFab kind="credit" onClick={() => setSheet('credit')} />
            <PassbookFab kind="debit" onClick={() => setSheet('debit')} />
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <ChipGroup>
          <Chip selected={range === 'all'} onClick={() => setFilter({ range: 'all', page: 1 })}>
            All
          </Chip>
          <Chip selected={range === 'month'} onClick={() => setFilter({ range: 'month', page: 1 })}>
            This month
          </Chip>
          <Chip
            selected={range === 'custom'}
            onClick={() =>
              setFilter({
                range: 'custom',
                from: from || monthStartIso(),
                to: to || today,
                page: 1,
              })
            }
          >
            Custom
          </Chip>
        </ChipGroup>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void onExport()}
          className="ml-auto inline-flex shrink-0 items-center gap-1 type-small font-semibold text-ink disabled:opacity-50"
        >
          <ShareIcon className="size-4 rotate-180" />
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      {range === 'custom' ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="from">From date</Label>
            <Input
              id="from"
              type="date"
              value={from ?? ''}
              onChange={(event) =>
                setFilter({ range: 'custom', from: event.target.value || null, page: 1 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To date</Label>
            <Input
              id="to"
              type="date"
              value={to ?? ''}
              onChange={(event) =>
                setFilter({ range: 'custom', to: event.target.value || null, page: 1 })
              }
            />
          </div>
        </div>
      ) : null}

      {visible.total === 0 ? (
        <p className="mt-8 type-body text-muted">
          {rows.length === 0
            ? 'This passbook has no entries yet.'
            : 'No transactions in that date range.'}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map((group) => (
            <section key={group.key} className="surface-card overflow-hidden px-3.5 py-3.5">
              <p className="px-1 text-[13.5px] font-semibold text-accent">
                {formatMonthHeading(`${group.key}-01`)}
              </p>
              <ul className="relative mt-3">
                <span
                  aria-hidden
                  className="absolute top-3 bottom-3 left-[13px] w-px bg-accent/35"
                />
                {group.rows.map((row) => (
                  <TimelineRow
                    key={row.id}
                    row={row}
                    canDelete={canDelete}
                    deleting={deletingId === row.id}
                    onDelete={() => void onDeleteTx(row)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {visible.pages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={visible.page <= 1}
            onClick={() => setFilter({ page: visible.page - 1 })}
          >
            Previous
          </Button>
          <p className="type-small">
            Page <span className="type-num">{visible.page}</span> of{' '}
            <span className="type-num">{visible.pages}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={visible.page >= visible.pages}
            onClick={() => setFilter({ page: visible.page + 1 })}
          >
            Next
          </Button>
        </div>
      ) : null}

      <TxnSheet
        open={sheet}
        memberName={name}
        onClose={() => setSheet(null)}
        onSubmit={async (type, values) => {
          if (!passbook) {
            throw new Error('Passbook is not ready yet. Try again in a moment.')
          }
          if (type === 'debit') {
            const ok = await confirm({
              title: 'Post debit',
              message: `Debit ${formatInr(values.amount)} from ${name}'s passbook?`,
              confirmLabel: 'Post debit',
              tone: 'danger',
            })
            if (!ok) return
          }
          await addPassbookTransaction(household, {
            passbook,
            txn_date: values.date,
            txn_type: type,
            amount: values.amount,
            remarks: values.remarks,
            created_by: user?.id ?? null,
          })
          await onPosted(type, values.amount)
        }}
      />
    </Page>
  )
}

function PassbookFab({
  kind,
  onClick,
}: {
  kind: PassbookTxnType
  onClick: () => void
}) {
  const credit = kind === 'credit'
  return (
    <button
      type="button"
      aria-label={credit ? 'Credit' : 'Debit'}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          'inline-flex size-12 items-center justify-center rounded-full',
          credit ? 'passbook-fab-credit' : 'passbook-fab-debit',
        )}
      >
        {credit ? <PlusIcon className="size-6 stroke-[2.2]" /> : <MinusIcon className="size-6 stroke-[2.2]" />}
      </span>
      <span className={cn('text-[11.5px] font-semibold', credit ? 'text-accent' : 'text-danger')}>
        {credit ? 'Credit' : 'Debit'}
      </span>
    </button>
  )
}

function TimelineRow({
  row,
  canDelete,
  deleting,
  onDelete,
}: {
  row: PassbookTransaction
  canDelete: boolean
  deleting: boolean
  onDelete: () => void
}) {
  const credit = row.txn_type === 'credit'
  const { title, period } = txnLines(row)
  return (
    <li className="relative flex items-start gap-3 border-b border-line py-3 last:border-0">
      <span
        className={cn(
          'relative z-10 mt-0.5 inline-flex size-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] bg-card',
          credit ? 'border-success text-success' : 'border-danger text-danger',
        )}
      >
        {credit ? <PlusIcon className="size-3.5 stroke-[2.4]" /> : <MinusIcon className="size-3.5 stroke-[2.4]" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-card-title text-ink">{title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 type-small">
          <span className="font-mono font-semibold text-ink">{formatDate(row.txn_date)}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{row.public_id}</span>
        </p>
        {period ? <p className="type-small mt-0.5">{period}</p> : null}
        {row.reference ? <p className="type-small font-mono">{row.reference}</p> : null}
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        <div className="text-right">
          <p className={cn('font-mono text-[14.5px] font-semibold', credit ? 'text-success' : 'text-danger')}>
            {credit ? '+' : '−'}
            {formatInr(row.amount)}
          </p>
          <p className="type-small mt-0.5">Bal {formatInr(row.balance_after)}</p>
        </div>
        {canDelete ? (
          <button
            type="button"
            aria-label={`Delete ${row.public_id}`}
            disabled={deleting}
            className="flex size-8 items-center justify-center rounded-lg text-muted disabled:opacity-50"
            onClick={onDelete}
          >
            <TrashIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </li>
  )
}

type PassbookRange = 'all' | 'month' | 'custom'

function readPassbookRange(value: string | null): PassbookRange {
  if (value === 'month' || value === 'custom') return value
  return 'all'
}

function monthStartIso(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

function txnLines(row: PassbookTransaction) {
  const remarks = row.remarks?.trim()
  if (row.source_type === 'fd_interest') {
    const [label, ...rest] = (remarks || 'Interest').split(' · ')
    return { title: label || 'Interest', period: rest.join(' · ') || null }
  }
  return {
    title: remarks || (row.txn_type === 'credit' ? 'Credit' : 'Debit'),
    period: null,
  }
}

function TxnSheet({
  open,
  memberName,
  onClose,
  onSubmit,
}: {
  open: PassbookTxnType | null
  memberName: string
  onClose: () => void
  onSubmit: (
    type: PassbookTxnType,
    values: { amount: number; date: string; remarks: string },
  ) => Promise<void>
}) {
  return (
    <BottomSheet
      open={Boolean(open)}
      onClose={onClose}
      title={open === 'debit' ? `Debit · ${memberName}` : `Credit · ${memberName}`}
    >
      {open ? <TxnForm key={open} type={open} onSubmit={onSubmit} /> : null}
    </BottomSheet>
  )
}

function TxnForm({
  type,
  onSubmit,
}: {
  type: PassbookTxnType
  onSubmit: (
    type: PassbookTxnType,
    values: { amount: number; date: string; remarks: string },
  ) => Promise<void>
}) {
  const { alertError } = useDialog()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit(type, {
        amount: parsePassbookAmount(amount),
        date,
        remarks,
      })
    } catch (cause) {
      await alertError(cause, 'Could not post that transaction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4 pt-2" onSubmit={(event) => void submit(event)}>
      <div className="space-y-2">
        <Label htmlFor="pb-amount">Amount</Label>
        <Input
          id="pb-amount"
          className="font-mono"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="1000"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pb-date">Transaction date</Label>
        <Input
          id="pb-date"
          type="date"
          value={date}
          max={todayIso()}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pb-remarks">Remarks</Label>
        <Input
          id="pb-remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="Optional"
        />
      </div>
      <Button type="submit" size="lg" disabled={saving}>
        {saving ? 'Posting…' : type === 'debit' ? 'Post debit' : 'Post credit'}
      </Button>
    </form>
  )
}
