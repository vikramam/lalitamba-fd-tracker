import {
  addDemoAccount,
  approvalMessage,
  deleteDemoAccount,
  findDemoAccount,
  listDemoAccounts,
  updateDemoAccount,
} from '@/lib/demo-accounts'
import { supabase } from '@/lib/supabase'
import type { AccountApproval, ManagedAccount } from '@/lib/types'

export { approvalMessage }

function requireDemoAdmin(actorEmail: string) {
  const actor = findDemoAccount(actorEmail)
  if (!actor?.is_app_admin || actor.approval_status !== 'approved') {
    throw new Error("You don't have access")
  }
  return actor
}

function requireDemoSuperAdmin(actorEmail: string) {
  const actor = requireDemoAdmin(actorEmail)
  if (!actor.is_super_admin) {
    throw new Error('Only a super admin can change admin access.')
  }
  return actor
}

function guardTarget(actorId: string, target: ManagedAccount, action: 'approval' | 'admin' | 'delete') {
  if (target.id === actorId) {
    throw new Error(
      action === 'delete' ? 'Cannot delete your own account.' : 'Cannot change your own account.',
    )
  }
  if (target.is_super_admin) {
    throw new Error(
      action === 'delete' ? 'Cannot delete a super admin' : 'Cannot change a super admin account',
    )
  }
}

export async function listManagedAccounts(actorEmail: string): Promise<ManagedAccount[]> {
  if (!supabase) {
    requireDemoAdmin(actorEmail)
    return listDemoAccounts()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, approval_status, is_app_admin, is_super_admin')
    .order('email')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email ?? ''),
    full_name: (row.full_name as string | null) ?? null,
    approval_status: (row.approval_status as AccountApproval) ?? 'pending',
    is_app_admin: Boolean(row.is_app_admin),
    is_super_admin: Boolean(row.is_super_admin),
  }))
}

export async function setAccountApproval(
  actorEmail: string,
  userId: string,
  status: AccountApproval,
) {
  if (!supabase) {
    const actor = requireDemoAdmin(actorEmail)
    const target = listDemoAccounts().find((row) => row.id === userId)
    if (!target) throw new Error('Account not found.')
    guardTarget(actor.id, target, 'approval')
    updateDemoAccount(userId, { approval_status: status })
    return
  }

  const { error } = await supabase.rpc('set_account_approval', {
    p_user_id: userId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

export async function setAccountAdmin(actorEmail: string, userId: string, isAdmin: boolean) {
  if (!supabase) {
    const actor = requireDemoSuperAdmin(actorEmail)
    const target = listDemoAccounts().find((row) => row.id === userId)
    if (!target) throw new Error('Account not found.')
    guardTarget(actor.id, target, 'admin')
    updateDemoAccount(userId, {
      is_app_admin: isAdmin,
      approval_status: isAdmin ? 'approved' : target.approval_status,
    })
    return
  }

  const { error } = await supabase.rpc('set_app_admin', {
    p_user_id: userId,
    p_is_admin: isAdmin,
  })
  if (error) throw new Error(error.message)
}

export async function deleteManagedAccount(actorEmail: string, userId: string) {
  if (!supabase) {
    const actor = requireDemoAdmin(actorEmail)
    const target = listDemoAccounts().find((row) => row.id === userId)
    if (!target) throw new Error('Account not found.')
    guardTarget(actor.id, target, 'delete')
    deleteDemoAccount(userId)
    return
  }

  const { error } = await supabase.rpc('delete_account', { p_user_id: userId })
  if (error) throw new Error(deleteAccountMessage(error.message))
}

function deleteAccountMessage(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('pgrst202') || (lower.includes('delete_account') && lower.includes('schema cache'))) {
    return 'Run supabase/migrations/0008_delete_account.sql in the Supabase SQL editor, then try again.'
  }
  if (lower.includes('foreign key') || lower.includes('violates')) {
    return 'Could not delete that account because other records still point to it. Run supabase/migrations/0008_delete_account.sql, then try again.'
  }
  if (lower.includes('permission denied') || lower.includes('auth.users')) {
    return 'The login could not be removed automatically. Delete that user in Supabase Authentication, or run supabase/migrations/0008_delete_account.sql.'
  }
  return message
}

export function registerDemoSignup(email: string) {
  return addDemoAccount(email)
}

export async function readOwnApproval(userId: string, email: string) {
  if (!supabase) {
    return findDemoAccount(email)?.approval_status ?? null
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('approval_status')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.approval_status as AccountApproval | undefined) ?? null
}
