const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function sanitizeReceiptFileName(name: string, mimeType: string) {
  const ext =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg'
  const stem = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${stem || 'receipt'}.${ext}`
}

export function receiptStoragePath(input: {
  familyId: string
  userId: string
  fdId: string
  fileName: string
  at?: number
}) {
  if (!UUID.test(input.familyId) || !UUID.test(input.userId) || !UUID.test(input.fdId)) {
    throw new Error('Invalid receipt path.')
  }
  const stamp = input.at ?? Date.now()
  return `${input.familyId}/${input.userId}/${input.fdId}/${stamp}-${input.fileName}`
}

export function publicReceiptUrl(supabaseUrl: string, storagePath: string) {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/fd-receipts/${storagePath}`
}

export function familyIdFromStoragePath(storagePath: string) {
  return storagePath.split('/')[0] ?? ''
}
