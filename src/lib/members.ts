import {
  addDemoFamily,
  addDemoMember,
  deleteDemoFamily,
  deleteDemoMember,
  updateDemoFamily,
  updateDemoMember,
} from '@/lib/demo-store'
import {
  normalizeMemberInput,
  type MemberInput,
} from '@/lib/member-input'
import {
  isMissingDbObject,
  mapMemberRow,
  MEMBER_SELECT,
  MEMBER_SELECT_LEGACY,
} from '@/lib/passbooks'
import { supabase } from '@/lib/supabase'
import type { FamilyMember, Household } from '@/lib/types'

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

export function familyDeleteError(household: Household, familyId: string) {
  const people = household.members.filter((row) => row.family_id === familyId).length
  const fds = household.deposits.filter((row) => row.family_id === familyId).length
  if (people === 0 && fds === 0) return null
  const parts = [
    people > 0 ? `${people} ${people === 1 ? 'person' : 'people'}` : null,
    fds > 0 ? `${fds} ${fds === 1 ? 'FD' : 'FDs'}` : null,
  ].filter(Boolean)
  return `Cannot delete this family. It still has ${parts.join(' and ')}. Move or remove them first.`
}

export async function deleteFamily(household: Household, familyId: string) {
  const blocked = familyDeleteError(household, familyId)
  if (blocked) throw new Error(blocked)

  if (!supabase) {
    deleteDemoFamily(familyId)
    return
  }

  const { error } = await supabase.from('families').delete().eq('id', familyId)
  if (error) throw new Error(error.message)
}

export async function createMember(input: MemberInput): Promise<FamilyMember> {
  const row = normalizeMemberInput(input)
  if (!supabase) {
    return addDemoMember(row)
  }

  const { data, error } = await supabase
    .from('family_members')
    .insert(row)
    .select(MEMBER_SELECT)
    .single()
  if (error) {
    if (isMissingDbObject(error)) {
      const legacy = await supabase
        .from('family_members')
        .insert({
          family_id: row.family_id,
          full_name: row.full_name,
          display_name: row.display_name,
          bank_customer_id: row.bank_customer_id,
          notes: row.notes,
        })
        .select(MEMBER_SELECT_LEGACY)
        .single()
      if (legacy.error) throw new Error(legacy.error.message)
      return mapMemberRow(legacy.data as Record<string, unknown>)
    }
    throw new Error(error.message)
  }
  return mapMemberRow(data as Record<string, unknown>)
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
      account_number: row.account_number,
      notes: row.notes,
    })
    .eq('id', id)
    .select(MEMBER_SELECT)
    .single()
  if (error) {
    if (isMissingDbObject(error)) {
      const legacy = await supabase
        .from('family_members')
        .update({
          full_name: row.full_name,
          display_name: row.display_name,
          bank_customer_id: row.bank_customer_id,
          notes: row.notes,
        })
        .eq('id', id)
        .select(MEMBER_SELECT_LEGACY)
        .single()
      if (legacy.error) throw new Error(legacy.error.message)
      return mapMemberRow(legacy.data as Record<string, unknown>)
    }
    throw new Error(error.message)
  }
  return mapMemberRow(data as Record<string, unknown>)
}

export function memberDeleteError(household: Household, memberId: string) {
  const fds = household.deposits.filter((row) => row.family_member_id === memberId).length
  if (fds === 0) return null
  return `Cannot delete this person. They still have ${fds} ${fds === 1 ? 'FD' : 'FDs'}. Move or remove those first.`
}

export async function deleteMember(household: Household, memberId: string) {
  const blocked = memberDeleteError(household, memberId)
  if (blocked) throw new Error(blocked)

  if (!supabase) {
    deleteDemoMember(memberId)
    return
  }

  const { error } = await supabase.from('family_members').delete().eq('id', memberId)
  if (error) throw new Error(error.message)
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
