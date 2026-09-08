import type { FdReceipt } from '@/lib/types'

export const RECEIPT_SELECT =
  'id, family_id, fd_id, storage_path, file_name, mime_type, file_size, uploaded_by, is_current, created_at'

export function mapFdReceipt(row: Record<string, unknown>): FdReceipt {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    fd_id: String(row.fd_id),
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    mime_type: String(row.mime_type),
    file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    uploaded_by: (row.uploaded_by as string | null) ?? null,
    is_current: Boolean(row.is_current),
    created_at: String(row.created_at),
    preview_url: (row.preview_url as string | null | undefined) ?? null,
  }
}

export function currentReceipt(receipts: FdReceipt[], fdId: string) {
  return receipts.find((row) => row.fd_id === fdId && row.is_current) ?? null
}
