import { extractionFromFixture, fixtureIdFromName } from '@/lib/ocr-fixtures'
import type { FdExtraction, MappedExtraction } from '@/lib/lalitamba-map'
import { receiptStoragePath, sanitizeReceiptFileName } from '@/lib/receipt-path'
import { supabase } from '@/lib/supabase'
import type { FamilyMember } from '@/lib/types'

export type OcrResult = MappedExtraction & {
  ocrRunId: string | null
  status: 'succeeded' | 'failed' | 'skipped'
  message: string | null
}

export function suggestMemberId(
  fields: FdExtraction,
  members: FamilyMember[],
  currentId: string,
) {
  if (!fields.bank_customer_id) return currentId
  const match = members.find(
    (member) => member.bank_customer_id === fields.bank_customer_id,
  )
  return match?.id ?? currentId
}

export async function extractFdReceipt(input: {
  file: File
  familyId: string
  userId: string
}): Promise<OcrResult> {
  const fixtureId = fixtureIdFromName(input.file.name)
  if (!supabase) {
    if (fixtureId) {
      const mapped = extractionFromFixture(fixtureId)
      return {
        ...mapped,
        ocrRunId: `demo-${crypto.randomUUID()}`,
        status: 'succeeded',
        message: 'Filled from the local sample fixture. Check every field before saving.',
      }
    }
    return {
      fields: emptyFields(),
      confidence: {},
      warnings: [],
      ocrRunId: null,
      status: 'skipped',
      message:
        'OCR needs Supabase and the extract-fd-receipt function. Type the fields, or use a sample filename (01FD40599 / 01FD32450).',
    }
  }

  const fileName = sanitizeReceiptFileName(input.file.name, input.file.type)
  const draftId = crypto.randomUUID()
  const storagePath = receiptStoragePath({
    familyId: input.familyId,
    userId: input.userId,
    fdId: draftId,
    fileName,
  })

  const upload = await supabase.storage.from('fd-receipts').upload(storagePath, input.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: input.file.type,
  })
  if (upload.error) {
    throw new Error(upload.error.message)
  }

  const { data, error } = await supabase.functions.invoke('extract-fd-receipt', {
    body: { storage_path: storagePath, family_id: input.familyId },
  })
  if (error) {
    if (fixtureId) {
      const mapped = extractionFromFixture(fixtureId)
      return {
        ...mapped,
        ocrRunId: null,
        status: 'succeeded',
        message:
          'The OCR function is not available, so the local sample fixture was used. Check every field.',
      }
    }
    return {
      fields: emptyFields(),
      confidence: {},
      warnings: [],
      ocrRunId: null,
      status: 'skipped',
      message:
        'Could not read the receipt. Type the fields. Deploy extract-fd-receipt and set the Gemini secret on the function.',
    }
  }

  const payload = data as {
    fields?: FdExtraction
    confidence?: Record<string, number>
    warnings?: string[]
    ocrRunId?: string
    status?: OcrResult['status']
    message?: string
    error?: string
  }

  if (payload.status === 'skipped' || payload.status === 'failed') {
    if (fixtureId) {
      const mapped = extractionFromFixture(fixtureId)
      return {
        ...mapped,
        ocrRunId: payload.ocrRunId ?? null,
        status: 'succeeded',
        message: payload.message ?? 'Gemini was unavailable. Used the local sample fixture.',
      }
    }
    return {
      fields: payload.fields ?? emptyFields(),
      confidence: payload.confidence ?? {},
      warnings: payload.warnings ?? [],
      ocrRunId: payload.ocrRunId ?? null,
      status: payload.status,
      message:
        payload.message ??
        payload.error ??
        'Could not read the receipt. Type the fields.',
    }
  }

  return {
    fields: payload.fields ?? emptyFields(),
    confidence: payload.confidence ?? {},
    warnings: payload.warnings ?? [],
    ocrRunId: payload.ocrRunId ?? null,
    status: 'succeeded',
    message: payload.message ?? null,
  }
}

export async function linkOcrRun(input: {
  ocrRunId: string
  fdId: string
  receiptId?: string | null
}) {
  if (!supabase) return
  const { error } = await supabase
    .from('ocr_runs')
    .update({
      fd_id: input.fdId,
      receipt_id: input.receiptId ?? null,
    })
    .eq('id', input.ocrRunId)
  if (error) throw new Error(error.message)
}

function emptyFields(): FdExtraction {
  return {
    holder_name: null,
    holder_address: null,
    bank_customer_id: null,
    fd_account_no: null,
    principal_amount: null,
    principal_amount_words: null,
    interest_rate_pct: null,
    tenure_years: null,
    tenure_months: null,
    tenure_days: null,
    tenure_label: null,
    interest_mode: null,
    monthly_interest_amount: null,
    interest_credit_account: null,
    maturity_value: null,
    fd_date: null,
    transaction_date: null,
    print_at: null,
    maturity_date: null,
    nominee_name: null,
    nominee_relationship: null,
    raw_interest_line: null,
  }
}
