import { replaceDemoReceipt } from '@/lib/demo-store'
import { RECEIPT_SELECT, currentReceipt, mapFdReceipt } from '@/lib/receipt-map'
import { receiptStoragePath, sanitizeReceiptFileName } from '@/lib/receipt-path'
import { supabase } from '@/lib/supabase'
import type { FdReceipt, FixedDeposit, Household } from '@/lib/types'

export { currentReceipt }

function canSeeReceipt(household: Household, familyId: string) {
  return household.isAppAdmin || household.families.some((family) => family.id === familyId)
}

export async function saveFdReceipt(input: {
  fd: FixedDeposit
  file: File
  userId: string
}): Promise<FdReceipt> {
  const fileName = sanitizeReceiptFileName(input.file.name, input.file.type)
  const storagePath = receiptStoragePath({
    familyId: input.fd.family_id,
    userId: input.userId,
    fdId: input.fd.id,
    fileName,
  })

  if (!supabase) {
    const previewUrl = input.file.type.startsWith('image/')
      ? await fileToDataUrl(input.file)
      : null
    return replaceDemoReceipt({
      family_id: input.fd.family_id,
      fd_id: input.fd.id,
      storage_path: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size: input.file.size,
      uploaded_by: input.userId,
      preview_url: previewUrl,
    })
  }

  const upload = await supabase.storage.from('fd-receipts').upload(storagePath, input.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: input.file.type,
  })
  if (upload.error) {
    if (upload.error.message.toLowerCase().includes('bucket')) {
      throw new Error('Receipt storage is not set up. Run supabase/migrations/0004_storage.sql.')
    }
    throw new Error(upload.error.message)
  }

  const cleared = await supabase
    .from('fd_receipts')
    .update({ is_current: false })
    .eq('fd_id', input.fd.id)
    .eq('is_current', true)
  if (cleared.error) throw new Error(cleared.error.message)

  const { data, error } = await supabase
    .from('fd_receipts')
    .insert({
      family_id: input.fd.family_id,
      fd_id: input.fd.id,
      storage_path: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size: input.file.size,
      uploaded_by: input.userId,
      is_current: true,
    })
    .select(RECEIPT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapFdReceipt(data as Record<string, unknown>)
}

export async function receiptViewUrl(
  receipt: FdReceipt,
  household: Household,
): Promise<string> {
  if (!canSeeReceipt(household, receipt.family_id)) {
    throw new Error("You don't have access")
  }
  if (receipt.preview_url) return receipt.preview_url
  if (!supabase) {
    throw new Error('Receipt preview is not available.')
  }

  const { data, error } = await supabase.storage
    .from('fd-receipts')
    .createSignedUrl(receipt.storage_path, 600)
  if (error || !data?.signedUrl) {
    throw new Error("You don't have access")
  }
  return data.signedUrl
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'fd-receipt'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function receiptBlob(receipt: FdReceipt, household: Household) {
  const url = await receiptViewUrl(receipt, household)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Could not load that receipt.')
  }
  return { blob: await response.blob(), url }
}

export async function downloadFdReceipt(
  receipt: FdReceipt,
  household: Household,
): Promise<void> {
  const { blob } = await receiptBlob(receipt, household)
  triggerBrowserDownload(blob, receipt.file_name)
}

export async function shareFdReceipt(
  receipt: FdReceipt,
  household: Household,
): Promise<'shared' | 'downloaded'> {
  const { blob, url } = await receiptBlob(receipt, household)
  const type = blob.type || receipt.mime_type || 'application/octet-stream'
  const file = new File([blob], receipt.file_name || 'fd-receipt', { type })
  const title = receipt.file_name || 'FD receipt'

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title })
    return 'shared'
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, url })
    return 'shared'
  }
  triggerBrowserDownload(blob, receipt.file_name)
  return 'downloaded'
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that photo.'))
    reader.readAsDataURL(file)
  })
}
