import { addDemoClosure, addDemoRenewal, updateDemoFd } from '@/lib/demo-store'
import { createFd } from '@/lib/fds'
import type { FdDraft } from '@/lib/fd-input'
import { formatInr } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import type { FamilyMember, FdClosure, FdRenewal, FixedDeposit } from '@/lib/types'

export function canLifecycle(fd: Pick<FixedDeposit, 'status'>): boolean {
  return fd.status === 'active' || fd.status === 'matured'
}

export function suggestedCarry(fd: Pick<FixedDeposit, 'interest_mode' | 'maturity_value' | 'principal_amount'>) {
  if (fd.interest_mode === 'on_maturity' && fd.maturity_value !== null) {
    return fd.maturity_value
  }
  return fd.principal_amount
}

export function carryMessage(carry: number, newPrincipal: number): string {
  const delta = newPrincipal - carry
  if (Math.abs(delta) <= 1) return 'Rolled over in full.'
  if (delta > 0) return `${formatInr(delta)} added.`
  return `${formatInr(Math.abs(delta))} taken out.`
}

export function isPrematureClose(
  fd: Pick<FixedDeposit, 'maturity_date' | 'status'>,
  closedOn: string,
): boolean {
  if (fd.maturity_date) return closedOn < fd.maturity_date
  return fd.status === 'active'
}

export function suggestedCloseAmount(
  fd: Pick<FixedDeposit, 'interest_mode' | 'maturity_value' | 'principal_amount' | 'maturity_date' | 'status'>,
  closedOn: string,
): number {
  if (isPrematureClose(fd, closedOn)) return fd.principal_amount
  if (fd.interest_mode === 'on_maturity' && fd.maturity_value !== null) {
    return fd.maturity_value
  }
  return fd.principal_amount
}

export function closeAmountNote(
  fd: Pick<FixedDeposit, 'interest_mode' | 'maturity_value' | 'principal_amount' | 'maturity_date' | 'status'>,
  closedOn: string,
  received: number,
): string | null {
  const expected = suggestedCloseAmount(fd, closedOn)
  const delta = received - expected
  if (Math.abs(delta) <= 1) return null
  if (isPrematureClose(fd, closedOn)) {
    return delta < 0
      ? `${formatInr(Math.abs(delta))} less than principal. Common on a premature payout.`
      : `${formatInr(delta)} more than principal.`
  }
  const label = fd.interest_mode === 'on_maturity' ? 'maturity value' : 'principal'
  return delta < 0
    ? `${formatInr(Math.abs(delta))} less than ${label}.`
    : `${formatInr(delta)} more than ${label}.`
}

export async function closeFd(input: {
  fd: FixedDeposit
  closedOn: string
  amountReceived: number | null
  notes?: string | null
  existing?: FdClosure | null
}): Promise<FdClosure> {
  if (input.fd.status === 'closed' || input.existing) {
    throw new Error('This deposit is already closed.')
  }
  if (input.fd.status === 'renewed') {
    throw new Error('A renewed FD cannot be closed.')
  }
  if (!canLifecycle(input.fd)) {
    throw new Error('Only an active or matured FD can be closed.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.closedOn)) {
    throw new Error('Enter a close date.')
  }
  if (input.amountReceived !== null && input.amountReceived < 0) {
    throw new Error('Amount received cannot be negative.')
  }

  const row: Omit<FdClosure, 'id'> = {
    family_id: input.fd.family_id,
    fd_id: input.fd.id,
    closed_on: input.closedOn,
    amount_received: input.amountReceived,
    is_premature: isPrematureClose(input.fd, input.closedOn),
    notes: input.notes?.trim() || null,
  }

  if (!supabase) {
    const closed = addDemoClosure(row)
    const updated = updateDemoFd(input.fd.id, { ...input.fd, status: 'closed' })
    if (!updated) throw new Error('Deposit not found.')
    return closed
  }

  const { data, error } = await supabase
    .from('fd_closures')
    .insert(row)
    .select('id, family_id, fd_id, closed_on, amount_received, is_premature, notes')
    .single()
  if (error) throw new Error(error.message)

  const { error: statusError } = await supabase
    .from('fixed_deposits')
    .update({ status: 'closed' })
    .eq('id', input.fd.id)
  if (statusError) throw new Error(statusError.message)

  return data as FdClosure
}

export async function renewFd(input: {
  previous: FixedDeposit
  draft: FdDraft
  members: FamilyMember[]
  existing?: FdRenewal | null
  notes?: string | null
}): Promise<{ next: FixedDeposit; renewal: FdRenewal }> {
  if (input.previous.status === 'renewed' || input.existing) {
    throw new Error('This deposit is already renewed.')
  }
  if (input.previous.status === 'closed') {
    throw new Error('A closed FD cannot be renewed.')
  }
  if (!canLifecycle(input.previous)) {
    throw new Error('Only an active or matured FD can be renewed.')
  }

  const next = await createFd(input.draft, input.members)
  const carry = suggestedCarry(input.previous)
  const renewedOn = next.fd_date ?? new Date().toISOString().slice(0, 10)
  const renewalRow: Omit<FdRenewal, 'id'> = {
    family_id: input.previous.family_id,
    previous_fd_id: input.previous.id,
    new_fd_id: next.id,
    renewed_on: renewedOn,
    suggested_carry: carry,
    new_principal: next.principal_amount,
    notes: input.notes?.trim() || null,
  }

  if (!supabase) {
    updateDemoFd(input.previous.id, { ...input.previous, status: 'renewed' })
    return { next, renewal: addDemoRenewal(renewalRow) }
  }

  const { data, error } = await supabase
    .from('fd_renewals')
    .insert(renewalRow)
    .select(
      'id, family_id, previous_fd_id, new_fd_id, renewed_on, suggested_carry, new_principal, notes',
    )
    .single()
  if (error) throw new Error(error.message)

  const { error: statusError } = await supabase
    .from('fixed_deposits')
    .update({ status: 'renewed' })
    .eq('id', input.previous.id)
  if (statusError) throw new Error(statusError.message)

  return { next, renewal: data as FdRenewal }
}

export function renewalChain(
  fdId: string,
  deposits: FixedDeposit[],
  renewals: FdRenewal[],
): FixedDeposit[] {
  const byId = new Map(deposits.map((fd) => [fd.id, fd]))
  const nextOf = new Map(renewals.map((row) => [row.previous_fd_id, row.new_fd_id]))
  const prevOf = new Map(renewals.map((row) => [row.new_fd_id, row.previous_fd_id]))

  let start = fdId
  const seen = new Set<string>()
  while (prevOf.has(start) && !seen.has(start)) {
    seen.add(start)
    start = prevOf.get(start)!
  }

  const chain: FixedDeposit[] = []
  let current: string | undefined = start
  const walked = new Set<string>()
  while (current && !walked.has(current)) {
    walked.add(current)
    const fd = byId.get(current)
    if (fd) chain.push(fd)
    current = nextOf.get(current)
  }
  return chain
}

export function findRenewalFor(
  fdId: string,
  renewals: FdRenewal[],
): { asPrevious?: FdRenewal; asNext?: FdRenewal } {
  return {
    asPrevious: renewals.find((row) => row.previous_fd_id === fdId),
    asNext: renewals.find((row) => row.new_fd_id === fdId),
  }
}
