import type { Household } from '@/lib/types'

export const ALL_FAMILIES_SCOPE = 'all'

export function scopeHousehold(household: Household, scope: string): Household {
  if (scope === ALL_FAMILIES_SCOPE) return household
  const depositIds = new Set(
    household.deposits.filter((fd) => fd.family_id === scope).map((fd) => fd.id),
  )
  return {
    ...household,
    families: household.families.filter((family) => family.id === scope),
    members: household.members.filter((member) => member.family_id === scope),
    deposits: household.deposits.filter((fd) => fd.family_id === scope),
    receipts: household.receipts.filter((row) => row.family_id === scope),
    renewals: household.renewals.filter((row) => row.family_id === scope),
    closures: household.closures.filter((row) => row.family_id === scope),
    ocrReviews: household.ocrReviews.filter((row) => depositIds.has(row.fd_id)),
  }
}

export function defaultFamilyScope(household: Household): string {
  if (!household.isAppAdmin) return ALL_FAMILIES_SCOPE
  const home = household.membershipFamilyIds.find((id) =>
    household.families.some((family) => family.id === id),
  )
  if (home) return home
  return household.families[0]?.id ?? ALL_FAMILIES_SCOPE
}

export function resolveFamilyScope(household: Household, stored: string | null): string {
  if (stored === ALL_FAMILIES_SCOPE) return ALL_FAMILIES_SCOPE
  if (stored && household.families.some((family) => family.id === stored)) return stored
  return defaultFamilyScope(household)
}

function storageKey(userId: string) {
  return `lalitamba.familyScope.${userId}`
}

export function readStoredFamilyScope(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

export function writeStoredFamilyScope(userId: string, scope: string) {
  try {
    localStorage.setItem(storageKey(userId), scope)
  } catch {
    /* ignore quota / private mode */
  }
}
