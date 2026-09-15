import { todayIso } from '@/lib/dashboard'
import {
  addDemoPassbook,
  addDemoPassbookTx,
  allDemoPassbookTransactions,
  deleteDemoPassbookTx,
  replaceDemoPassbookBalances,
  updateDemoMember,
} from '@/lib/demo-store'
import { formatDate } from '@/lib/format'
import { nextPublicId, publicIdPrefix } from '@/lib/passbook-id'
import {
  currentBalance,
  roundMoney,
  sortLedger,
  withRunningBalances,
  wouldGoNegative,
} from '@/lib/passbook-ledger'
import {
  interestPayoutOf,
  msAccountsForMember,
  subsequentInterestDates,
} from '@/lib/passbook-interest'
import { supabase } from '@/lib/supabase'
import type {
  FamilyMember,
  Household,
  MemberPassbook,
  PassbookSource,
  PassbookTransaction,
  PassbookTxnType,
} from '@/lib/types'
import { buildXlsx, downloadXlsx } from '@/lib/xlsx'

export const PASSBOOK_SETUP_MESSAGE =
  'Run supabase/migrations/0011_passbook.sql in the SQL editor, then try again.'

export const MEMBER_SELECT =
  'id, family_id, full_name, display_name, linked_user_id, bank_customer_id, account_number, notes'
export const MEMBER_SELECT_LEGACY =
  'id, family_id, full_name, display_name, linked_user_id, bank_customer_id, notes'
export const PASSBOOK_SELECT = 'id, family_id, family_member_id, created_on, created_at'
export const PASSBOOK_TX_SELECT =
  'id, family_id, passbook_id, public_id, txn_date, txn_type, amount, balance_after, reference, remarks, source_type, source_fd_id, interest_period_date, created_at'

export function isMissingDbObject(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return (
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /schema cache/i.test(message) ||
    /does not exist/i.test(message) ||
    /could not find/i.test(message)
  )
}

export function mapMemberRow(row: Record<string, unknown>): FamilyMember {
  return {
    id: row.id as string,
    family_id: row.family_id as string,
    full_name: row.full_name as string,
    display_name: (row.display_name as string | null) ?? null,
    linked_user_id: (row.linked_user_id as string | null) ?? null,
    bank_customer_id: (row.bank_customer_id as string | null) ?? null,
    account_number: (row.account_number as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }
}

export function mapPassbook(row: Record<string, unknown>): MemberPassbook {
  return {
    id: row.id as string,
    family_id: row.family_id as string,
    family_member_id: row.family_member_id as string,
    created_on: String(row.created_on).slice(0, 10),
    created_at: String(row.created_at),
  }
}

export function mapPassbookTx(row: Record<string, unknown>): PassbookTransaction {
  return {
    id: row.id as string,
    family_id: row.family_id as string,
    passbook_id: row.passbook_id as string,
    public_id: row.public_id as string,
    txn_date: String(row.txn_date).slice(0, 10),
    txn_type: row.txn_type as PassbookTxnType,
    amount: Number(row.amount),
    balance_after: Number(row.balance_after),
    reference: (row.reference as string | null) ?? null,
    remarks: (row.remarks as string | null) ?? null,
    source_type: row.source_type as PassbookSource,
    source_fd_id: (row.source_fd_id as string | null) ?? null,
    interest_period_date: row.interest_period_date
      ? String(row.interest_period_date).slice(0, 10)
      : null,
    created_at: String(row.created_at),
  }
}

function setupError(error: { code?: string; message: string }) {
  if (isMissingDbObject(error)) return new Error(PASSBOOK_SETUP_MESSAGE)
  return new Error(error.message)
}

export function passbookForMember(household: Household, memberId: string) {
  return household.passbooks.find((row) => row.family_member_id === memberId) ?? null
}

export function txsForPassbook(household: Household, passbookId: string) {
  return household.passbookTransactions.filter((row) => row.passbook_id === passbookId)
}

export function passbookBalance(household: Household, memberId: string) {
  const passbook = passbookForMember(household, memberId)
  if (!passbook) return 0
  return currentBalance(txsForPassbook(household, passbook.id))
}

export function canWritePassbook(household: Pick<Household, 'isAppAdmin' | 'families'>) {
  return household.isAppAdmin || household.families.length > 0
}

export function canDeletePassbookTx(household: Pick<Household, 'isSuperAdmin'>) {
  return household.isSuperAdmin
}

const SKIPPED_INTEREST_KEY = 'lalitamba.passbook.skippedInterest'

function readSkippedInterest() {
  try {
    const raw = localStorage.getItem(SKIPPED_INTEREST_KEY)
    if (!raw) return [] as string[]
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((row) => typeof row === 'string') : []
  } catch {
    return []
  }
}

function skipInterestPeriod(fdId: string, period: string) {
  const key = `${fdId}:${period}`
  const next = new Set(readSkippedInterest())
  next.add(key)
  try {
    localStorage.setItem(SKIPPED_INTEREST_KEY, JSON.stringify([...next]))
  } catch {
    /* ignore quota / private mode */
  }
}

export async function ensurePassbook(
  household: Household,
  member: FamilyMember,
): Promise<MemberPassbook> {
  const existing = passbookForMember(household, member.id)
  if (existing) return existing

  const createdOn = todayIso()
  if (!supabase) {
    return addDemoPassbook({
      family_id: member.family_id,
      family_member_id: member.id,
      created_on: createdOn,
    })
  }

  const { data, error } = await supabase
    .from('member_passbooks')
    .insert({
      family_id: member.family_id,
      family_member_id: member.id,
      created_on: createdOn,
    })
    .select(PASSBOOK_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: row, error: readError } = await supabase
        .from('member_passbooks')
        .select(PASSBOOK_SELECT)
        .eq('family_member_id', member.id)
        .maybeSingle()
      if (readError) throw setupError(readError)
      if (row) return mapPassbook(row as Record<string, unknown>)
    }
    throw setupError(error)
  }
  return mapPassbook(data as Record<string, unknown>)
}

async function publicIdsForDate(date: string) {
  const prefix = publicIdPrefix(date)
  if (!supabase) {
    return allDemoPassbookTransactions().map((row) => row.public_id)
  }
  const { data, error } = await supabase
    .from('passbook_transactions')
    .select('public_id')
    .like('public_id', `${prefix}%`)
  if (error) throw setupError(error)
  return (data ?? []).map((row) => String(row.public_id))
}

type TxDraft = {
  passbook: MemberPassbook
  txn_date: string
  txn_type: PassbookTxnType
  amount: number
  reference?: string | null
  remarks?: string | null
  source_type?: PassbookSource
  source_fd_id?: string | null
  interest_period_date?: string | null
  created_by?: string | null
}

function parsePostedAmount(value: number) {
  const amount = roundMoney(value)
  if (!(amount > 0)) throw new Error('Enter an amount greater than 0.')
  return amount
}

function assertDate(txnDate: string, now = new Date()) {
  const day = txnDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a transaction date.')
  if (day > todayIso(now)) throw new Error('Transaction date cannot be in the future.')
  return day
}

export async function addPassbookTransaction(
  household: Household,
  draft: TxDraft,
  now = new Date(),
): Promise<PassbookTransaction> {
  const amount = parsePostedAmount(draft.amount)
  const txnDate = assertDate(draft.txn_date, now)
  const sourceType = draft.source_type ?? 'manual'
  const existing = txsForPassbook(household, draft.passbook.id)
  const createdAt = new Date().toISOString()
  const tempId = crypto.randomUUID()
  const probe = {
    id: tempId,
    txn_date: txnDate,
    created_at: createdAt,
    txn_type: draft.txn_type,
    amount,
  }
  if (wouldGoNegative(existing, probe)) {
    throw new Error('This debit would make the passbook balance negative.')
  }

  const ids = await publicIdsForDate(txnDate)
  const publicId = nextPublicId(txnDate, ids)
  const recomputed = withRunningBalances([
    ...existing,
    {
      ...probe,
      family_id: draft.passbook.family_id,
      passbook_id: draft.passbook.id,
      public_id: publicId,
      reference: draft.reference?.trim() || null,
      remarks: draft.remarks?.trim() || null,
      source_type: sourceType,
      source_fd_id: draft.source_fd_id ?? null,
      interest_period_date: draft.interest_period_date ?? null,
    },
  ])
  const posted = recomputed.find((row) => row.id === tempId)
  if (!posted) throw new Error('Could not post that transaction.')

  const payload = {
    family_id: draft.passbook.family_id,
    passbook_id: draft.passbook.id,
    public_id: publicId,
    txn_date: txnDate,
    txn_type: draft.txn_type,
    amount,
    balance_after: posted.balance_after,
    reference: posted.reference,
    remarks: posted.remarks,
    source_type: sourceType,
    source_fd_id: posted.source_fd_id,
    interest_period_date: posted.interest_period_date,
    created_by: draft.created_by ?? null,
  }

  let saved: PassbookTransaction
  if (!supabase) {
    saved = addDemoPassbookTx({ ...payload, id: tempId, created_at: createdAt })
  } else {
    const { data, error } = await supabase
      .from('passbook_transactions')
      .insert(payload)
      .select(PASSBOOK_TX_SELECT)
      .single()
    if (error) throw setupError(error)
    saved = mapPassbookTx(data as Record<string, unknown>)
  }

  const ledger = withRunningBalances([...existing, saved])
  await persistRunningBalances(existing, ledger)
  return ledger.find((row) => row.id === saved.id) ?? saved
}

async function persistRunningBalances(
  previous: PassbookTransaction[],
  recomputed: PassbookTransaction[],
) {
  const before = new Map(previous.map((row) => [row.id, row.balance_after]))
  const changed = recomputed.filter((row) => before.get(row.id) !== row.balance_after)
  if (changed.length === 0) return

  if (!supabase) {
    replaceDemoPassbookBalances(recomputed)
    return
  }

  for (const row of changed) {
    const { error } = await supabase
      .from('passbook_transactions')
      .update({ balance_after: row.balance_after })
      .eq('id', row.id)
    if (error) throw setupError(error)
  }
}

export async function syncPassbookInterest(
  household: Household,
  passbook: MemberPassbook,
  now = new Date(),
) {
  const memberFds = household.deposits.filter(
    (fd) => fd.family_member_id === passbook.family_member_id,
  )
  const existing = txsForPassbook(household, passbook.id)
  const postedKeys = new Set([
    ...existing
      .filter((row) => row.source_type === 'fd_interest' && row.source_fd_id && row.interest_period_date)
      .map((row) => `${row.source_fd_id}:${row.interest_period_date}`),
    ...readSkippedInterest(),
  ])

  let current = { ...household, passbookTransactions: [...household.passbookTransactions] }
  let added = 0

  for (const fd of memberFds) {
    const amount = interestPayoutOf(fd)
    if (amount === null) continue
    const dues = subsequentInterestDates(
      fd,
      passbook.created_on,
      household.closures,
      household.renewals,
      now,
    )
    for (const due of dues) {
      const key = `${fd.id}:${due}`
      if (postedKeys.has(key)) continue
      const tx = await addPassbookTransaction(current, {
        passbook,
        txn_date: due,
        txn_type: 'credit',
        amount,
        reference: fd.fd_account_no,
        remarks: fd.interest_mode === 'quarterly' ? 'Quarterly interest' : 'Monthly interest',
        source_type: 'fd_interest',
        source_fd_id: fd.id,
        interest_period_date: due,
      }, now)
      postedKeys.add(key)
      current = {
        ...current,
        passbookTransactions: [...current.passbookTransactions, tx],
      }
      added += 1
    }
  }

  return { added, household: current }
}

export async function syncHouseholdPassbookInterest(
  household: Household,
  now = new Date(),
) {
  let current = household
  let added = 0

  for (const member of household.members) {
    const book = await ensurePassbook(current, member)
    current = {
      ...current,
      passbooks: current.passbooks.some((row) => row.id === book.id)
        ? current.passbooks
        : [...current.passbooks, book],
    }
    const result = await syncPassbookInterest(current, book, now)
    added += result.added
    current = result.household
  }

  return { added, household: current }
}

export async function deletePassbookTransaction(
  household: Household,
  row: PassbookTransaction,
) {
  if (!canDeletePassbookTx(household)) {
    throw new Error('Only a super admin can delete a passbook transaction.')
  }

  if (!supabase) {
    deleteDemoPassbookTx(row.id)
  } else {
    const { error } = await supabase.from('passbook_transactions').delete().eq('id', row.id)
    if (error) throw setupError(error)
  }

  if (row.source_type === 'fd_interest' && row.source_fd_id && row.interest_period_date) {
    skipInterestPeriod(row.source_fd_id, row.interest_period_date)
  }

  const remaining = txsForPassbook(household, row.passbook_id).filter((item) => item.id !== row.id)
  const ledger = withRunningBalances(remaining)
  await persistRunningBalances(remaining, ledger)
}

export type GeneratePassbooksResult = {
  created: number
  alreadyHad: number
  filledAccount: number
  ambiguous: Array<{ memberId: string; name: string; accounts: string[] }>
}

export async function generateMissingPassbooks(
  household: Household,
): Promise<GeneratePassbooksResult> {
  const ambiguous: GeneratePassbooksResult['ambiguous'] = []
  let created = 0
  let alreadyHad = 0
  let filledAccount = 0

  for (const member of household.members) {
    const existing = passbookForMember(household, member.id)
    if (existing) alreadyHad += 1
    else {
      await ensurePassbook(household, member)
      created += 1
    }

    if (member.account_number?.trim()) continue
    const accounts = msAccountsForMember(household.deposits, member.id)
    if (accounts.length > 1) {
      ambiguous.push({
        memberId: member.id,
        name: member.display_name || member.full_name,
        accounts,
      })
      continue
    }
    if (accounts.length === 1) {
      await setMemberAccountNumber(member.id, accounts[0]!, {
        full_name: member.full_name,
        display_name: member.display_name,
        bank_customer_id: member.bank_customer_id,
        notes: member.notes,
        family_id: member.family_id,
      })
      filledAccount += 1
    }
  }

  return { created, alreadyHad, filledAccount, ambiguous }
}

async function setMemberAccountNumber(
  memberId: string,
  accountNumber: string,
  current: Pick<
    FamilyMember,
    'full_name' | 'display_name' | 'bank_customer_id' | 'notes' | 'family_id'
  >,
) {
  if (!supabase) {
    updateDemoMember(memberId, {
      full_name: current.full_name,
      display_name: current.display_name,
      bank_customer_id: current.bank_customer_id,
      account_number: accountNumber,
      notes: current.notes,
    })
    return
  }
  const { error } = await supabase
    .from('family_members')
    .update({ account_number: accountNumber })
    .eq('id', memberId)
  if (error) throw setupError(error)
}

export function exportPassbookExcel(input: {
  memberName: string
  accountNumber: string | null
  rows: PassbookTransaction[]
  now?: Date
}) {
  const ordered = sortLedger(input.rows)
  const header = [
    'Transaction ID',
    'Transaction Date',
    'Transaction Type',
    'Credit',
    'Debit',
    'Balance',
    'Reference',
    'Remarks',
  ]
  const body = ordered.map((row) => [
    row.public_id,
    formatDate(row.txn_date),
    row.txn_type === 'credit' ? 'Credit' : 'Debit',
    row.txn_type === 'credit' ? row.amount : '',
    row.txn_type === 'debit' ? row.amount : '',
    row.balance_after,
    row.reference ?? '',
    row.remarks ?? '',
  ])
  const stamp = todayIso(input.now ?? new Date())
  const safeName = input.memberName.replaceAll(/[\\/:*?"<>|]+/g, ' ').trim() || 'Member'
  downloadXlsx(
    buildXlsx([
      {
        name: 'Passbook',
        rows: [
          ['Member', input.memberName],
          ['Account Number', input.accountNumber ?? ''],
          ['Exported', stamp],
          [],
          header,
          ...body,
        ],
      },
    ]),
    `Passbook-${safeName}-${stamp}.xlsx`,
  )
}

export function formatGenerateMessage(result: GeneratePassbooksResult) {
  const parts = [
    result.created === 1
      ? 'Created 1 passbook.'
      : result.created > 0
        ? `Created ${result.created} passbooks.`
        : 'No new passbooks needed.',
  ]
  if (result.alreadyHad > 0) {
    parts.push(
      result.alreadyHad === 1
        ? '1 member already had a passbook.'
        : `${result.alreadyHad} members already had a passbook.`,
    )
  }
  if (result.filledAccount > 0) {
    parts.push(
      result.filledAccount === 1
        ? 'Filled 1 account number from MS A/c.'
        : `Filled ${result.filledAccount} account numbers from MS A/c.`,
    )
  }
  if (result.ambiguous.length > 0) {
    const names = result.ambiguous.map((row) => row.name).join(', ')
    parts.push(
      `Left account number blank for ${names} because they have more than one MS A/c.`,
    )
  }
  return parts.join(' ')
}

export function formatSyncInterestMessage(added: number) {
  if (added === 0) return 'No new interest was due. Balances are up to date.'
  if (added === 1) return 'Posted 1 interest credit. Balances are updated.'
  return `Posted ${added} interest credits. Balances are updated.`
}

export function lastTxnDate(rows: PassbookTransaction[]) {
  if (rows.length === 0) return null
  return sortLedger(rows).at(-1)?.txn_date ?? null
}
