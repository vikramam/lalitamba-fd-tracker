import type { FixedDeposit } from '@/lib/types'

export const FD_SELECT =
  'id, family_id, family_member_id, fd_account_no, bank_customer_id, holder_name, holder_address, principal_amount, principal_amount_words, interest_rate_pct, tenure_years, tenure_months, tenure_days, tenure_label, interest_mode, monthly_interest_amount, interest_credit_account, credit_interest_to_bank, credit_interest_to_bank_enabled_at, maturity_value, fd_date, transaction_date, print_at, maturity_date, nominee_name, nominee_relationship, status, notes'

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  return Number(value)
}

export function mapFixedDeposit(row: Record<string, unknown>): FixedDeposit {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    family_member_id: String(row.family_member_id),
    fd_account_no: (row.fd_account_no as string | null) ?? null,
    bank_customer_id: (row.bank_customer_id as string | null) ?? null,
    holder_name: (row.holder_name as string | null) ?? null,
    holder_address: (row.holder_address as string | null) ?? null,
    principal_amount: Number(row.principal_amount),
    principal_amount_words: (row.principal_amount_words as string | null) ?? null,
    interest_rate_pct: toNumber(row.interest_rate_pct as string | number | null),
    tenure_years: Number(row.tenure_years ?? 0),
    tenure_months: Number(row.tenure_months ?? 0),
    tenure_days: Number(row.tenure_days ?? 0),
    tenure_label: (row.tenure_label as string | null) ?? null,
    interest_mode: row.interest_mode as FixedDeposit['interest_mode'],
    monthly_interest_amount: toNumber(
      row.monthly_interest_amount as string | number | null,
    ),
    interest_credit_account: (row.interest_credit_account as string | null) ?? null,
    credit_interest_to_bank: Boolean(row.credit_interest_to_bank),
    credit_interest_to_bank_enabled_at:
      (row.credit_interest_to_bank_enabled_at as string | null) ?? null,
    maturity_value: toNumber(row.maturity_value as string | number | null),
    fd_date: (row.fd_date as string | null) ?? null,
    transaction_date: (row.transaction_date as string | null) ?? null,
    print_at: (row.print_at as string | null) ?? null,
    maturity_date: (row.maturity_date as string | null) ?? null,
    nominee_name: (row.nominee_name as string | null) ?? null,
    nominee_relationship: (row.nominee_relationship as string | null) ?? null,
    status: row.status as FixedDeposit['status'],
    notes: (row.notes as string | null) ?? null,
  }
}
