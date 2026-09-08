function asOrigin(value: string) {
  const trimmed = value.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isBrowserOrigin(value: string) {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      value === url.origin
    )
  } catch {
    return false
  }
}

function fallbackOrigin() {
  const fromEnv = (Deno.env.get('APP_ORIGIN') ?? '')
    .split(',')
    .map(asOrigin)
    .find(isBrowserOrigin)
  return fromEnv || 'http://127.0.0.1:43187'
}

export function corsHeaders(req: Request) {
  const origin = asOrigin(req.headers.get('Origin') ?? '')
  const allow = isBrowserOrigin(origin) ? origin : fallbackOrigin()
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
