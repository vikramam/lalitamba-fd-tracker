export type InterestMode =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'cumulative'
  | 'on_maturity'
  | 'unknown'

export type FdExtraction = {
  holder_name: string | null
  holder_address: string | null
  bank_customer_id: string | null
  fd_account_no: string | null
  principal_amount: number | null
  principal_amount_words: string | null
  interest_rate_pct: number | null
  tenure_years: number | null
  tenure_months: number | null
  tenure_days: number | null
  tenure_label: string | null
  interest_mode: InterestMode | null
  monthly_interest_amount: number | null
  interest_credit_account: string | null
  maturity_value: number | null
  fd_date: string | null
  transaction_date: string | null
  print_at: string | null
  maturity_date: string | null
  nominee_name: string | null
  nominee_relationship: string | null
  raw_interest_line: string | null
}

export type MappedExtraction = {
  fields: FdExtraction
  confidence: Record<string, number>
  warnings: string[]
}

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

export function parseAmount(value: unknown): number | null {
  const text = asString(value)
  if (!text) return null
  const cleaned = text.replace(/rs\.?/gi, '').replace(/\/-/g, '').replace(/,/g, '').trim()
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export function parseRate(value: unknown): number | null {
  const parsed = parseAmount(value)
  if (parsed === null) return null
  return parsed
}

export function stripHonorific(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  return text.replace(/^(sri\/smt|sri|smt)\s+/i, '').trim() || null
}

export function parseDate(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  const named = text.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ](\d{4})/)
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()]
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`
  }
  return null
}

export function parsePrintAt(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  if (/T\d{2}:\d{2}/.test(text)) return text
  const named = text.match(
    /^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ](\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/,
  )
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()]
    if (!month) return parseDate(text)
    const day = named[1].padStart(2, '0')
    const time = named[4]
      ? `${named[4].padStart(2, '0')}:${named[5]}:${named[6]}`
      : '00:00:00'
    return `${named[3]}-${month}-${day}T${time}+05:30`
  }
  const date = parseDate(text)
  return date
}

export function parseTenure(value: unknown): {
  years: number | null
  months: number | null
  days: number | null
  label: string | null
} {
  const text = asString(value)
  if (!text) return { years: null, months: null, days: null, label: null }
  const years = text.match(/(\d+)\s*years?/i)
  const months = text.match(/(\d+)\s*months?/i)
  const days = text.match(/(\d+)\s*days?/i)
  const y = years ? Number(years[1]) : null
  const m = months ? Number(months[1]) : null
  const d = days ? Number(days[1]) : null
  return {
    years: y,
    months: m,
    days: d,
    label: text,
  }
}

export function parseInterestLine(line: string | null | undefined): {
  monthly_interest_amount: number | null
  interest_mode: InterestMode | null
  interest_credit_account: string | null
} {
  const text = line?.trim() ?? ''
  if (!text) {
    return {
      monthly_interest_amount: null,
      interest_mode: null,
      interest_credit_account: null,
    }
  }

  const account = text.match(/MS\s*A\/c\s*:?\s*([0-9A-Za-z]+)/i)?.[1] ?? null

  if (/on\s*maturity/i.test(text)) {
    return {
      monthly_interest_amount: null,
      interest_mode: 'on_maturity',
      interest_credit_account: null,
    }
  }

  const rupees = text.match(/rs\.?\s*([\d,]+)(?:\/-)?/i)
  const amount = rupees ? parseAmount(rupees[1]) : null

  let interest_mode: InterestMode | null = null
  if (/monthly/i.test(text)) interest_mode = 'monthly'
  else if (/quarterly/i.test(text)) interest_mode = 'quarterly'
  else if (/half[\s-]*year/i.test(text)) interest_mode = 'half_yearly'
  else if (/yearly|annual/i.test(text)) interest_mode = 'yearly'
  else if (/cumulativ/i.test(text)) interest_mode = 'cumulative'

  return {
    monthly_interest_amount: interest_mode === 'monthly' ? amount : null,
    interest_mode,
    interest_credit_account: account,
  }
}

function fromRawText(rawText: string | null): Partial<FdExtraction> {
  if (!rawText) return {}
  const maturity = rawText.match(/matur(?:ity|tiy)\s+value\s*:?\s*([\d,]+(?:\/-)?) /i)
    ?? rawText.match(/matur(?:ity|tiy)\s+value\s*:?\s*([\d,]+(?:\/-)?)/i)
  const cid = rawText.match(/\bCID\s*:?\s*(\d{3,6})\b/i)
  const account = rawText.match(/FD-?A\/c\s*No\.?\s*:?\s*(\d{2}FD\d+)/i)
  const interest =
    rawText.match(/interest[^\n]{0,80}/i)?.[0] ??
    rawText.match(/monthly cr to[^\n]{0,80}/i)?.[0] ??
    null
  return {
    maturity_value: maturity ? parseAmount(maturity[1]) : null,
    bank_customer_id: cid?.[1] ?? null,
    fd_account_no: account?.[1] ?? null,
    raw_interest_line: interest,
  }
}

function confidenceFor(value: unknown, parseable = true) {
  if (value === null || value === undefined || value === '') return 0
  return parseable ? 0.8 : 0.4
}

export function mapLalitambaExtraction(
  raw: unknown,
  rawText?: string | null,
): MappedExtraction {
  const row = asRecord(raw)
  const scanned = fromRawText(rawText ?? asString(row.raw_text) ?? asString(row.raw_interest_line))
  const warnings: string[] = []

  const rawLine =
    asString(row.raw_interest_line) ??
    asString(row.interest_line) ??
    scanned.raw_interest_line ??
    null
  const fromLine = parseInterestLine(rawLine)

  const tenureSource =
    asString(row.tenure_label) ??
    (row.tenure_years !== undefined && row.tenure_years !== null
      ? `${row.tenure_years} Years`
      : null)
  const tenure = parseTenure(tenureSource)
  if (row.tenure_years !== undefined && row.tenure_years !== null && tenure.years === null) {
    tenure.years = Number(row.tenure_years) || null
  }

  const maturity =
    parseAmount(row.maturity_value) ??
    parseAmount(row.maturtiy_value) ??
    scanned.maturity_value ??
    null

  if (rawText && /maturtiy/i.test(rawText) && maturity === null) {
    warnings.push('Saw the printed Maturtiy typo, but no maturity amount.')
  }

  const interest_mode =
    fromLine.interest_mode ??
    (asString(row.interest_mode) as InterestMode | null) ??
    null

  const monthly_interest_amount =
    interest_mode === 'on_maturity'
      ? null
      : (fromLine.monthly_interest_amount ?? parseAmount(row.monthly_interest_amount))
  const interest_credit_account =
    interest_mode === 'on_maturity'
      ? null
      : (fromLine.interest_credit_account ?? asString(row.interest_credit_account))

  if (rawLine && /rs\.?/i.test(rawLine) && monthly_interest_amount === null && interest_mode === 'monthly') {
    warnings.push('The stamp may be hiding the monthly interest amount.')
  }

  const fields: FdExtraction = {
    holder_name: stripHonorific(row.holder_name),
    holder_address: asString(row.holder_address),
    bank_customer_id: asString(row.bank_customer_id) ?? scanned.bank_customer_id ?? null,
    fd_account_no: asString(row.fd_account_no) ?? scanned.fd_account_no ?? null,
    principal_amount: parseAmount(row.principal_amount),
    principal_amount_words: asString(row.principal_amount_words),
    interest_rate_pct: parseRate(row.interest_rate_pct),
    tenure_years: tenure.years,
    tenure_months: tenure.months ?? 0,
    tenure_days: tenure.days ?? 0,
    tenure_label: tenure.label,
    interest_mode,
    monthly_interest_amount,
    interest_credit_account,
    maturity_value: maturity,
    fd_date: parseDate(row.fd_date),
    transaction_date: parseDate(row.transaction_date),
    print_at: parsePrintAt(row.print_at),
    maturity_date: parseDate(row.maturity_date),
    nominee_name: stripHonorific(row.nominee_name),
    nominee_relationship: asString(row.nominee_relationship),
    raw_interest_line: rawLine,
  }

  const confidence: Record<string, number> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'raw_interest_line') continue
    confidence[key] = confidenceFor(value)
  }

  return { fields, confidence, warnings }
}
