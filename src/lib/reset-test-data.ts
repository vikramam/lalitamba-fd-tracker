import { resetDemoStore } from '@/lib/demo-store'
import { supabase } from '@/lib/supabase'
import type { Household } from '@/lib/types'

export function canResetTestData(household: Household) {
  return household.isAppAdmin || household.families.some((family) => family.role === 'family_admin')
}

async function listStoragePaths(prefix: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase.storage.from('fd-receipts').list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw new Error(error.message)

  const paths: string[] = []
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    if (!item.id) {
      paths.push(...(await listStoragePaths(path)))
    } else {
      paths.push(path)
    }
  }
  return paths
}

async function removeStoragePaths(paths: string[]) {
  if (!supabase || paths.length === 0) return
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    const { error } = await supabase.storage.from('fd-receipts').remove(chunk)
    if (error) throw new Error(error.message)
  }
}

async function deleteAll(table: string) {
  if (!supabase) return
  const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(error.message)
}

export async function resetTestData(household: Household) {
  if (!canResetTestData(household)) {
    throw new Error('Only a family admin can clear test data.')
  }

  if (!supabase) {
    resetDemoStore()
    return
  }

  const prefixes = household.isAppAdmin
    ? ['']
    : household.families.map((family) => family.id)

  const paths = new Set<string>()
  for (const prefix of prefixes) {
    for (const path of await listStoragePaths(prefix)) {
      paths.add(path)
    }
  }

  const { data: receipts, error: receiptError } = await supabase
    .from('fd_receipts')
    .select('storage_path')
  if (receiptError) throw new Error(receiptError.message)
  const { data: runs, error: runError } = await supabase
    .from('ocr_runs')
    .select('storage_path')
  if (runError) throw new Error(runError.message)

  for (const row of [...(receipts ?? []), ...(runs ?? [])]) {
    if (row.storage_path) paths.add(row.storage_path)
  }

  await removeStoragePaths([...paths])

  await deleteAll('ocr_field_reviews')
  await deleteAll('ocr_runs')
  await deleteAll('fd_receipts')
  await deleteAll('fd_renewals')
  await deleteAll('fd_closures')
  await deleteAll('fixed_deposits')
}
