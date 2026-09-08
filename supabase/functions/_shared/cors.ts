const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/
const VERCEL = /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/

function allowedOrigins() {
  const fromEnv = (Deno.env.get('APP_ORIGIN') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return fromEnv.length > 0 ? fromEnv : ['http://127.0.0.1:43187']
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const listed = allowedOrigins()
  const allow =
    origin && (listed.includes(origin) || LOCAL.test(origin) || VERCEL.test(origin))
      ? origin
      : listed[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
