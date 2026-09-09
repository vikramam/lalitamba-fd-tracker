import {
  demoDeposits,
  demoFamilies,
  demoMembers,
  demoMemberships,
} from '@/lib/demo-data'
import {
  readDeletedDemoFamilyIds,
  readDeletedDemoFdIds,
  readDeletedDemoMemberIds,
  readDemoClosures,
  readDemoDeposits,
  readDemoFamilies,
  readDemoMembers,
  readDemoReceipts,
  readDemoRenewals,
  readDemoReviews,
} from '@/lib/demo-store'
import { mapFixedDeposit, FD_SELECT } from '@/lib/fd-map'
import { findDemoAccount } from '@/lib/demo-accounts'
import { demoUserFromEmail } from '@/lib/ids'
import { RECEIPT_SELECT, mapFdReceipt } from '@/lib/receipt-map'
import { supabase } from '@/lib/supabase'
import type {
  Family,
  FamilyMember,
  FamilyRole,
  FdClosure,
  FdReceipt,
  FdRenewal,
  FixedDeposit,
  Household,
  OcrFieldReview,
} from '@/lib/types'

function householdFromRows(
  isAppAdmin: boolean,
  families: Array<Family & { role: FamilyRole | 'app_admin' }>,
  members: FamilyMember[],
  deposits: FixedDeposit[],
  receipts: FdReceipt[],
  renewals: FdRenewal[],
  closures: FdClosure[],
  ocrReviews: OcrFieldReview[],
  isSuperAdmin = false,
): Household {
  return {
    isAppAdmin,
    isSuperAdmin,
    families,
    members,
    deposits,
    receipts,
    renewals,
    closures,
    ocrReviews,
  }
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const rows = new Map(base.map((row) => [row.id, row]))
  for (const row of extra) rows.set(row.id, row)
  return [...rows.values()]
}

export function demoHousehold(email: string): Household {
  const account = findDemoAccount(email)
  const demo = account
    ? {
        id: account.id,
        email: account.email,
        isAppAdmin: account.is_app_admin && account.approval_status === 'approved',
        isSuperAdmin: account.is_super_admin && account.approval_status === 'approved',
      }
    : demoUserFromEmail(email)
  const extraFamilies = readDemoFamilies()
  const extraMembers = readDemoMembers()
  const extraDeposits = readDemoDeposits()
  const deletedFds = new Set(readDeletedDemoFdIds())
  const allReceipts = readDemoReceipts().filter((row) => !deletedFds.has(row.fd_id))
  const allRenewals = readDemoRenewals().filter(
    (row) => !deletedFds.has(row.previous_fd_id) && !deletedFds.has(row.new_fd_id),
  )
  const allClosures = readDemoClosures().filter((row) => !deletedFds.has(row.fd_id))
  const allReviews = readDemoReviews().filter((row) => !deletedFds.has(row.fd_id))
  const deletedFamilies = new Set(readDeletedDemoFamilyIds())
  const allFamilies = mergeById(demoFamilies, extraFamilies).filter(
    (family) => !deletedFamilies.has(family.id),
  )
  const deletedMembers = new Set(readDeletedDemoMemberIds())
  const allMembers = mergeById(demoMembers, extraMembers).filter(
    (member) => !deletedMembers.has(member.id),
  )
  const allDeposits = mergeById(demoDeposits, extraDeposits).filter(
    (fd) => !deletedFds.has(fd.id),
  )

  if (demo.isAppAdmin) {
    return householdFromRows(
      true,
      allFamilies.map((family) => ({ ...family, role: 'app_admin' })),
      allMembers,
      allDeposits,
      allReceipts,
      allRenewals,
      allClosures,
      allReviews,
      demo.isSuperAdmin ?? false,
    )
  }

  const memberships = demoMemberships.filter((row) => row.user_id === demo.id)
  const created = extraFamilies.filter((family) => family.created_by === demo.id)
  const familyIds = new Set([
    ...memberships.map((row) => row.family_id),
    ...created.map((family) => family.id),
  ])
  const families = allFamilies
    .filter((family) => familyIds.has(family.id))
    .map((family) => ({
      ...family,
      role:
        memberships.find((row) => row.family_id === family.id)?.role ??
        'family_admin',
    }))
  const members = allMembers.filter((member) => familyIds.has(member.family_id))
  const deposits = allDeposits.filter((fd) => familyIds.has(fd.family_id))
  const receipts = allReceipts.filter((receipt) => familyIds.has(receipt.family_id))
  const depositIds = new Set(deposits.map((fd) => fd.id))
  const renewals = allRenewals.filter((row) => familyIds.has(row.family_id))
  const closures = allClosures.filter((row) => familyIds.has(row.family_id))
  const ocrReviews = allReviews.filter((row) => depositIds.has(row.fd_id))
  return householdFromRows(
    false,
    families,
    members,
    deposits,
    receipts,
    renewals,
    closures,
    ocrReviews,
    false,
  )
}

export async function loadHousehold(user: {
  id: string
  email: string
}): Promise<Household> {
  if (!supabase) {
    return demoHousehold(user.email)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, is_app_admin, is_super_admin, approval_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const approved = profile?.approval_status === 'approved'
  const isAppAdmin = Boolean(profile?.is_app_admin) && approved
  const isSuperAdmin = Boolean(profile?.is_super_admin) && approved

  const { data: memberships, error: membershipError } = await supabase
    .from('family_memberships')
    .select('family_id, role, families ( id, name )')

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const families = (memberships ?? []).flatMap((row) => {
    const family = Array.isArray(row.families) ? row.families[0] : row.families
    if (!family) return []
    return [
      {
        id: family.id as string,
        name: family.name as string,
        role: isAppAdmin ? ('app_admin' as const) : (row.role as FamilyRole),
      },
    ]
  })

  if (isAppAdmin) {
    const { data: allFamilies, error } = await supabase
      .from('families')
      .select('id, name')
    if (error) throw new Error(error.message)
    const known = new Set(families.map((family) => family.id))
    for (const family of allFamilies ?? []) {
      if (!known.has(family.id)) {
        families.push({ ...family, role: 'app_admin' })
      }
    }
  }

  const { data: members, error: memberError } = await supabase
    .from('family_members')
    .select(
      'id, family_id, full_name, display_name, linked_user_id, bank_customer_id, notes',
    )
  if (memberError) throw new Error(memberError.message)

  const { data: deposits, error: fdError } = await supabase
    .from('fixed_deposits')
    .select(FD_SELECT)
  if (fdError) throw new Error(fdError.message)

  const { data: receipts, error: receiptError } = await supabase
    .from('fd_receipts')
    .select(RECEIPT_SELECT)
  if (receiptError) throw new Error(receiptError.message)

  const { data: renewals, error: renewalError } = await supabase
    .from('fd_renewals')
    .select(
      'id, family_id, previous_fd_id, new_fd_id, renewed_on, suggested_carry, new_principal, notes',
    )
  if (renewalError) throw new Error(renewalError.message)

  const { data: closures, error: closureError } = await supabase
    .from('fd_closures')
    .select('id, family_id, fd_id, closed_on, amount_received, is_premature, notes')
  if (closureError) throw new Error(closureError.message)

  const { data: ocrReviews, error: reviewError } = await supabase
    .from('ocr_field_reviews')
    .select(
      'id, ocr_run_id, fd_id, field_name, extracted_value, confirmed_value, was_modified, confidence',
    )
  if (reviewError) throw new Error(reviewError.message)

  return householdFromRows(
    isAppAdmin,
    families,
    (members ?? []) as FamilyMember[],
    (deposits ?? []).map((row) => mapFixedDeposit(row as Record<string, unknown>)),
    (receipts ?? []).map((row) => mapFdReceipt(row as Record<string, unknown>)),
    ((renewals ?? []) as FdRenewal[]).map((row) => ({
      ...row,
      suggested_carry:
        row.suggested_carry === null || row.suggested_carry === undefined
          ? null
          : Number(row.suggested_carry),
      new_principal:
        row.new_principal === null || row.new_principal === undefined
          ? null
          : Number(row.new_principal),
    })),
    (closures ?? []).map((row) => ({
      ...row,
      amount_received:
        row.amount_received === null || row.amount_received === undefined
          ? null
          : Number(row.amount_received),
    })) as FdClosure[],
    (ocrReviews ?? []).map((row) => ({
      ...row,
      confidence:
        row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    })) as OcrFieldReview[],
    isSuperAdmin,
  )
}
