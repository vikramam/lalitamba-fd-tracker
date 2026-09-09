import { demoDeposits, demoFamilies, demoMembers } from '@/lib/demo-data'
import { DEMO_IDS } from '@/lib/ids'
import type {
  Family,
  FamilyMember,
  FamilyRole,
  FdClosure,
  FdReceipt,
  FdRenewal,
  FixedDeposit,
  OcrFieldReview,
} from '@/lib/types'

const FAMILY_KEY = 'lalitamba.demo.families'
const DELETED_FAMILY_KEY = 'lalitamba.demo.deletedFamilies'
const MEMBER_KEY = 'lalitamba.demo.members'
const DELETED_MEMBER_KEY = 'lalitamba.demo.deletedMembers'
const FD_KEY = 'lalitamba.demo.fds'
const DELETED_FD_KEY = 'lalitamba.demo.deletedFds'
const RECEIPT_KEY = 'lalitamba.demo.receipts'
const REVIEW_KEY = 'lalitamba.demo.ocrReviews'
const RENEWAL_KEY = 'lalitamba.demo.renewals'
const CLOSURE_KEY = 'lalitamba.demo.closures'

export type DemoFamilyExtra = Family & { created_by: string }
export type DemoMemberExtra = FamilyMember

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

function writeJson<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function readDemoFamilies(): DemoFamilyExtra[] {
  return readJson<DemoFamilyExtra>(FAMILY_KEY)
}

export function readDemoMembers(): DemoMemberExtra[] {
  return readJson<DemoMemberExtra>(MEMBER_KEY)
}

export function addDemoFamily(name: string, userId: string): DemoFamilyExtra {
  const family: DemoFamilyExtra = {
    id: crypto.randomUUID(),
    name: name.trim(),
    created_by: userId,
  }
  writeJson(FAMILY_KEY, [...readDemoFamilies(), family])
  return family
}

export function readDeletedDemoFamilyIds(): string[] {
  return readJson<string>(DELETED_FAMILY_KEY)
}

export function deleteDemoFamily(id: string) {
  writeJson(
    FAMILY_KEY,
    readDemoFamilies().filter((family) => family.id !== id),
  )
  const deleted = new Set(readDeletedDemoFamilyIds())
  deleted.add(id)
  writeJson(DELETED_FAMILY_KEY, [...deleted])
}

export function updateDemoFamily(id: string, name: string): Family | null {
  const extras = readDemoFamilies()
  const extraIndex = extras.findIndex((family) => family.id === id)
  const current =
    extraIndex === -1 ? demoFamilies.find((family) => family.id === id) : extras[extraIndex]
  if (!current) return null

  const next: DemoFamilyExtra = {
    id: current.id,
    name: name.trim(),
    created_by: 'created_by' in current ? String(current.created_by) : '',
  }
  if (extraIndex === -1) extras.push(next)
  else extras[extraIndex] = next
  writeJson(FAMILY_KEY, extras)
  return { id: next.id, name: next.name }
}

export function addDemoMember(
  input: Omit<FamilyMember, 'id' | 'linked_user_id'> & {
    linked_user_id?: string | null
  },
): FamilyMember {
  const member: FamilyMember = {
    id: crypto.randomUUID(),
    family_id: input.family_id,
    full_name: input.full_name.trim(),
    display_name: input.display_name?.trim() || null,
    bank_customer_id: input.bank_customer_id?.trim() || null,
    linked_user_id: input.linked_user_id ?? null,
    notes: input.notes?.trim() || null,
  }
  writeJson(MEMBER_KEY, [...readDemoMembers(), member])
  return member
}

export function readDeletedDemoMemberIds(): string[] {
  return readJson<string>(DELETED_MEMBER_KEY)
}

export function deleteDemoMember(id: string) {
  writeJson(
    MEMBER_KEY,
    readDemoMembers().filter((member) => member.id !== id),
  )
  const deleted = new Set(readDeletedDemoMemberIds())
  deleted.add(id)
  writeJson(DELETED_MEMBER_KEY, [...deleted])
}

export function updateDemoMember(
  id: string,
  input: Pick<FamilyMember, 'full_name' | 'display_name' | 'bank_customer_id' | 'notes'>,
): FamilyMember | null {
  const extras = readDemoMembers()
  const extraIndex = extras.findIndex((member) => member.id === id)
  const current =
    extraIndex === -1
      ? demoMembers.find((member) => member.id === id)
      : extras[extraIndex]
  if (!current) return null

  const next: FamilyMember = {
    ...current,
    full_name: input.full_name.trim(),
    display_name: input.display_name?.trim() || null,
    bank_customer_id: input.bank_customer_id?.trim() || null,
    notes: input.notes?.trim() || null,
  }
  if (extraIndex === -1) extras.push(next)
  else extras[extraIndex] = next
  writeJson(MEMBER_KEY, extras)
  return next
}

export function readDemoDeposits(): FixedDeposit[] {
  return readJson<FixedDeposit>(FD_KEY)
}

export function addDemoFd(input: Omit<FixedDeposit, 'id'>): FixedDeposit {
  const row: FixedDeposit = { ...input, id: crypto.randomUUID() }
  writeJson(FD_KEY, [...readDemoDeposits(), row])
  return row
}

export function readDeletedDemoFdIds(): string[] {
  return readJson<string>(DELETED_FD_KEY)
}

export function deleteDemoFd(id: string) {
  writeJson(
    FD_KEY,
    readDemoDeposits().filter((row) => row.id !== id),
  )
  writeJson(
    RECEIPT_KEY,
    readDemoReceipts().filter((row) => row.fd_id !== id),
  )
  writeJson(
    CLOSURE_KEY,
    readDemoClosures().filter((row) => row.fd_id !== id),
  )
  writeJson(
    RENEWAL_KEY,
    readDemoRenewals().filter((row) => row.previous_fd_id !== id && row.new_fd_id !== id),
  )
  writeJson(
    REVIEW_KEY,
    readDemoReviews().filter((row) => row.fd_id !== id),
  )
  const deleted = new Set(readDeletedDemoFdIds())
  deleted.add(id)
  writeJson(DELETED_FD_KEY, [...deleted])
}

export function updateDemoFd(id: string, input: Omit<FixedDeposit, 'id'>): FixedDeposit | null {
  const extras = readDemoDeposits()
  const extraIndex = extras.findIndex((row) => row.id === id)
  const current =
    extraIndex === -1 ? demoDeposits.find((row) => row.id === id) : extras[extraIndex]
  if (!current) return null
  const next: FixedDeposit = { ...current, ...input, id }
  if (extraIndex === -1) extras.push(next)
  else extras[extraIndex] = next
  writeJson(FD_KEY, extras)
  return next
}

export function readDemoReceipts(): FdReceipt[] {
  return readJson<FdReceipt>(RECEIPT_KEY)
}

export function replaceDemoReceipt(input: {
  family_id: string
  fd_id: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number | null
  uploaded_by: string | null
  preview_url?: string | null
}): FdReceipt {
  const rows = readDemoReceipts().map((row) =>
    row.fd_id === input.fd_id ? { ...row, is_current: false } : row,
  )
  const receipt: FdReceipt = {
    id: crypto.randomUUID(),
    family_id: input.family_id,
    fd_id: input.fd_id,
    storage_path: input.storage_path,
    file_name: input.file_name,
    mime_type: input.mime_type,
    file_size: input.file_size,
    uploaded_by: input.uploaded_by,
    is_current: true,
    created_at: new Date().toISOString(),
    preview_url: input.preview_url ?? null,
  }
  rows.push(receipt)
  writeJson(RECEIPT_KEY, rows)
  return receipt
}

export function readDemoReviews(): OcrFieldReview[] {
  return readJson<OcrFieldReview>(REVIEW_KEY)
}

export function addDemoReviews(rows: Array<Omit<OcrFieldReview, 'id'>>): OcrFieldReview[] {
  const current = readDemoReviews().filter(
    (row) => !rows.some((next) => next.ocr_run_id === row.ocr_run_id && next.field_name === row.field_name),
  )
  const created = rows.map((row) => ({ ...row, id: crypto.randomUUID() }))
  writeJson(REVIEW_KEY, [...current, ...created])
  return created
}

export function readDemoRenewals(): FdRenewal[] {
  return readJson<FdRenewal>(RENEWAL_KEY)
}

export function addDemoRenewal(input: Omit<FdRenewal, 'id'>): FdRenewal {
  if (readDemoRenewals().some((row) => row.previous_fd_id === input.previous_fd_id)) {
    throw new Error('This deposit is already renewed.')
  }
  const row: FdRenewal = { ...input, id: crypto.randomUUID() }
  writeJson(RENEWAL_KEY, [...readDemoRenewals(), row])
  return row
}

export function readDemoClosures(): FdClosure[] {
  return readJson<FdClosure>(CLOSURE_KEY)
}

export function addDemoClosure(input: Omit<FdClosure, 'id'>): FdClosure {
  if (readDemoClosures().some((row) => row.fd_id === input.fd_id)) {
    throw new Error('This deposit is already closed.')
  }
  const row: FdClosure = { ...input, id: crypto.randomUUID() }
  writeJson(CLOSURE_KEY, [...readDemoClosures(), row])
  return row
}

export function resetDemoStore() {
  localStorage.removeItem(FAMILY_KEY)
  localStorage.removeItem(DELETED_FAMILY_KEY)
  localStorage.removeItem(MEMBER_KEY)
  localStorage.removeItem(DELETED_MEMBER_KEY)
  localStorage.removeItem(FD_KEY)
  localStorage.removeItem(DELETED_FD_KEY)
  localStorage.removeItem(RECEIPT_KEY)
  localStorage.removeItem(REVIEW_KEY)
  localStorage.removeItem(RENEWAL_KEY)
  localStorage.removeItem(CLOSURE_KEY)
  localStorage.removeItem('lalitamba.demo.accounts')
}

export function demoRoleFor(
  userId: string,
  familyId: string,
): FamilyRole | 'app_admin' | null {
  if (userId === DEMO_IDS.admin) return 'app_admin'
  if (userId === DEMO_IDS.vikram && familyId === DEMO_IDS.mulgundFamily) {
    return 'family_admin'
  }
  if (userId === DEMO_IDS.other && familyId === DEMO_IDS.otherFamily) {
    return 'family_admin'
  }
  const created = readDemoFamilies().find(
    (family) => family.id === familyId && family.created_by === userId,
  )
  return created ? 'family_admin' : null
}
