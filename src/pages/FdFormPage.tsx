import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom'

import { Chip, ChipGroup } from '@/components/Chip'
import { SpinnerIcon } from '@/components/icons'
import { ShimmerFormPage } from '@/components/Shimmer'
import { OcrFieldBadge } from '@/components/OcrFieldBadge'
import { BackLink, Page } from '@/components/Page'
import { ReceiptPicker } from '@/components/ReceiptPicker'
import { PickerAvatar, SheetPicker } from '@/components/SheetPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { useAuth } from '@/lib/auth'
import { fdCheckMessages } from '@/lib/fd-checks'
import { normalizeFdInput, type FdDraft } from '@/lib/fd-input'
import { canWriteFds, createFd, updateFd } from '@/lib/fds'
import { formatInr, paysOutInterest } from '@/lib/format'
import type { FdExtraction } from '@/lib/lalitamba-map'
import { carryMessage, canLifecycle, renewFd, suggestedCarry } from '@/lib/lifecycle'
import { extractFdReceipt, linkOcrRun, suggestMemberId } from '@/lib/ocr'
import { ocrFieldBadge, saveOcrFieldReviews, type ReviewField } from '@/lib/ocr-reviews'
import type { PreparedReceipt } from '@/lib/receipt-file'
import { currentReceipt, saveFdReceipt } from '@/lib/receipts'
import type { FamilyMember, FixedDeposit, Household, InterestMode } from '@/lib/types'

function Field({
  id,
  label,
  badge,
  children,
}: {
  id: string
  label: string
  badge?: ReturnType<typeof ocrFieldBadge>
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        <OcrFieldBadge kind={badge} />
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  )
}

function asDraft(state: {
  memberId: string
  accountNo: string
  cid: string
  holderName: string
  holderAddress: string
  principal: string
  words: string
  rate: string
  years: string
  label: string
  mode: InterestMode
  monthly: string
  msAccount: string
  maturity: string
  fdDate: string
  txnDate: string
  maturityDate: string
  nominee: string
  relationship: string
  status: FixedDeposit['status']
  notes: string
}): FdDraft {
  return {
    family_member_id: state.memberId,
    fd_account_no: state.accountNo,
    bank_customer_id: state.cid,
    holder_name: state.holderName,
    holder_address: state.holderAddress,
    principal_amount: state.principal,
    principal_amount_words: state.words,
    interest_rate_pct: state.rate,
    tenure_years: state.years,
    tenure_label: state.label,
    interest_mode: state.mode,
    monthly_interest_amount: state.monthly,
    interest_credit_account: state.msAccount,
    maturity_value: state.maturity,
    fd_date: state.fdDate,
    transaction_date: state.txnDate,
    maturity_date: state.maturityDate,
    nominee_name: state.nominee,
    nominee_relationship: state.relationship,
    status: state.status,
    notes: state.notes,
  }
}

export function FdFormPage() {
  const { fdId } = useParams()
  const { household, loading, reload } = useHousehold()
  const isRenew = Boolean(useMatch('/fds/:fdId/renew'))
  const isNew = !isRenew && (!fdId || fdId === 'new')
  const fd = household?.deposits.find((row) => row.id === fdId)
  const existingRenewal = household?.renewals.find((row) => row.previous_fd_id === fdId)
  const canWrite = household ? canWriteFds(household) : false

  if (loading || !household) {
    return <ShimmerFormPage />
  }

  if ((!isNew || isRenew) && !fd) {
    return (
      <Page>
        <p className="text-[13px] text-muted">Deposit not found, or you cannot see it.</p>
        <Link to="/fds" className="mt-4 inline-block text-[13px] text-accent">
          Back to FDs
        </Link>
      </Page>
    )
  }

  if (isRenew && fd && !canLifecycle(fd)) {
    return (
      <Page>
        <p className="text-[13px] text-muted">
          This deposit is {fd.status}. Only an active or matured FD can be renewed.
        </p>
        <Link to={`/fds/${fd.id}`} className="mt-4 inline-block text-[13px] text-accent">
          Back to deposit
        </Link>
      </Page>
    )
  }

  if (isRenew && existingRenewal) {
    return (
      <Page>
        <p className="text-[13px] text-muted">This deposit is already renewed.</p>
        <Link
          to={`/fds/${existingRenewal.new_fd_id}`}
          className="mt-4 inline-block text-[13px] text-accent"
        >
          Open the new FD
        </Link>
      </Page>
    )
  }

  if (!canWrite) {
    return (
      <Page>
        <p className="text-[13px] text-muted">You cannot edit deposits.</p>
        <Link to="/fds" className="mt-4 inline-block text-[13px] text-accent">
          Back to FDs
        </Link>
      </Page>
    )
  }

  if (household.members.length === 0) {
    return (
      <Page>
        <p className="text-[13px] text-muted">Add a member before creating an FD.</p>
        <Link to="/members/new" className="mt-4 inline-block text-[13px] text-accent">
          Add member
        </Link>
      </Page>
    )
  }

  return (
    <FdForm
      household={household}
      fd={isRenew ? undefined : fd}
      previous={isRenew ? fd : undefined}
      isNew={isNew || isRenew}
      isRenew={isRenew}
      reload={reload}
    />
  )
}

function FdForm({
  household,
  fd,
  previous,
  isNew,
  isRenew,
  reload,
}: {
  household: Household
  fd?: FixedDeposit
  previous?: FixedDeposit
  isNew: boolean
  isRenew: boolean
  reload: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { alert, alertError } = useDialog()
  const members = household.members
  const seed = isRenew ? previous : fd
  const existingReceipt = fd ? currentReceipt(household.receipts, fd.id) : null
  const [memberId, setMemberId] = useState(seed?.family_member_id ?? members[0]?.id ?? '')
  const [accountNo, setAccountNo] = useState(isRenew ? '' : (fd?.fd_account_no ?? ''))
  const [cid, setCid] = useState(seed?.bank_customer_id ?? members[0]?.bank_customer_id ?? '')
  const [holderName, setHolderName] = useState(
    seed?.holder_name ?? members[0]?.full_name ?? '',
  )
  const [holderAddress, setHolderAddress] = useState(seed?.holder_address ?? '')
  const [principal, setPrincipal] = useState(
    fd ? String(fd.principal_amount) : '',
  )
  const [words, setWords] = useState(fd?.principal_amount_words ?? '')
  const [rate, setRate] = useState(
    fd?.interest_rate_pct === null || fd?.interest_rate_pct === undefined
      ? ''
      : String(fd.interest_rate_pct),
  )
  const [years, setYears] = useState(fd?.tenure_years ? String(fd.tenure_years) : '')
  const [label, setLabel] = useState(fd?.tenure_label ?? '')
  const [mode, setMode] = useState<InterestMode>(fd?.interest_mode ?? 'monthly')
  const [monthly, setMonthly] = useState(
    fd?.monthly_interest_amount === null || fd?.monthly_interest_amount === undefined
      ? ''
      : String(fd.monthly_interest_amount),
  )
  const [msAccount, setMsAccount] = useState(fd?.interest_credit_account ?? '')
  const [maturity, setMaturity] = useState(
    fd?.maturity_value === null || fd?.maturity_value === undefined
      ? ''
      : String(fd.maturity_value),
  )
  const [fdDate, setFdDate] = useState(fd?.fd_date ?? '')
  const [txnDate, setTxnDate] = useState(fd?.transaction_date ?? '')
  const [maturityDate, setMaturityDate] = useState(fd?.maturity_date ?? '')
  const [nominee, setNominee] = useState(seed?.nominee_name ?? '')
  const [relationship, setRelationship] = useState(seed?.nominee_relationship ?? '')
  const [status, setStatus] = useState(fd?.status ?? 'active')
  const [notes, setNotes] = useState(isRenew ? '' : (fd?.notes ?? ''))
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<PreparedReceipt | null>(null)
  const [createdFd, setCreatedFd] = useState(isRenew ? undefined : fd)
  const [ocrRunId, setOcrRunId] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<FdExtraction | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [reading, setReading] = useState(false)
  const [ocrMessage, setOcrMessage] = useState<string | null>(null)
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([])

  const lockedStatus = fd?.status === 'closed' || fd?.status === 'renewed'

  function applyMember(id: string) {
    setMemberId(id)
    const member = members.find((row) => row.id === id)
    if (!member) return
    setCid(member.bank_customer_id ?? '')
    setHolderName(member.full_name)
  }

  function applyExtraction(fields: FdExtraction) {
    const nextMember = suggestMemberId(fields, members, memberId)
    if (nextMember !== memberId) {
      setMemberId(nextMember)
    }
    if (fields.fd_account_no) setAccountNo(fields.fd_account_no)
    if (fields.bank_customer_id) setCid(fields.bank_customer_id)
    if (fields.holder_name) setHolderName(fields.holder_name)
    if (fields.holder_address) setHolderAddress(fields.holder_address)
    if (fields.principal_amount !== null) setPrincipal(String(fields.principal_amount))
    if (fields.principal_amount_words) setWords(fields.principal_amount_words)
    if (fields.interest_rate_pct !== null) setRate(String(fields.interest_rate_pct))
    if (fields.tenure_years !== null) setYears(String(fields.tenure_years))
    if (fields.tenure_label) setLabel(fields.tenure_label)
    if (
      fields.interest_mode === 'monthly' ||
      fields.interest_mode === 'quarterly' ||
      fields.interest_mode === 'on_maturity'
    ) {
      setMode(fields.interest_mode)
    }
    if (fields.interest_mode === 'on_maturity') {
      setMonthly('')
      setMsAccount('')
    } else {
      if (fields.monthly_interest_amount !== null) {
        setMonthly(String(fields.monthly_interest_amount))
      }
      if (fields.interest_credit_account) setMsAccount(fields.interest_credit_account)
    }
    if (fields.maturity_value !== null) setMaturity(String(fields.maturity_value))
    if (fields.fd_date) setFdDate(fields.fd_date)
    if (fields.transaction_date) setTxnDate(fields.transaction_date)
    if (fields.maturity_date) setMaturityDate(fields.maturity_date)
    if (fields.nominee_name) setNominee(fields.nominee_name)
    if (fields.nominee_relationship) setRelationship(fields.nominee_relationship)
  }

  async function readReceipt(file: File) {
    if (!user) {
      await alert('Read receipt', 'Sign in again.')
      return
    }
    const familyId = members.find((row) => row.id === memberId)?.family_id
    if (!familyId) {
      await alert('Read receipt', 'Choose a member first.')
      return
    }
    setReading(true)
    setOcrWarnings([])
    try {
      const result = await extractFdReceipt({
        file,
        familyId,
        userId: user.id,
      })
      setOcrRunId(result.ocrRunId)
      setOcrWarnings(result.warnings)
      if (result.status === 'succeeded') {
        setExtracted(result.fields)
        setConfidence(result.confidence)
        applyExtraction(result.fields)
        setOcrMessage(
          result.message ?? 'Check the extracted fields. Nothing is saved until you tap Save.',
        )
      } else {
        await alert('Read receipt', result.message ?? 'Could not read the receipt.')
      }
    } catch (cause) {
      await alertError(cause, 'Could not read the receipt.', 'Read receipt')
    } finally {
      setReading(false)
    }
  }

  async function onReceiptChange(value: PreparedReceipt | null) {
    if (receipt?.previewUrl && receipt.previewUrl !== value?.previewUrl) {
      URL.revokeObjectURL(receipt.previewUrl)
    }
    setReceipt(value)
    setOcrRunId(null)
    setExtracted(null)
    setConfidence({})
    setOcrWarnings([])
    if (value) await readReceipt(value.file)
    else setOcrMessage(null)
  }

  const draft = asDraft({
    memberId,
    accountNo,
    cid,
    holderName,
    holderAddress,
    principal,
    words,
    rate,
    years,
    label,
    mode,
    monthly,
    msAccount,
    maturity,
    fdDate,
    txnDate,
    maturityDate,
    nominee,
    relationship,
    status,
    notes,
  })

  let previewChecks: string[] = []
  try {
    const normalized = normalizeFdInput(draft, members, fd)
    previewChecks = fdCheckMessages({
      ...normalized,
      id: fd?.id ?? 'preview',
    })
  } catch {
    previewChecks = []
  }

  function badge(field: ReviewField, current: unknown) {
    return ocrFieldBadge({
      hasOcr: extracted !== null,
      extracted: extracted?.[field],
      current,
      confidence: confidence[field],
    })
  }

  const selectedMember = members.find((member) => member.id === memberId)
  const carry = previous ? suggestedCarry(previous) : null
  const principalNumber = Number(principal.replace(/,/g, ''))
  const carryNote =
    previous && Number.isFinite(principalNumber) && principalNumber > 0
      ? carryMessage(carry ?? previous.principal_amount, principalNumber)
      : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = isRenew && previous
        ? (await renewFd({
            previous,
            draft,
            members,
            existing: household.renewals.find((row) => row.previous_fd_id === previous.id),
          })).next
        : createdFd
          ? await updateFd(createdFd.id, draft, members, createdFd)
          : await createFd(draft, members)
      setCreatedFd(saved)
      if (ocrRunId && extracted) {
        await saveOcrFieldReviews({
          ocrRunId,
          fdId: saved.id,
          extracted,
          confirmed: saved,
          confidence,
        })
      }
      if (receipt) {
        if (!user) throw new Error('Sign in again.')
        try {
          const stored = await saveFdReceipt({ fd: saved, file: receipt.file, userId: user.id })
          if (ocrRunId) {
            await linkOcrRun({
              ocrRunId,
              fdId: saved.id,
              receiptId: stored.id,
            })
          }
        } catch (cause) {
          throw new Error(
            `The deposit was saved, but the receipt could not be uploaded. ${
              cause instanceof Error ? cause.message : ''
            }`.trim(),
          )
        }
      } else if (ocrRunId) {
        await linkOcrRun({ ocrRunId, fdId: saved.id })
      }
      if (receipt?.previewUrl) URL.revokeObjectURL(receipt.previewUrl)
      await reload()
      navigate(`/fds/${saved.id}`)
    } catch (cause) {
      await alertError(cause, 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to={previous ? `/fds/${previous.id}` : fd ? `/fds/${fd.id}` : '/fds'} />
      <h1 className="mt-4 font-display text-[20px] font-bold tracking-tight">
        {isRenew ? 'Renew FD' : isNew ? 'Add FD' : 'Edit FD'}
      </h1>
      {previous ? (
        <p className="mt-2 text-[13px] text-muted">
          Renewing {previous.fd_account_no ?? 'this FD'} · {formatInr(previous.principal_amount)}
          {carry !== null ? ` · carry ${formatInr(carry)}` : ''}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-muted">
          Photograph the certificate. Reading the slip fills the fields — check them
          before you save. OCR never writes the FD by itself.
        </p>
      )}
      {carryNote ? <p className="mt-2 text-[13px] text-muted">{carryNote}</p> : null}

      <form className="mt-8 space-y-5 pb-8" onSubmit={(event) => void onSubmit(event)}>
        <ReceiptPicker
          value={receipt}
          existing={existingReceipt}
          onChange={(value) => void onReceiptChange(value)}
          disabled={saving || reading}
          busy={reading}
          busyLabel="Reading receipt…"
        />
        {receipt ? (
          <Button
            type="button"
            variant="outline"
            disabled={reading || saving}
            onClick={() => void readReceipt(receipt.file)}
          >
            Read receipt again
          </Button>
        ) : null}
        {ocrMessage && !reading ? (
          <p className="text-[13px] text-muted" role="status">
            {ocrMessage}
          </p>
        ) : null}
        {ocrWarnings.map((warning) => (
          <p key={warning} className="text-[13px] text-warn">
            {warning}
          </p>
        ))}

        <Field id="member" label="Member">
          <SheetPicker
            id="member"
            title="Choose member"
            hint="Tap to choose member"
            selectedId={memberId || null}
            valueLabel={selectedMember?.full_name ?? 'Choose member'}
            leading={<PickerAvatar name={selectedMember?.full_name} />}
            options={members.map((member: FamilyMember) => ({
              id: member.id,
              label: member.full_name,
              secondary: member.bank_customer_id
                ? `CID ${member.bank_customer_id}`
                : 'No CID',
              leading: <PickerAvatar name={member.full_name} />,
            }))}
            onSelect={applyMember}
          />
        </Field>

        <Field id="holderName" label="Holder name" badge={badge('holder_name', holderName)}>
          <Input
            id="holderName"
            value={holderName}
            onChange={(event) => setHolderName(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 items-stretch gap-3">
          <Field id="cid" label="CID" badge={badge('bank_customer_id', cid)}>
            <Input
              id="cid"
              className="font-mono"
              inputMode="numeric"
              value={cid}
              onChange={(event) => setCid(event.target.value)}
            />
          </Field>
          <Field id="accountNo" label="FD-A/c No" badge={badge('fd_account_no', accountNo)}>
            <Input
              id="accountNo"
              className="font-mono"
              value={accountNo}
              onChange={(event) => setAccountNo(event.target.value)}
              placeholder="01FD40599"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 items-stretch gap-3">
          <Field id="principal" label="Principal" badge={badge('principal_amount', principal)}>
            <Input
              id="principal"
              className="font-mono"
              inputMode="decimal"
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
              placeholder="150000"
              required
            />
          </Field>
          <Field id="rate" label="Interest rate %" badge={badge('interest_rate_pct', rate)}>
            <Input
              id="rate"
              className="font-mono"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder="11"
            />
          </Field>
        </div>
        <Field id="words" label="Amount in words" badge={badge('principal_amount_words', words)}>
          <Input
            id="words"
            value={words}
            onChange={(event) => setWords(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 items-stretch gap-3">
          <Field id="years" label="Period (years)" badge={badge('tenure_years', years)}>
            <Input
              id="years"
              inputMode="numeric"
              value={years}
              onChange={(event) => setYears(event.target.value)}
            />
          </Field>
          <Field id="label" label="Period label" badge={badge('tenure_label', label)}>
            <Input
              id="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="3 Years"
            />
          </Field>
        </div>
        <Field id="maturity" label="Maturity value" badge={badge('maturity_value', maturity)}>
          <Input
            id="maturity"
            className="font-mono"
            inputMode="decimal"
            value={maturity}
            onChange={(event) => setMaturity(event.target.value)}
          />
        </Field>
        <Field id="mode" label="Interest mode" badge={badge('interest_mode', mode)}>
          <ChipGroup>
            <Chip selected={mode === 'monthly'} onClick={() => setMode('monthly')}>
              Monthly
            </Chip>
            <Chip selected={mode === 'quarterly'} onClick={() => setMode('quarterly')}>
              Quarterly
            </Chip>
            <Chip selected={mode === 'on_maturity'} onClick={() => setMode('on_maturity')}>
              On maturity
            </Chip>
          </ChipGroup>
        </Field>

        {paysOutInterest(mode) ? (
          <div className="grid grid-cols-2 items-stretch gap-3">
            <Field
              id="monthly"
              label={mode === 'quarterly' ? 'Quarterly interest' : 'Monthly interest'}
              badge={badge('monthly_interest_amount', monthly)}
            >
              <Input
                id="monthly"
                className="font-mono"
                inputMode="decimal"
                value={monthly}
                onChange={(event) => setMonthly(event.target.value)}
                placeholder="1375"
              />
            </Field>
            <Field
              id="msAccount"
              label="MS A/c"
              badge={badge('interest_credit_account', msAccount)}
            >
              <Input
                id="msAccount"
                value={msAccount}
                onChange={(event) => setMsAccount(event.target.value)}
                placeholder="01003MS001396"
              />
            </Field>
          </div>
        ) : null}

        <div className="grid grid-cols-2 items-stretch gap-3">
          <Field id="fdDate" label="FD date" badge={badge('fd_date', fdDate)}>
            <Input
              id="fdDate"
              type="date"
              value={fdDate}
              onChange={(event) => setFdDate(event.target.value)}
            />
          </Field>
          <Field id="maturityDate" label="Date of maturity" badge={badge('maturity_date', maturityDate)}>
            <Input
              id="maturityDate"
              type="date"
              value={maturityDate}
              onChange={(event) => setMaturityDate(event.target.value)}
            />
          </Field>
        </div>
        <Field id="holderAddress" label="Address" badge={badge('holder_address', holderAddress)}>
          <Input
            id="holderAddress"
            value={holderAddress}
            onChange={(event) => setHolderAddress(event.target.value)}
          />
        </Field>
        <Field id="nominee" label="Nominee" badge={badge('nominee_name', nominee)}>
          <Input
            id="nominee"
            value={nominee}
            onChange={(event) => setNominee(event.target.value)}
          />
        </Field>
        <Field id="relationship" label="Relationship" badge={badge('nominee_relationship', relationship)}>
          <Input
            id="relationship"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
          />
        </Field>
        <Field id="txnDate" label="Transaction date" badge={badge('transaction_date', txnDate)}>
          <Input
            id="txnDate"
            type="date"
            value={txnDate}
            onChange={(event) => setTxnDate(event.target.value)}
          />
        </Field>
        {!isNew ? (
              <Field id="status" label="Status">
                <ChipGroup>
                  {(lockedStatus ? [status] : (['draft', 'active', 'matured'] as const)).map(
                    (option) => (
                      <Chip
                        key={option}
                        selected={status === option}
                        disabled={lockedStatus}
                        onClick={() => setStatus(option)}
                      >
                        {option}
                      </Chip>
                    ),
                  )}
                </ChipGroup>
              </Field>
            ) : null}
        <Field id="notes" label="Notes">
          <Input
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>

        {previewChecks.length > 0 ? (
          <ul className="space-y-2">
            {previewChecks.map((message) => (
              <li key={message} className="text-[13px] text-warn">
                {message}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="sticky bottom-20 space-y-3 bg-canvas pt-4 md:bottom-0">
          <Button type="submit" size="lg" disabled={saving || reading}>
            {saving ? <SpinnerIcon className="size-4" /> : null}
            {saving
              ? receipt
                ? 'Uploading…'
                : isRenew
                  ? 'Renewing…'
                  : 'Saving…'
              : isRenew
                ? 'Confirm renewal'
                : 'Save'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
