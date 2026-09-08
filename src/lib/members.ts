import { addDemoFamily, addDemoMember, updateDemoFamily, updateDemoMember } from '@/lib/demo-store'
import {
  normalizeMemberInput,
  type MemberInput,
} from '@/lib/member-input'
import { supabase } from '@/lib/supabase'
import type { FamilyMember } from '@/lib/types'

export type { MemberInput }

export async function createFamily(name: string, userId: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Family name is required.')

  if (!supabase) {
    return addDemoFamily(trimmed, userId)
  }

  const { data, error } = await supabase.rpc('create_family', { p_name: trimmed })
  if (error) {
    if (error.message.includes('create_family') || error.code === 'PGRST202') {
      throw new Error(
        'Run supabase/migrations/0006_create_family.sql in the SQL editor, then try again.',
      )
    }
    throw new Error(error.message)
  }
  return { id: data as string, name: trimmed }
}

export async function updateFamily(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Family name is required.')

  if (!supabase) {
    const updated = updateDemoFamily(id, trimmed)
    if (!updated) throw new Error('Family not found.')
    return updated
  }

  const { data, error } = await supabase
    .from('families')
    .update({ name: trimmed })
    .eq('id', id)
    .select('id, name')
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; name: string }
}

export async function createMember(input: MemberInput): Promise<FamilyMember> {
  const row = normalizeMemberInput(input)
  if (!supabase) {
    return addDemoMember(row)
  }

  const { data, error } = await supabase
    .from('family_members')
    .insert(row)
    .select(
      'id, family_id, full_name, display_name, linked_user_id, bank_customer_id, notes',
    )
    .single()
  if (error) throw new Error(error.message)
  return data as FamilyMember
}

export async function updateMember(
  id: string,
  input: MemberInput,
): Promise<FamilyMember> {
  const row = normalizeMemberInput(input)
  if (!supabase) {
    const updated = updateDemoMember(id, row)
    if (!updated) throw new Error('Member not found.')
    return updated
  }

  const { data, error } = await supabase
    .from('family_members')
    .update({
      full_name: row.full_name,
      display_name: row.display_name,
      bank_customer_id: row.bank_customer_id,
      notes: row.notes,
    })
    .eq('id', id)
    .select(
      'id, family_id, full_name, display_name, linked_user_id, bank_customer_id, notes',
    )
    .single()
  if (error) throw new Error(error.message)
  return data as FamilyMember
}

export function canManageMembers(household: {
  isAppAdmin: boolean
  families: Array<{ role: string }>
}) {
  return (
    household.isAppAdmin ||
    household.families.length === 0 ||
    household.families.some((family) => family.role === 'family_admin')
  )
}
