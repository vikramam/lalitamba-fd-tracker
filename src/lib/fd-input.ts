import { paysOutInterest } from '@/lib/format'
import type { FamilyMember, FdStatus, FixedDeposit, InterestMode } from '@/lib/types'

export type FdDraft = {
  family_member_id: string
  fd_account_no?: string
  bank_customer_id?: string
  holder_name?: string
  holder_address?: string
  principal_amount: number | string
  principal_amount_words?: string
  interest_rate_pct?: number | string | null
  tenure_years?: number | string
  tenure_months?: number | string
  tenure_days?: number | string
  tenure_label?: string
  interest_mode: InterestMode
  monthly_interest_amount?: number | string | null
  interest_credit_account?: string
  credit_interest_to_bank?: boolean
  credit_interest_to_bank_enabled_at?: string | null
  maturity_value?: number | string | null
  fd_date?: string
  transaction_date?: string
  maturity_date?: string
  nominee_name?: string
  nominee_relationship?: string
  status?: FdStatus
  notes?: string
}

export type FdWrite = Omit<FixedDeposit, 'id'>

const SOFT_STATUSES: FdStatus[] = ['draft', 'active', 'matured']

function parseAmount(value: number | string, label: string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label} is invalid.`)
    return value
  }
  const cleaned = value.replace(/,/g, '').trim()
  if (!cleaned) throw new Error(`${label} is required.`)
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid.`)
  return parsed
}

function parseOptionalAmount(
  value: number | string | null | undefined,
  label: string,
): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = parseAmount(value, label)
  return parsed
}

function parseCount(value: number | string | undefined): number {
  if (value === undefined || value === '') return 0
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Tenure cannot be negative.')
    }
    return Math.trunc(value)
  }
  const cleaned = value.trim()
  if (!cleaned) return 0
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Tenure cannot be negative.')
  }
  return Math.trunc(parsed)
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export function normalizeFdInput(
  draft: FdDraft,
  members: FamilyMember[],
  current?: Pick<
    FixedDeposit,
    'status' | 'credit_interest_to_bank' | 'credit_interest_to_bank_enabled_at'
  >,
): FdWrite {
  const member = members.find((row) => row.id === draft.family_member_id)
  if (!member) {
    throw new Error('Choose a member.')
  }

  const principal_amount = parseAmount(draft.principal_amount, 'Principal')
  if (principal_amount <= 0) {
    throw new Error('Principal must be greater than 0.')
  }

  const interest_rate_pct = parseOptionalAmount(draft.interest_rate_pct, 'Interest rate')
  if (interest_rate_pct !== null && (interest_rate_pct < 0 || interest_rate_pct > 30)) {
    throw new Error('Interest rate must be between 0 and 30%.')
  }

  const payoutLabel =
    draft.interest_mode === 'quarterly' ? 'Quarterly interest' : 'Monthly interest'
  const monthly_interest_amount = parseOptionalAmount(
    draft.monthly_interest_amount,
    payoutLabel,
  )
  if (monthly_interest_amount !== null && monthly_interest_amount < 0) {
    throw new Error(`${payoutLabel} cannot be negative.`)
  }

  const maturity_value = parseOptionalAmount(draft.maturity_value, 'Maturity value')
  if (maturity_value !== null && maturity_value < 0) {
    throw new Error('Maturity value cannot be negative.')
  }

  const tenure_years = parseCount(draft.tenure_years)
  const tenure_months = parseCount(draft.tenure_months)
  const tenure_days = parseCount(draft.tenure_days)
  let tenure_label = emptyToNull(draft.tenure_label)
  if (!tenure_label && tenure_years > 0 && tenure_months === 0 && tenure_days === 0) {
    tenure_label = tenure_years === 1 ? '1 Year' : `${tenure_years} Years`
  }

  const maturity_date = emptyToNull(draft.maturity_date)
  if (
    tenure_years <= 0 &&
    tenure_months <= 0 &&
    tenure_days <= 0 &&
    !tenure_label &&
    !maturity_date
  ) {
    throw new Error('Enter a period or a maturity date.')
  }

  const interest_mode = draft.interest_mode
  const monthly =
    paysOutInterest(interest_mode)
      ? {
          monthly_interest_amount,
          interest_credit_account: emptyToNull(draft.interest_credit_account),
        }
      : {
          monthly_interest_amount: null,
          interest_credit_account: null,
        }

  const requested = draft.status ?? current?.status ?? 'active'
  if (current?.status === 'closed' || current?.status === 'renewed') {
    if (requested !== current.status) {
      throw new Error('Use Renew or Close on the deposit page for that change.')
    }
  } else if (!SOFT_STATUSES.includes(requested)) {
    throw new Error('Status must be draft, active, or matured.')
  }

  return {
    family_id: member.family_id,
    family_member_id: member.id,
    fd_account_no: emptyToNull(draft.fd_account_no),
    bank_customer_id: emptyToNull(draft.bank_customer_id) ?? member.bank_customer_id,
    holder_name: emptyToNull(draft.holder_name) ?? member.full_name,
    holder_address: emptyToNull(draft.holder_address),
    principal_amount,
    principal_amount_words: emptyToNull(draft.principal_amount_words),
    interest_rate_pct,
    tenure_years,
    tenure_months,
    tenure_days,
    tenure_label,
    interest_mode,
    ...monthly,
    credit_interest_to_bank:
      paysOutInterest(interest_mode) &&
      (draft.credit_interest_to_bank ?? current?.credit_interest_to_bank ?? false),
    credit_interest_to_bank_enabled_at: paysOutInterest(interest_mode)
      ? (draft.credit_interest_to_bank_enabled_at ??
        current?.credit_interest_to_bank_enabled_at ??
        null)
      : null,
    maturity_value,
    fd_date: emptyToNull(draft.fd_date),
    transaction_date: emptyToNull(draft.transaction_date),
    print_at: null,
    maturity_date,
    nominee_name: emptyToNull(draft.nominee_name),
    nominee_relationship: emptyToNull(draft.nominee_relationship),
    status: requested,
    notes: emptyToNull(draft.notes),
  }
}
