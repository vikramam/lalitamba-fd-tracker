import { addDemoReviews } from '@/lib/demo-store'
import type { FdExtraction } from '@/lib/lalitamba-map'
import { supabase } from '@/lib/supabase'
import type { FixedDeposit, OcrFieldReview } from '@/lib/types'

export const REVIEW_FIELDS = [
  'holder_name',
  'holder_address',
  'bank_customer_id',
  'fd_account_no',
  'principal_amount',
  'principal_amount_words',
  'interest_rate_pct',
  'tenure_years',
  'tenure_label',
  'interest_mode',
  'monthly_interest_amount',
  'interest_credit_account',
  'maturity_value',
  'fd_date',
  'transaction_date',
  'maturity_date',
  'nominee_name',
  'nominee_relationship',
] as const

export type ReviewField = (typeof REVIEW_FIELDS)[number]
export type OcrBadge = 'from_receipt' | 'corrected' | 'check_this'

export function valueToText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return String(value)
  }
  const text = String(value).trim()
  return text || null
}

function normalizeCompare(value: unknown): string | null {
  const text = valueToText(value)
  if (!text) return null
  return text.replace(/\s+/g, ' ').trim()
}

export function valuesMatch(extracted: unknown, confirmed: unknown): boolean {
  const left = normalizeCompare(extracted)
  const right = normalizeCompare(confirmed)
  if (left === null && right === null) return true
  if (left === null || right === null) return false
  if (/^-?\d+(?:\.\d+)?$/.test(left) && /^-?\d+(?:\.\d+)?$/.test(right)) {
    return Math.abs(Number(left) - Number(right)) < 0.005
  }
  return left.toLowerCase() === right.toLowerCase()
}

export function ocrFieldBadge(input: {
  hasOcr: boolean
  extracted: unknown
  current: unknown
  confidence?: number
}): OcrBadge | null {
  if (!input.hasOcr) return null
  if (valueToText(input.extracted) === null) return null
  if (!valuesMatch(input.extracted, input.current)) return 'corrected'
  if ((input.confidence ?? 0) < 0.6) return 'check_this'
  return 'from_receipt'
}

export function fieldFromConfirmed(
  row: Pick<FixedDeposit, ReviewField>,
  field: ReviewField,
): unknown {
  return row[field]
}

export function buildFieldReviews(input: {
  ocrRunId: string
  fdId: string
  extracted: FdExtraction
  confirmed: Pick<FixedDeposit, ReviewField>
  confidence: Record<string, number>
}): Array<Omit<OcrFieldReview, 'id'>> {
  return REVIEW_FIELDS.map((field) => {
    const extracted_value = valueToText(input.extracted[field])
    const confirmed_value = valueToText(fieldFromConfirmed(input.confirmed, field))
    const confidence = input.confidence[field]
    return {
      ocr_run_id: input.ocrRunId,
      fd_id: input.fdId,
      field_name: field,
      extracted_value,
      confirmed_value,
      was_modified: !valuesMatch(input.extracted[field], fieldFromConfirmed(input.confirmed, field)),
      confidence: typeof confidence === 'number' ? confidence : null,
    }
  })
}

export async function saveOcrFieldReviews(input: {
  ocrRunId: string
  fdId: string
  extracted: FdExtraction
  confirmed: Pick<FixedDeposit, ReviewField>
  confidence: Record<string, number>
}): Promise<OcrFieldReview[]> {
  const rows = buildFieldReviews(input)
  if (!supabase) {
    return addDemoReviews(rows)
  }

  const { error: clearError } = await supabase
    .from('ocr_field_reviews')
    .delete()
    .eq('ocr_run_id', input.ocrRunId)
  if (clearError) throw new Error(clearError.message)

  const { data, error } = await supabase
    .from('ocr_field_reviews')
    .insert(rows)
    .select(
      'id, ocr_run_id, fd_id, field_name, extracted_value, confirmed_value, was_modified, confidence',
    )
  if (error) throw new Error(error.message)
  return (data ?? []) as OcrFieldReview[]
}
