import {
  addDemoFd,
  allDemoDeposits,
  deleteDemoFd,
  moveDemoFdRelated,
  updateDemoFd,
} from '@/lib/demo-store'
import { FD_SELECT, mapFixedDeposit } from '@/lib/fd-map'
import { normalizeFdInput, type FdDraft } from '@/lib/fd-input'
import { supabase } from '@/lib/supabase'
import type { FamilyMember, FixedDeposit, Household } from '@/lib/types'

export const DUPLICATE_FD_ACCOUNT_MESSAGE =
  'This FD-A/c No already exists. Each deposit must have a unique account number.'

export function fdAccountKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function isDuplicateFdAccountError(cause: unknown) {
  if (!cause || typeof cause !== 'object') return false
  const error = cause as { code?: string; message?: string }
  const message = error.message ?? ''
  return (
    error.code === '23505' ||
    /duplicate key value/i.test(message) ||
    /idx_fds_account/i.test(message)
  )
}

function mapFdWriteError(error: { code?: string; message: string }) {
  if (isDuplicateFdAccountError(error)) {
    return new Error(DUPLICATE_FD_ACCOUNT_MESSAGE)
  }
  return new Error(error.message)
}

export function duplicateFdAccountError(
  accountNo: string | null | undefined,
  deposits: Array<Pick<FixedDeposit, 'id' | 'fd_account_no'>>,
  excludeId?: string,
) {
  const key = fdAccountKey(accountNo)
  if (!key) return null
  const found = deposits.some(
    (fd) => fd.id !== excludeId && fdAccountKey(fd.fd_account_no) === key,
  )
  return found ? DUPLICATE_FD_ACCOUNT_MESSAGE : null
}

export function depositsForAccountCheck(household: Household) {
  if (!supabase) return allDemoDeposits()
  return household.deposits
}

async function assertUniqueFdAccount(accountNo: string | null, excludeId?: string) {
  const key = fdAccountKey(accountNo)
  if (!key) return

  if (!supabase) {
    const existing = duplicateFdAccountError(accountNo, allDemoDeposits(), excludeId)
    if (existing) throw new Error(existing)
    return
  }

  const { data, error } = await supabase
    .from('fixed_deposits')
    .select('id, fd_account_no')
  if (error) throw new Error(error.message)
  const existing = duplicateFdAccountError(accountNo, data ?? [], excludeId)
  if (existing) throw new Error(existing)
}

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
    credit_interest_to_bank: row.credit_interest_to_bank,
    credit_interest_to_bank_enabled_at: row.credit_interest_to_bank_enabled_at,
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
  await assertUniqueFdAccount(row.fd_account_no)
  if (!supabase) {
    return addDemoFd(row)
  }

  const { data, error } = await supabase
    .from('fixed_deposits')
    .insert(writePayload(row))
    .select(FD_SELECT)
    .single()
  if (error) throw mapFdWriteError(error)
  return mapFixedDeposit(data as Record<string, unknown>)
}

export async function updateFd(
  id: string,
  draft: FdDraft,
  members: FamilyMember[],
  current: FixedDeposit,
): Promise<FixedDeposit> {
  const row = normalizeFdInput(draft, members, current)
  await assertUniqueFdAccount(row.fd_account_no, id)
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
  if (error) throw mapFdWriteError(error)
  return mapFixedDeposit(data as Record<string, unknown>)
}

export async function updateCreditInterestToBank(
  fd: FixedDeposit,
  enabled: boolean,
): Promise<FixedDeposit> {
  if (fd.status !== 'active' || !['monthly', 'quarterly'].includes(fd.interest_mode)) {
    throw new Error('Bank interest transfer is only available for active monthly or quarterly FDs.')
  }
  const enabledAt = enabled ? new Date().toISOString() : null
  if (!supabase) {
    const updated = updateDemoFd(fd.id, {
      ...fd,
      credit_interest_to_bank: enabled,
      credit_interest_to_bank_enabled_at: enabledAt,
    })
    if (!updated) throw new Error('Deposit not found.')
    return updated
  }
  const { data, error } = await supabase
    .from('fixed_deposits')
    .update({
      credit_interest_to_bank: enabled,
      credit_interest_to_bank_enabled_at: enabledAt,
    })
    .eq('id', fd.id)
    .eq('status', 'active')
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

export function canDeleteFds(
  household: Pick<Household, 'isAppAdmin' | 'families'>,
  familyId: string,
) {
  return (
    household.isAppAdmin ||
    household.families.some(
      (family) =>
        family.id === familyId &&
        (family.role === 'family_admin' || family.role === 'app_admin'),
    )
  )
}

export async function deleteFd(fd: FixedDeposit) {
  if (!supabase) {
    deleteDemoFd(fd.id)
    return
  }

  const [{ data: receipts, error: receiptError }, { data: runs, error: runError }] =
    await Promise.all([
      supabase.from('fd_receipts').select('storage_path').eq('fd_id', fd.id),
      supabase.from('ocr_runs').select('storage_path').eq('fd_id', fd.id),
    ])
  if (receiptError) throw new Error(receiptError.message)
  if (runError) throw new Error(runError.message)

  const paths = [
    ...new Set(
      [...(receipts ?? []), ...(runs ?? [])]
        .map((row) => row.storage_path)
        .filter((path): path is string => Boolean(path)),
    ),
  ]
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('fd-receipts').remove(paths)
    if (storageError) throw new Error(storageError.message)
  }

  const related = [
    supabase.from('ocr_field_reviews').delete().eq('fd_id', fd.id),
    supabase.from('ocr_runs').delete().eq('fd_id', fd.id),
    supabase.from('fd_receipts').delete().eq('fd_id', fd.id),
    supabase.from('fd_closures').delete().eq('fd_id', fd.id),
    supabase.from('fd_renewals').delete().or(`previous_fd_id.eq.${fd.id},new_fd_id.eq.${fd.id}`),
  ]
  for (const request of related) {
    const { error } = await request
    if (error) throw new Error(error.message)
  }

  const { error } = await supabase.from('fixed_deposits').delete().eq('id', fd.id)
  if (error) throw new Error(error.message)
}

function expandWithRenewals(fdIds: string[], household: Household) {
  const nextOf = new Map(household.renewals.map((row) => [row.previous_fd_id, row.new_fd_id]))
  const prevOf = new Map(household.renewals.map((row) => [row.new_fd_id, row.previous_fd_id]))
  const all = new Set(fdIds)
  let grew = true
  while (grew) {
    grew = false
    for (const id of [...all]) {
      const next = nextOf.get(id)
      const prev = prevOf.get(id)
      if (next && !all.has(next)) {
        all.add(next)
        grew = true
      }
      if (prev && !all.has(prev)) {
        all.add(prev)
        grew = true
      }
    }
  }
  return [...all]
}

export function canMoveFds(household: Pick<Household, 'isAppAdmin' | 'families'>) {
  return household.isAppAdmin || household.families.length > 0
}

export async function moveFds(input: {
  household: Household
  fdIds: string[]
  targetMemberId: string
}) {
  const member = input.household.members.find((row) => row.id === input.targetMemberId)
  if (!member) throw new Error('Choose a person in the destination family.')

  const destFamily = input.household.families.find((family) => family.id === member.family_id)
  if (!destFamily && !input.household.isAppAdmin) {
    throw new Error('You cannot move FDs into that family.')
  }

  const ids = expandWithRenewals(input.fdIds, input.household)
  if (ids.length === 0) throw new Error('Choose at least one FD to move.')

  const deposits = ids.map((id) => {
    const fd = input.household.deposits.find((row) => row.id === id)
    if (!fd) throw new Error('One of those deposits could not be found.')
    return fd
  })

  const alreadyThere = deposits.every(
    (fd) => fd.family_id === member.family_id && fd.family_member_id === member.id,
  )
  if (alreadyThere) {
    throw new Error('Those FDs already belong to that person.')
  }

  if (!supabase) {
    for (const fd of deposits) {
      const updated = updateDemoFd(fd.id, {
        ...fd,
        family_id: member.family_id,
        family_member_id: member.id,
      })
      if (!updated) throw new Error('Deposit not found.')
    }
    moveDemoFdRelated(ids, member.family_id)
    return
  }

  const { error: fdError } = await supabase
    .from('fixed_deposits')
    .update({ family_id: member.family_id, family_member_id: member.id })
    .in('id', ids)
  if (fdError) throw new Error(fdError.message)

  const related = [
    supabase.from('fd_receipts').update({ family_id: member.family_id }).in('fd_id', ids),
    supabase.from('ocr_runs').update({ family_id: member.family_id }).in('fd_id', ids),
    supabase.from('fd_closures').update({ family_id: member.family_id }).in('fd_id', ids),
    supabase
      .from('fd_renewals')
      .update({ family_id: member.family_id })
      .in('previous_fd_id', ids)
      .in('new_fd_id', ids),
  ]
  for (const request of related) {
    const { error } = await request
    if (error) throw new Error(error.message)
  }
}
