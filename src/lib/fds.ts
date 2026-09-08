import { addDemoFd, updateDemoFd } from '@/lib/demo-store'
import { FD_SELECT, mapFixedDeposit } from '@/lib/fd-map'
import { normalizeFdInput, type FdDraft } from '@/lib/fd-input'
import { supabase } from '@/lib/supabase'
import type { FamilyMember, FixedDeposit } from '@/lib/types'

function writePayload(row: ReturnType<typeof normalizeFdInput>) {
  return {
    family_id: row.family_id,
    family_member_id: row.family_member_id,
    fd_account_no: row.fd_account_no,
    bank_customer_id: row.bank_customer_id,
    holder_name: row.holder_name,
    holder_address: row.holder_address,
    principal_amount: row.principal_amount,
    principal_amount_words: row.principal_amount_words,
    interest_rate_pct: row.interest_rate_pct,
    tenure_years: row.tenure_years,
    tenure_months: row.tenure_months,
    tenure_days: row.tenure_days,
    tenure_label: row.tenure_label,
    interest_mode: row.interest_mode,
    monthly_interest_amount: row.monthly_interest_amount,
    interest_credit_account: row.interest_credit_account,
    maturity_value: row.maturity_value,
    fd_date: row.fd_date,
    transaction_date: row.transaction_date,
    maturity_date: row.maturity_date,
    nominee_name: row.nominee_name,
    nominee_relationship: row.nominee_relationship,
    status: row.status,
    notes: row.notes,
  }
}

export async function createFd(
  draft: FdDraft,
  members: FamilyMember[],
): Promise<FixedDeposit> {
  const row = normalizeFdInput(draft, members)
  if (!supabase) {
    return addDemoFd(row)
  }

  const { data, error } = await supabase
    .from('fixed_deposits')
    .insert(writePayload(row))
    .select(FD_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapFixedDeposit(data as Record<string, unknown>)
}

export async function updateFd(
  id: string,
  draft: FdDraft,
  members: FamilyMember[],
  current: FixedDeposit,
): Promise<FixedDeposit> {
  const row = normalizeFdInput(draft, members, current)
  if (!supabase) {
    const updated = updateDemoFd(id, row)
    if (!updated) throw new Error('Deposit not found.')
    return updated
  }

  const { data, error } = await supabase
    .from('fixed_deposits')
    .update(writePayload(row))
    .eq('id', id)
    .select(FD_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapFixedDeposit(data as Record<string, unknown>)
}

export function canWriteFds(household: {
  isAppAdmin: boolean
  families: unknown[]
}) {
  return household.isAppAdmin || household.families.length > 0
}
