export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 })
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const auth = req.headers.get('Authorization') ?? ''

  if (!supabaseUrl || !anonKey) {
    return Response.json({ error: 'server is not configured' }, { status: 500 })
  }

  const upstream = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/extract-fd-receipt`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: await req.text(),
  })

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
