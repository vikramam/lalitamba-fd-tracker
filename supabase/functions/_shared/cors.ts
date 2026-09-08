const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/

export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'http://127.0.0.1:43187'
  const allow = origin === appOrigin || LOCAL.test(origin) ? origin : appOrigin
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
