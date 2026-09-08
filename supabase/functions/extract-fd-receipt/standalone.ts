import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0'

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const
const CODE_VERSION = 'flash-lite-500'
const HOURLY_LIMIT = 20

const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    holder_name: { type: 'string' },
    holder_address: { type: 'string' },
    bank_customer_id: { type: 'string' },
    fd_account_no: { type: 'string' },
    principal_amount: { type: 'string' },
    principal_amount_words: { type: 'string' },
    interest_rate_pct: { type: 'string' },
    tenure_label: { type: 'string' },
    interest_mode: { type: 'string' },
    monthly_interest_amount: { type: 'string' },
    interest_credit_account: { type: 'string' },
    maturity_value: { type: 'string' },
    fd_date: { type: 'string' },
    transaction_date: { type: 'string' },
    print_at: { type: 'string' },
    maturity_date: { type: 'string' },
    nominee_name: { type: 'string' },
    nominee_relationship: { type: 'string' },
    raw_interest_line: { type: 'string' },
    raw_text: { type: 'string' },
  },
}

const PROMPT = `You extract fields from one printed Fixed Deposit receipt of
Shri Lalitamba Pattina Souharda Sahakari Ltd, Gadag.

Return JSON only. Copy numbers and names as printed. Do not calculate.

Rules:
- CID is bank_customer_id. FD-A/c No is fd_account_no (like 01FD40599).
- Amounts may look like 150000/- or 1,50,000. Keep the digits in the string.
- Rate looks like 11.00 %.
- Dates are DD-MM-YYYY or DD-Mon-YYYY HH:MM:SS (Asia/Kolkata).
- The printed label is sometimes misspelled Maturtiy Value. Still extract maturity_value.
- Put the entire interest line in raw_interest_line. Examples:
  "Interest Rs. 1375/- Monthly CR To MS A/c :01003MS001396"
  "Interest Mode : On Maturity"
- Also copy nearby printed text into raw_text, including Maturity / Maturtiy Value.
- Strip nothing except obvious labels. Keep Sri/Smt on the name if printed.
- If a stamp hides a value, return null for that field.`

type InterestMode =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'cumulative'
  | 'on_maturity'
  | 'unknown'

type FdExtraction = {
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

type MappedExtraction = {
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

function corsHeaders(req: Request) {
  const raw = (req.headers.get('Origin') ?? '').trim().replace(/\/$/, '')
  const origin = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
  let allow = 'http://127.0.0.1:43187'
  try {
    const url = new URL(origin)
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      origin === url.origin
    ) {
      allow = origin
    }
  } catch {
    /* keep fallback */
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
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

function parseAmount(value: unknown): number | null {
  const text = asString(value)
  if (!text) return null
  const cleaned = text.replace(/rs\.?/gi, '').replace(/\/-/g, '').replace(/,/g, '').trim()
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function parseRate(value: unknown): number | null {
  return parseAmount(value)
}

function stripHonorific(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  return text.replace(/^(sri\/smt|sri|smt)\s+/i, '').trim() || null
}

function parseDate(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const named = text.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ](\d{4})/)
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()]
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`
  }
  return null
}

function parsePrintAt(value: unknown): string | null {
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
  return parseDate(text)
}

function parseTenure(value: unknown) {
  const text = asString(value)
  if (!text) return { years: null, months: null, days: null, label: null }
  const years = text.match(/(\d+)\s*years?/i)
  const months = text.match(/(\d+)\s*months?/i)
  const days = text.match(/(\d+)\s*days?/i)
  return {
    years: years ? Number(years[1]) : null,
    months: months ? Number(months[1]) : null,
    days: days ? Number(days[1]) : null,
    label: text,
  }
}

function parseInterestLine(line: string | null | undefined) {
  const text = line?.trim() ?? ''
  if (!text) {
    return { monthly_interest_amount: null, interest_mode: null, interest_credit_account: null }
  }
  const account = text.match(/MS\s*A\/c\s*:?\s*([0-9A-Za-z]+)/i)?.[1] ?? null
  if (/on\s*maturity/i.test(text)) {
    return {
      monthly_interest_amount: null,
      interest_mode: 'on_maturity' as const,
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
  const maturity = rawText.match(/matur(?:ity|tiy)\s+value\s*:?\s*([\d,]+(?:\/-)?)/i)
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

function confidenceFor(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  return 0.8
}

function mapLalitambaExtraction(raw: unknown, rawText?: string | null): MappedExtraction {
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
    (row.tenure_years != null ? `${row.tenure_years} Years` : null)
  const tenure = parseTenure(tenureSource)
  if (row.tenure_years != null && tenure.years === null) {
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
    fromLine.interest_mode ?? (asString(row.interest_mode) as InterestMode | null) ?? null
  const monthly_interest_amount =
    interest_mode === 'on_maturity'
      ? null
      : (fromLine.monthly_interest_amount ?? parseAmount(row.monthly_interest_amount))
  const interest_credit_account =
    interest_mode === 'on_maturity'
      ? null
      : (fromLine.interest_credit_account ?? asString(row.interest_credit_account))
  if (
    rawLine &&
    /rs\.?/i.test(rawLine) &&
    monthly_interest_amount === null &&
    interest_mode === 'monthly'
  ) {
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

type Body = { storage_path?: string; family_id?: string }

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const auth = req.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return json({ error: 'not authenticated' }, 401, cors)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'server is not configured' }, 500, cors)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    })
    const service = createClient(supabaseUrl, serviceKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'not authenticated' }, 401, cors)
    }

    const body = (await req.json()) as Body
    const storagePath = body.storage_path?.trim()
    const familyId = body.family_id?.trim()
    if (!storagePath || !familyId) {
      return json({ error: 'storage_path and family_id are required' }, 400, cors)
    }
    if (!storagePath.startsWith(`${familyId}/`)) {
      return json({ error: "You don't have access" }, 403, cors)
    }

    const { data: allowed, error: accessError } = await userClient.rpc(
      'has_family_access',
      { p_family_id: familyId },
    )
    if (accessError || !allowed) {
      return json({ error: "You don't have access" }, 403, cors)
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await service
      .from('ocr_runs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userData.user.id)
      .gte('created_at', since)
    if (countError) return json({ error: countError.message }, 500, cors)
    if ((count ?? 0) >= HOURLY_LIMIT) {
      return json({ error: 'OCR limit reached. Try again in an hour.' }, 429, cors)
    }

    const downloaded = await service.storage.from('fd-receipts').download(storagePath)
    if (downloaded.error || !downloaded.data) {
      return json({ error: "You don't have access" }, 403, cors)
    }

    const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
    const mimeType = downloaded.data.type || guessMime(storagePath)
    const geminiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiKey) {
      const inserted = await insertRun(service, {
        familyId,
        userId: userData.user.id,
        storagePath,
        status: 'skipped',
        provider: GEMINI_MODELS[0],
        raw: null,
        rawText: null,
        fields: {},
        confidence: {},
        error: 'GEMINI_API_KEY is not set',
      })
      return json({
        status: 'skipped',
        ocrRunId: inserted,
        fields: null,
        confidence: {},
        warnings: [],
        message:
          'Gemini is not configured. Type the fields. Set GEMINI_API_KEY on the function.',
      }, 200, cors)
    }

    const gemini = await callGemini(geminiKey, bytes, mimeType)
    if (!gemini.ok) {
      const inserted = await insertRun(service, {
        familyId,
        userId: userData.user.id,
        storagePath,
        status: 'failed',
        provider: gemini.model ?? GEMINI_MODELS[0],
        raw: gemini.raw,
        rawText: null,
        fields: {},
        confidence: {},
        error: gemini.error,
      })
      return json({
        status: 'failed',
        ocrRunId: inserted,
        fields: null,
        confidence: {},
        warnings: [],
        message: `Could not read the receipt. ${gemini.error}`,
        codeVersion: CODE_VERSION,
      }, 200, cors)
    }

    const mapped = mapLalitambaExtraction(gemini.parsed, gemini.rawText)
    const inserted = await insertRun(service, {
      familyId,
      userId: userData.user.id,
      storagePath,
      status: 'succeeded',
      provider: gemini.model,
      raw: gemini.raw,
      rawText: gemini.rawText,
      fields: mapped.fields,
      confidence: mapped.confidence,
      error: null,
    })

    return json({
      status: 'succeeded',
      ocrRunId: inserted,
      fields: mapped.fields,
      confidence: mapped.confidence,
      warnings: mapped.warnings,
      message: null,
      codeVersion: CODE_VERSION,
    }, 200, cors)
  } catch (cause) {
    return json(
      { error: cause instanceof Error ? cause.message : 'OCR failed' },
      500,
      cors,
    )
  }
})

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function guessMime(path: string) {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.pdf')) return 'application/pdf'
  return 'image/jpeg'
}

function bytesToBase64(bytes: Uint8Array) {
  const chunk = 0x2000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function geminiText(raw: unknown) {
  const candidate = raw as {
    candidates?: Array<{
      finishReason?: string
      content?: { parts?: Array<{ text?: string }> }
    }>
    promptFeedback?: { blockReason?: string }
    error?: { message?: string }
  }
  const parts = candidate.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((part) => part.text ?? '').filter(Boolean).join('\n').trim()
  return {
    text,
    blocked:
      candidate.promptFeedback?.blockReason ??
      candidate.candidates?.[0]?.finishReason ??
      null,
    error: candidate.error?.message ?? null,
  }
}

async function requestGemini(
  apiKey: string,
  model: string,
  bytes: Uint8Array,
  mimeType: string,
  withSchema: boolean,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type:
                  mimeType.startsWith('image/') || mimeType === 'application/pdf'
                    ? mimeType
                    : 'image/jpeg',
                data: bytesToBase64(bytes),
              },
            },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          ...(withSchema ? { responseSchema: GEMINI_SCHEMA } : {}),
          ...(model.startsWith('gemini-3') && !model.includes('lite')
            ? { thinkingConfig: { thinkingLevel: 'minimal' } }
            : {}),
        },
      }),
    },
  )
  return { ok: response.ok, raw: await response.json() }
}

function isQuotaError(message: string) {
  return /quota|rate.?limit|resource.?exhausted|exceeded your current/i.test(message)
}

async function callGemini(apiKey: string, bytes: Uint8Array, mimeType: string) {
  let lastError = 'Gemini error'
  let lastRaw: unknown = null
  let lastModel: string = GEMINI_MODELS[0]
  const tried: string[] = []

  for (const model of GEMINI_MODELS) {
    lastModel = model
    for (const withSchema of [true, false]) {
      const { ok, raw } = await requestGemini(apiKey, model, bytes, mimeType, withSchema)
      lastRaw = raw
      const extracted = geminiText(raw)
      if (!ok) {
        lastError = extracted.error ?? 'Gemini rejected the request'
        tried.push(`${model}: ${lastError}`)
        if (isQuotaError(lastError)) break
        continue
      }
      if (!extracted.text) {
        lastError = extracted.blocked
          ? `Gemini returned ${extracted.blocked}`
          : 'Gemini returned no text'
        tried.push(`${model}: ${lastError}`)
        continue
      }
      const jsonText = extracted.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      try {
        const parsed = JSON.parse(jsonText)
        const rawText =
          parsed && typeof parsed === 'object'
            ? String((parsed as { raw_text?: string }).raw_text ?? jsonText)
            : jsonText
        return { ok: true as const, raw, rawText, parsed, error: null, model }
      } catch {
        lastError = 'Gemini JSON was invalid'
        tried.push(`${model}: ${lastError}`)
      }
    }
  }

  return {
    ok: false as const,
    raw: lastRaw,
    rawText: null,
    parsed: null,
    error: tried.length > 0 ? tried.join(' | ') : lastError,
    model: lastModel,
  }
}

async function insertRun(
  service: ReturnType<typeof createClient>,
  input: {
    familyId: string
    userId: string
    storagePath: string
    status: 'succeeded' | 'failed' | 'skipped'
    provider: string
    raw: unknown
    rawText: string | null
    fields: unknown
    confidence: unknown
    error: string | null
  },
) {
  const scores = Object.values((input.confidence ?? {}) as Record<string, number>)
  const overall =
    scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null
  const { data, error } = await service
    .from('ocr_runs')
    .insert({
      family_id: input.familyId,
      storage_path: input.storagePath,
      provider: input.provider,
      status: input.status,
      raw_response: input.raw,
      raw_text: input.rawText,
      extracted_fields: input.fields,
      field_confidence: input.confidence,
      overall_confidence: overall,
      error_message: input.error,
      created_by: input.userId,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}
