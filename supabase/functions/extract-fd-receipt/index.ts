import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0'

import { corsHeaders } from '../_shared/cors.ts'
import { mapLalitambaExtraction } from '../_shared/lalitamba-map.ts'

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

type Body = {
  storage_path?: string
  family_id?: string
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

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
      return json(
        {
          status: 'skipped',
          ocrRunId: inserted,
          fields: null,
          confidence: {},
          warnings: [],
          message:
            'Gemini is not configured. Type the fields. Set GEMINI_API_KEY on the function to enable OCR.',
        },
        200,
        cors,
      )
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
      return json(
        {
          status: 'failed',
          ocrRunId: inserted,
          fields: null,
          confidence: {},
          warnings: [],
          message: `Could not read the receipt. ${gemini.error}`,
          codeVersion: CODE_VERSION,
        },
        200,
        cors,
      )
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

    return json(
      {
        status: 'succeeded',
        ocrRunId: inserted,
        fields: mapped.fields,
        confidence: mapped.confidence,
        warnings: mapped.warnings,
        message: null,
        codeVersion: CODE_VERSION,
      },
      200,
      cors,
    )
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
  const candidate = (raw as {
    candidates?: Array<{
      finishReason?: string
      content?: { parts?: Array<{ text?: string }> }
    }>
    promptFeedback?: { blockReason?: string }
    error?: { message?: string }
  })
  const parts = candidate.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((part) => part.text ?? '').filter(Boolean).join('\n').trim()
  const blocked =
    candidate.promptFeedback?.blockReason ??
    candidate.candidates?.[0]?.finishReason ??
    null
  return { text, blocked, error: candidate.error?.message ?? null }
}

function isQuotaError(message: string) {
  return /quota|rate.?limit|resource.?exhausted|exceeded your current/i.test(message)
}

async function requestGemini(
  apiKey: string,
  model: string,
  bytes: Uint8Array,
  mimeType: string,
  withSchema: boolean,
) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: mimeType.startsWith('image/') || mimeType === 'application/pdf'
                  ? mimeType
                  : 'image/jpeg',
                data: bytesToBase64(bytes),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(withSchema ? { responseSchema: GEMINI_SCHEMA } : {}),
        ...(model.startsWith('gemini-3') && !model.includes('lite')
          ? { thinkingConfig: { thinkingLevel: 'minimal' } }
          : {}),
      },
    }),
  })
  const raw = await response.json()
  return { ok: response.ok, raw }
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
      const text = extracted.text
      if (!text) {
        lastError = extracted.blocked
          ? `Gemini returned ${extracted.blocked}`
          : 'Gemini returned no text'
        tried.push(`${model}: ${lastError}`)
        continue
      }
      const jsonText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
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
